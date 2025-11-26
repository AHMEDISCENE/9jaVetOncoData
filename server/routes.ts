import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertClinicSchema, insertCaseSchema, insertTumourTypeSchema, insertAnatomicalSiteSchema, insertFeedPostSchema, updateFeedPostSchema, insertFollowUpSchema, insertCaseFileSchema } from "@shared/schema";
import bcrypt from "bcrypt";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { pool, db } from "./db";
import multer from "multer";
import { z } from "zod";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { putObject, getObject, deleteObject, generateStorageKey, isAllowedMimeType, determineFileKind, MAX_FILE_SIZE, MAX_FILES_PER_CASE } from "./storage/files";
import { readFile, writeFile, mkdir, rm } from "fs/promises";
import path from "path";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
// @ts-ignore - jspdf-autotable modifies jsPDF prototype
import { autoTable } from "jspdf-autotable";
import { sendPasswordResetEmail } from "./email";
import { callChatGPT } from "./services/openaiClient";
import { buildLiveDataContext } from "./services/buildLiveDataContext";
import { executeAnalyticsQuery, validateSQL } from "./services/analyticsQueryService";
import { suggestCaseFields } from "./services/caseSuggestionService";

const PgSession = ConnectPgSimple(session);
// Normalize species names to standardized format
const normalizeSpecies = (species: string | undefined | null): string | undefined | null => {
  if (!species) return species;
  const normalized = species.trim().toLowerCase();
  if (normalized === 'canine') return 'Dog';
  if (normalized === 'feline') return 'Cat';
  // Return capitalized version for standard species like "Dog", "Cat"
  return species.charAt(0).toUpperCase() + species.slice(1).toLowerCase();
};

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  clinicName: z.string().min(1),
  clinicState: z.string().min(1),
  clinicCity: z.string().min(1),
  role: z.enum(["ADMIN", "MANAGER", "CLINICIAN", "RESEARCHER", "STUDENT"]).default("CLINICIAN"),
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["MANAGER", "CLINICIAN", "RESEARCHER", "STUDENT"]),
});

const filterSchema = z.object({
  species: z.string().optional(),
  tumourType: z.string().optional(),
  outcome: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.coerce.number().optional(),
  offset: z.coerce.number().optional(),
  clinicId: z.union([z.string(), z.array(z.string())]).optional(), // Multi-select clinic filtering
  zone: z.union([z.string(), z.array(z.string())]).optional(),
  state: z.union([z.string(), z.array(z.string())]).optional(),
  tumourTypeId: z.union([z.string(), z.array(z.string())]).optional(),
  sort: z.enum(['clinic', 'zone', 'state', 'date', 'case_number']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

// File upload configuration for bulk import (memory storage so we can validate before persisting)
const bulkUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/json',
      'application/zip',
      'application/pdf'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

// File upload configuration for case files
const caseFileUpload = multer({
  dest: 'uploads/case-files/',
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

// Avatar upload configuration
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB for avatars
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image type'));
    }
  },
});

// Feed image upload configuration
const feedImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB for feed images
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image type'));
    }
  },
});

// Auth middleware
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
};

const requireRole = (minRole: string) => (req: any, res: any, next: any) => {
  const roleHierarchy = ["STUDENT", "RESEARCHER", "CLINICIAN", "MANAGER", "ADMIN", "SUPER_ADMIN"];
  const userRoleIndex = roleHierarchy.indexOf(req.session?.userRole || "");
  const minRoleIndex = roleHierarchy.indexOf(minRole);
  
  if (userRoleIndex < minRoleIndex) {
    return res.status(403).json({ message: "Insufficient permissions" });
  }
  next();
};

// Validation middleware to prevent ADMIN role in request body
const preventAdminRoleInBody = (req: any, res: any, next: any) => {
  if (req.body?.role === "ADMIN") {
    return res.status(403).json({ message: "Cannot assign ADMIN role through this endpoint" });
  }
  next();
};

import type { NotificationManager } from './notifications';

export async function registerRoutes(app: Express, notificationManager?: any): Promise<Server> {
  // Ensure SESSION_SECRET is set
  if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is required');
  }
  
  // Trust proxy for Replit deployment
  app.set('trust proxy', 1);
  
  // Session middleware
  app.use(session({
    store: new PgSession({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  }));

  // Passport configuration
  app.use(passport.initialize());
  app.use(passport.session());

  // Passport serialization
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUserById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  // Google OAuth Strategy
  // Dynamically construct callback URL for Replit deployment
  const getCallbackURL = () => {
    const replitDomain = process.env.REPLIT_DOMAINS;
    if (replitDomain) {
      const domains = replitDomain.split(',');
      const primaryDomain = domains[0];
      return `https://${primaryDomain}/api/auth/google/callback`;
    }
    return process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback";
  };

  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: getCallbackURL(),
    state: true // Enable CSRF protection
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user already exists with this Google ID
      const existingUser = await storage.getUserByGoogleId(profile.id);
      
      if (existingUser) {
        // User exists, log them in
        return done(null, existingUser);
      }

      // Check if user exists with same email
      const emailUser = await storage.getUserByEmail(profile.emails?.[0]?.value || "");
      
      if (emailUser) {
        // Link Google account to existing user
        await storage.linkGoogleAccount(emailUser.id, profile.id);
        return done(null, emailUser);
      }

      // Create new user (they'll need to complete clinic setup)
      const newUser = await storage.createUserFromGoogle({
        googleId: profile.id,
        email: profile.emails?.[0]?.value || "",
        name: profile.displayName,
        photo: profile.photos?.[0]?.value || "",
      });

      return done(null, newUser);
    } catch (error) {
      return done(error, undefined);
    }
  }));

  // Google OAuth routes
  app.get("/api/auth/google", 
    passport.authenticate("google", { scope: ["profile", "email"] })
  );

  app.get("/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login" }),
    async (req, res) => {
      const user = req.user as any;
      
      // Set session
      (req.session as any).userId = user.id;
      (req.session as any).userRole = user.role;
      (req.session as any).clinicId = user.clinicId;

      // If user doesn't have a clinic, redirect to clinic setup
      if (!user.clinicId) {
        res.redirect("/setup-clinic");
      } else {
        res.redirect("/dashboard");
      }
    }
  );

  // Get all available clinics (for signup/join)
  app.get("/api/clinics/available", async (req, res) => {
    try {
      const clinics = await storage.getAllClinics();
      res.json(clinics);
    } catch (error) {
      console.error("[ERROR] Failed to get clinics:", error);
      res.status(500).json({ message: "Failed to retrieve clinics" });
    }
  });

  // Join existing clinic route (no auth required - called during signup)
  app.post("/api/auth/join-clinic", async (req, res) => {
    try {
      // Check if user is in session (for authenticated flow) or use provided userId (for signup flow)
      let userId = (req.session as any).userId;
      
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { clinicId, role } = req.body;

      // Security check: User must not already have a clinic
      const existingUser = await storage.getUserById(userId);
      if (existingUser?.clinicId) {
        return res.status(400).json({ message: "User already belongs to a clinic" });
      }

      // Verify clinic exists
      const clinic = await storage.getClinic(clinicId);
      if (!clinic) {
        return res.status(404).json({ message: "Clinic not found" });
      }

      // Use provided role or default to CLINICIAN
      const finalRole = role || "CLINICIAN";

      // Update user with clinic and role
      const updatedUser = await storage.updateUser(userId, {
        clinicId: clinic.id,
        role: finalRole,
      });

      // Update session
      (req.session as any).clinicId = clinic.id;
      (req.session as any).userRole = updatedUser.role;

      // Create audit log
      await storage.createAuditLog({
        actorId: userId,
        clinicId: clinic.id,
        entityType: 'USER',
        entityId: userId,
        action: 'UPDATE',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json({ 
        user: { 
          id: updatedUser.id, 
          email: updatedUser.email, 
          name: updatedUser.name, 
          role: updatedUser.role 
        }, 
        clinic 
      });
    } catch (error) {
      console.error("[ERROR] Join clinic failed:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to join clinic" });
    }
  });

  // Clinic setup route for Google OAuth users (create new clinic)
  app.post("/api/auth/setup-clinic", requireAuth, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const { clinicName, clinicState, clinicCity, role } = req.body;

      // Security check: User must not already have a clinic
      const existingUser = await storage.getUserById(userId);
      if (existingUser?.clinicId) {
        return res.status(400).json({ message: "User already belongs to a clinic" });
      }

      // Security check: Only allow ADMIN role for first clinic creator
      // Since user has no clinic and is creating a brand new one, allow any role including ADMIN
      const finalRole = role || "CLINICIAN";

      // Create clinic
      const clinic = await storage.createClinic({
        name: clinicName,
        state: clinicState as any,
        city: clinicCity,
      });

      // Update user with clinic and selected role
      const updatedUser = await storage.updateUser(userId, {
        clinicId: clinic.id,
        role: finalRole,
      });

      // Update session
      (req.session as any).clinicId = clinic.id;
      (req.session as any).userRole = updatedUser.role;

      // Create audit log
      await storage.createAuditLog({
        actorId: userId,
        clinicId: clinic.id,
        entityType: 'CLINIC',
        entityId: clinic.id,
        action: 'CREATE',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json({ 
        user: { 
          id: updatedUser.id, 
          email: updatedUser.email, 
          name: updatedUser.name, 
          role: updatedUser.role 
        }, 
        clinic 
      });
    } catch (error) {
      console.error("[ERROR] Setup clinic failed:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Setup failed" });
    }
  });

  // Auth routes
  // Register user without clinic (for join-clinic flow)
  app.post("/api/auth/register-without-clinic", async (req, res) => {
    try {
      const { email, name, password, role } = req.body;
      
      // Check if user exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create user without clinic
      const user = await storage.createUser({
        email,
        name,
        password: hashedPassword,
        role: role as any || "CLINICIAN",
        clinicId: undefined,
      });
      
      // Set session
      (req.session as any).userId = user.id;
      (req.session as any).userRole = user.role;
      
      res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    } catch (error) {
      console.error("[ERROR] Register without clinic failed:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Registration failed" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, name, password, clinicName, clinicState, clinicCity, role } = registerSchema.parse(req.body);
      
      // Check if user exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create clinic first
      const clinic = await storage.createClinic({
        name: clinicName,
        state: clinicState as any,
        city: clinicCity,
      });
      
      // Create user with selected role
      const user = await storage.createUser({
        email,
        name,
        password: hashedPassword,
        role: role as any,
        clinicId: clinic.id,
      });
      
      // Set session
      (req.session as any).userId = user.id;
      (req.session as any).userRole = user.role;
      (req.session as any).clinicId = user.clinicId;
      
      await storage.createAuditLog({
        actorId: user.id,
        clinicId: clinic.id,
        entityType: 'USER',
        entityId: user.id,
        action: 'CREATE',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, image: user.image }, clinic });
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(email);
      if (!user || !user.password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Check user status
      if (user.userStatus === "SUSPENDED") {
        return res.status(403).json({ message: "Your account has been suspended. Please contact your clinic administrator." });
      }

      if (!user.isActive) {
        return res.status(403).json({ message: "Your account is inactive. Please contact your clinic administrator." });
      }
      
      // Update last login
      await storage.updateLastLogin(user.id);
      
      // Set session
      (req.session as any).userId = user.id;
      (req.session as any).userRole = user.role;
      (req.session as any).clinicId = user.clinicId;
      
      const userWithClinic = await storage.getUserWithClinic(user.id);
      
      res.json({ 
        user: { 
          id: user.id, 
          email: user.email, 
          name: user.name, 
          role: user.role,
          image: user.image 
        }, 
        clinic: userWithClinic?.clinic 
      });
    } catch (error) {
      console.error("[ERROR] Login failed:", error);
      if (error instanceof Error && error.message.includes("validation")) {
        return res.status(400).json({ message: "Please enter a valid email and password." });
      }
      res.status(400).json({ message: error instanceof Error ? error.message : "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session?.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const userWithClinic = await storage.getUserWithClinic((req.session as any).userId);
      if (!userWithClinic) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Update session role in case it was changed in the database (for role promotions)
      (req.session as any).userRole = userWithClinic.role;
      
      res.json({ 
        user: { 
          id: userWithClinic.id, 
          email: userWithClinic.email, 
          name: userWithClinic.name, 
          firstName: userWithClinic.firstName,
          lastName: userWithClinic.lastName,
          title: userWithClinic.title,
          jobTitle: userWithClinic.jobTitle,
          specialty: userWithClinic.specialty,
          bio: userWithClinic.bio,
          phone: userWithClinic.phone,
          linkedIn: userWithClinic.linkedIn,
          googleScholar: userWithClinic.googleScholar,
          role: userWithClinic.role,
          image: userWithClinic.image 
        }, 
        clinic: userWithClinic.clinic 
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get user data" });
    }
  });

  // Password reset endpoints
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if email exists for security
        return res.json({ message: "If email exists, reset link has been sent" });
      }

      const { token, code } = await storage.createPasswordResetToken(user.id);
      
      console.log(`[PASSWORD_RESET] Reset token for ${email}: ${token} (code: ${code})`);
      
      try {
        // Try to send email via Gmail
        await sendPasswordResetEmail(email, token, code);
        res.json({ message: "If email exists, reset link has been sent" });
      } catch (emailError) {
        console.error("[ERROR] Failed to send email, returning token and code for development:", emailError);
        // If email fails (Gmail not connected), return token and code for testing
        const response: any = { message: "If email exists, reset link has been sent" };
        if (process.env.NODE_ENV === 'development') {
          response.token = token;
          response.code = code;
          response.devMessage = "Email service unavailable - token and code included for testing";
        }
        res.json(response);
      }
    } catch (error) {
      console.error("[ERROR] Forgot password failed:", error);
      res.status(500).json({ message: "Failed to process password reset request" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { code, password } = req.body;
      
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ message: "Reset code is required" });
      }
      if (!password || typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      await storage.resetPassword(code, password);
      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("[ERROR] Reset password failed:", error);
      const message = error instanceof Error ? error.message : "Failed to reset password";
      res.status(400).json({ message });
    }
  });

  // Invitation routes
  app.post("/api/invitations", requireAuth, requireRole("MANAGER"), preventAdminRoleInBody, async (req, res) => {
    try {
      const { email, role } = inviteSchema.parse(req.body);
      const clinicId = (req.session as any).clinicId;
      const invitedBy = (req.session as any).userId;
      
      const invitation = await storage.createInvitation(email, role, clinicId, invitedBy);
      
      await storage.createAuditLog({
        actorId: invitedBy,
        clinicId,
        entityType: 'INVITATION',
        entityId: invitation.id,
        action: 'CREATE',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      res.json(invitation);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create invitation" });
    }
  });

  app.post("/api/invitations/accept", async (req, res) => {
    try {
      const { token, name, password } = req.body;
      
      const invitation = await storage.getInvitationByToken(token);
      if (!invitation) {
        return res.status(404).json({ message: "Invalid or expired invitation" });
      }
      
      // Prevent ADMIN role from being assigned via invitation
      if (invitation.role === "ADMIN") {
        return res.status(403).json({ message: "Invalid invitation: ADMIN role cannot be assigned through invitations" });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(invitation.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create user
      const user = await storage.createUser({
        email: invitation.email,
        name,
        password: hashedPassword,
        role: invitation.role,
        clinicId: invitation.clinicId,
      });
      
      // Accept invitation
      await storage.acceptInvitation(token, user.id);
      
      await storage.createAuditLog({
        actorId: user.id,
        clinicId: invitation.clinicId,
        entityType: 'USER',
        entityId: user.id,
        action: 'CREATE',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      res.json({ message: "Invitation accepted successfully" });
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to accept invitation" });
    }
  });

  // User profile routes
  app.patch("/api/users/profile", requireAuth, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const { 
        name, 
        email, 
        firstName, 
        lastName, 
        title, 
        jobTitle, 
        specialty, 
        bio,
        phone,
        linkedIn,
        googleScholar
      } = req.body;
      
      const profileSchema = z.object({
        name: z.string().optional(),
        email: z.string().email().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        title: z.string().optional(),
        jobTitle: z.string().optional(),
        specialty: z.string().optional(),
        bio: z.string().optional(),
        phone: z.string().optional(),
        linkedIn: z.string().optional(),
        googleScholar: z.string().optional(),
      });

      const validated = profileSchema.parse({
        name,
        email,
        firstName,
        lastName,
        title,
        jobTitle,
        specialty,
        bio,
        phone,
        linkedIn,
        googleScholar,
      });
      
      const updatedUser = await storage.updateUser(userId, validated);
      
      res.json({ 
        user: { 
          id: updatedUser.id, 
          email: updatedUser.email, 
          name: updatedUser.name, 
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          title: updatedUser.title,
          jobTitle: updatedUser.jobTitle,
          specialty: updatedUser.specialty,
          bio: updatedUser.bio,
          phone: updatedUser.phone,
          linkedIn: updatedUser.linkedIn,
          googleScholar: updatedUser.googleScholar,
          role: updatedUser.role 
        } 
      });
    } catch (error) {
      console.error("[ERROR] Update profile failed:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update profile" });
    }
  });

  // Avatar upload route
  app.post("/api/users/avatar", requireAuth, avatarUpload.single("avatar"), async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      
      if (!req.file) {
        return res.status(400).json({ message: "No file provided" });
      }

      // Store avatar file locally
      const avatarDir = path.join(process.cwd(), "uploads", "avatars");
      await mkdir(avatarDir, { recursive: true });
      
      // Create a filename
      const ext = path.extname(req.file.originalname) || '.png';
      const filename = `${userId}${ext}`;
      const filepath = path.join(avatarDir, filename);
      
      // Write file
      await writeFile(filepath, req.file.buffer);
      
      // Create public URL
      const imageUrl = `/uploads/avatars/${filename}`;
      
      // Update user with avatar URL
      const updatedUser = await storage.updateUser(userId, { image: imageUrl });
      
      res.json({ 
        imageUrl,
        user: updatedUser
      });
    } catch (error) {
      console.error("[ERROR] Avatar upload failed:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to upload avatar" });
    }
  });

  // User preferences route
  app.patch("/api/users/preferences", requireAuth, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const preferences = req.body;
      
      const updatedUser = await storage.updateUser(userId, { preferences });
      
      res.json({ success: true });
    } catch (error) {
      console.error("[ERROR] Update preferences failed:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update preferences" });
    }
  });

  // Get user's clinics
  app.get("/api/clinics", requireAuth, async (req, res) => {
    try {
      const clinicId = (req.session as any).clinicId;
      if (!clinicId) {
        return res.json([]);
      }
      const clinic = await storage.getClinic(clinicId);
      res.json(clinic ? [clinic] : []);
    } catch (error) {
      console.error("[ERROR] Get clinics failed:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to get clinics" });
    }
  });

  // Clinic update route
  app.patch("/api/clinics/update", requireAuth, async (req, res) => {
    try {
      const clinicId = (req.session as any).clinicId;
      const { name, city } = req.body;
      
      if (!clinicId) {
        return res.status(400).json({ message: "No clinic associated with user" });
      }
      
      const updatedClinic = await storage.updateClinic(clinicId, { name, city });
      
      res.json({ clinic: updatedClinic });
    } catch (error) {
      console.error("[ERROR] Update clinic failed:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update clinic" });
    }
  });

  // Dashboard routes  
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    try {
      const clinicId = (req.session as any).clinicId;
      
      // Parse optional filters from query params
      const filters: any = {};
      
      if (req.query.clinicIds) {
        filters.clinicIds = Array.isArray(req.query.clinicIds) 
          ? req.query.clinicIds 
          : [req.query.clinicIds];
      } else if (req.query.myClinicOnly === 'true' && clinicId) {
        filters.clinicIds = [clinicId];
      }
      
      if (req.query.geoZones) {
        filters.geoZones = Array.isArray(req.query.geoZones) 
          ? req.query.geoZones 
          : [req.query.geoZones];
      }
      
      if (req.query.states) {
        filters.states = Array.isArray(req.query.states) 
          ? req.query.states 
          : [req.query.states];
      }
      
      if (req.query.species) {
        filters.species = Array.isArray(req.query.species) 
          ? req.query.species 
          : [req.query.species];
      }
      
      if (req.query.tumourTypeIds) {
        filters.tumourTypeIds = Array.isArray(req.query.tumourTypeIds) 
          ? req.query.tumourTypeIds 
          : [req.query.tumourTypeIds];
      }
      
      if (req.query.from) filters.from = req.query.from as string;
      if (req.query.to) filters.to = req.query.to as string;
      
      // Debug: log the filters being applied
      console.log("[Dashboard Stats] Filters applied:", JSON.stringify(filters, null, 2));
      
      // Use shared stats with optional filters
      const stats = await storage.getSharedDashboardStats(filters);
      res.json(stats);
    } catch (error) {
      console.error("[ERROR] Dashboard stats failed:", error);
      // Return empty stats instead of 500
      res.json({
        totals: { totalCases: 0, newThisMonth: 0, remissionRate: 0, activeClinics: 0 },
        casesByMonth: [],
        topTumourTypes: [],
        warning: "Failed to load dashboard stats"
      });
    }
  });

  // Get clinic stats for the Active Clinics drawer
  app.get("/api/dashboard/clinic-stats", requireAuth, async (req, res) => {
    try {
      const clinicStats = await storage.getClinicStats();
      res.json(clinicStats);
    } catch (error) {
      console.error("[ERROR] Clinic stats failed:", error);
      res.status(500).json({ message: "Failed to load clinic statistics" });
    }
  });

  // Analytics routes
  app.get("/api/analytics/stats", requireAuth, async (req, res) => {
    try {
      const clinicId = (req.session as any).clinicId;
      
      // Parse optional filters from query params
      const filters: any = {};
      
      if (req.query.clinicIds) {
        filters.clinicIds = Array.isArray(req.query.clinicIds) 
          ? req.query.clinicIds 
          : [req.query.clinicIds];
      } else if (req.query.myClinicOnly === 'true' && clinicId) {
        filters.clinicIds = [clinicId];
      }
      
      if (req.query.geoZones) {
        filters.geoZones = Array.isArray(req.query.geoZones) 
          ? req.query.geoZones 
          : [req.query.geoZones];
      }
      
      if (req.query.states) {
        filters.states = Array.isArray(req.query.states) 
          ? req.query.states 
          : [req.query.states];
      }
      
      if (req.query.species) {
        filters.species = Array.isArray(req.query.species) 
          ? req.query.species 
          : [req.query.species];
      }
      
      if (req.query.tumourTypeIds) {
        filters.tumourTypeIds = Array.isArray(req.query.tumourTypeIds) 
          ? req.query.tumourTypeIds 
          : [req.query.tumourTypeIds];
      }
      
      if (req.query.from) filters.from = req.query.from as string;
      if (req.query.to) filters.to = req.query.to as string;
      
      // Use shared analytics stats with optional filters
      const stats = await storage.getSharedAnalyticsStats(filters);
      res.json(stats);
    } catch (error) {
      console.error("[ERROR] Analytics stats failed:", error);
      // Return empty stats instead of 500
      res.json({
        totals: { totalCases: 0, newThisMonth: 0, remissionRate: 0, activeClinics: 0 },
        casesOverTime: [],
        tumourDistribution: [],
        warning: "Failed to load analytics stats"
      });
    }
  });

  // Cases routes
  app.get("/api/cases", async (req, res) => {
    try {
      // Guard the session
      if (!(req.session as any)?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const userId = (req.session as any).userId;
      let clinicId = (req.session as any).clinicId;

      // Always have a clinicId - auto-create if missing
      if (!clinicId) {
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }

        // Create a default clinic
        const defaultClinic = await storage.createClinic({
          name: `${user.name}'s Clinic`,
          state: 'LAGOS' as any, // default state
          city: '',
        });

        // Update the user to that clinic
        await storage.updateUser(userId, { clinicId: defaultClinic.id });
        
        // Update session
        (req.session as any).clinicId = defaultClinic.id;
        clinicId = defaultClinic.id;
      }
      
      const filters = filterSchema.parse(req.query);
      
      // Normalize zone/state/tumourTypeId/clinicId to arrays for filtering
      const normalizeToArray = (val: string | string[] | undefined) => {
        if (!val) return undefined;
        return Array.isArray(val) ? val : [val];
      };
      
      const zones = normalizeToArray(filters.zone);
      
      // Shared reads - all authenticated users see all cases
      const cases = await storage.getCases(undefined, {
        ...filters,
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        // Multi-clinic filter support
        clinicIds: normalizeToArray(filters.clinicId),
        zones: zones,
        states: normalizeToArray(filters.state),
        tumourTypeIds: normalizeToArray(filters.tumourTypeId),
        sort: filters.sort || 'date',
        order: filters.order || 'desc',
      });
      
      res.json(cases);
    } catch (error) {
      console.error("[cases.list]", error);
      res.status(500).json({ message: "Failed to get cases" });
    }
  });

  app.get("/api/cases/:id", requireAuth, async (req, res) => {
    try {
      // Shared reads - any authenticated user can view any case
      const caseData = await storage.getCase(req.params.id);
      
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      res.json(caseData);
    } catch (error) {
      res.status(500).json({ message: "Failed to get case" });
    }
  });

  app.post("/api/cases", requireAuth, async (req, res) => {
    try {
      const clinicId = (req.session as any).clinicId;
      const userId = (req.session as any).userId;
      
      // Apply mutual exclusivity rules for tumour type and anatomical site
      let tumourTypeId = req.body.tumourTypeId || null;
      let tumourTypeCustom = req.body.tumourTypeCustom || null;
      let anatomicalSiteId = req.body.anatomicalSiteId || null;
      let anatomicalSiteCustom = req.body.anatomicalSiteCustom || null;
      
      // If id is provided, clear custom (id takes precedence)
      if (tumourTypeId) {
        tumourTypeCustom = null;
      }
      if (anatomicalSiteId) {
        anatomicalSiteCustom = null;
      }
      
      // Transform data before validation
      const transformedData = {
        ...req.body,
        species: normalizeSpecies(req.body.species),
        clinicId,
        createdBy: userId,
        diagnosisDate: new Date(req.body.diagnosisDate),
        treatmentStart: req.body.treatmentStart ? new Date(req.body.treatmentStart) : null,
        tumourTypeId,
        tumourTypeCustom,
        anatomicalSiteId,
        anatomicalSiteCustom,
      };
      
      const caseData = insertCaseSchema.parse(transformedData);
      
      const newCase = await storage.createCase(caseData);
      
      // Create notification for all clinic users (non-blocking)
      try {
        const clinicUsers = await storage.getUsersByClinic(clinicId);
        for (const user of clinicUsers) {
          const notification = await storage.createNotification({
            userId: user.id,
            type: 'CASE_UPDATED',
            title: user.id === userId ? 'Case Created' : 'New Case Created',
            message: user.id === userId 
              ? `You created a new case "${newCase.patientName || 'Case ' + newCase.caseNumber}"`
              : `A new case "${newCase.patientName || 'Case ' + newCase.caseNumber}" has been created`,
            linkUrl: `/cases/${newCase.id}`,
            metadata: { caseId: newCase.id },
          });
          
          // Send real-time notification via WebSocket
          if (notificationManager) {
            notificationManager.sendNotification(user.id, notification);
          }
        }
      } catch (notifError) {
        console.error("[WARNING] Failed to create notifications:", notifError);
        // Don't block case creation if notifications fail
      }
      
      await storage.createAuditLog({
        actorId: userId,
        clinicId,
        entityType: 'CASE',
        entityId: newCase.id,
        action: 'CREATE',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      res.json(newCase);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create case" });
    }
  });

  const updateCaseHandler = async (req: any, res: any) => {
    try {
      const clinicId = (req.session as any).clinicId;
      const userId = (req.session as any).userId;
      
      if (!clinicId || !userId) {
        return res.status(401).json({ message: "Session invalid" });
      }
      
      // Apply mutual exclusivity rules for tumour type and anatomical site
      let tumourTypeId = req.body.tumourTypeId || null;
      let tumourTypeCustom = req.body.tumourTypeCustom || null;
      let anatomicalSiteId = req.body.anatomicalSiteId || null;
      let anatomicalSiteCustom = req.body.anatomicalSiteCustom || null;
      
      // If id is provided, clear custom (id takes precedence)
      if (tumourTypeId) {
        tumourTypeCustom = null;
      }
      if (anatomicalSiteId) {
        anatomicalSiteCustom = null;
      }
      
      // Transform data before validation for updates
      const transformedUpdates = {
        ...req.body,
        species: req.body.species ? normalizeSpecies(req.body.species) : undefined,
        diagnosisDate: req.body.diagnosisDate ? new Date(req.body.diagnosisDate) : undefined,
        treatmentStart: req.body.treatmentStart ? new Date(req.body.treatmentStart) : undefined,
        tumourTypeId,
        tumourTypeCustom,
        anatomicalSiteId,
        anatomicalSiteCustom,
      };
      
      const updates = insertCaseSchema.partial().parse(transformedUpdates);
      
      await storage.updateCase(req.params.id, updates, clinicId);
      
      // Fetch the updated case with all details
      const updatedCase = await storage.getCase(req.params.id, clinicId);
      
      if (!updatedCase) {
        return res.status(404).json({ message: "Case not found after update" });
      }
      
      // Create notification for all clinic users (non-blocking)
      try {
        const clinicUsers = await storage.getUsersByClinic(clinicId);
        for (const user of clinicUsers) {
          const notification = await storage.createNotification({
            userId: user.id,
            type: 'CASE_UPDATED',
            title: user.id === userId ? 'Case Updated' : 'Case Updated',
            message: user.id === userId
              ? `You updated case "${updatedCase.patientName || 'Case ' + updatedCase.caseNumber}"`
              : `Case "${updatedCase.patientName || 'Case ' + updatedCase.caseNumber}" has been updated`,
            linkUrl: `/cases/${updatedCase.id}`,
            metadata: { caseId: updatedCase.id },
          });
          
          // Send real-time notification via WebSocket
          if (notificationManager) {
            notificationManager.sendNotification(user.id, notification);
          }
        }
      } catch (notifError) {
        console.error("[WARNING] Failed to create notifications:", notifError);
        // Don't block case update if notifications fail
      }
      
      await storage.createAuditLog({
        actorId: userId,
        clinicId,
        entityType: 'CASE',
        entityId: req.params.id,
        action: 'UPDATE',
        diff: { after: updates },
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      res.json(updatedCase);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update case" });
    }
  };

  app.put("/api/cases/:id", requireAuth, updateCaseHandler);
  app.patch("/api/cases/:id", requireAuth, updateCaseHandler);

  app.delete("/api/cases/:id", requireAuth, async (req, res) => {
    try {
      const clinicId = (req.session as any).clinicId;
      const userId = (req.session as any).userId;
      
      if (!clinicId || !userId) {
        return res.status(401).json({ message: "Session invalid" });
      }

      // Get the case without clinic restriction to check ownership
      const caseData = await storage.getCase(req.params.id);
      
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }

      // Check permission
      const user = await storage.getUser(userId);
      const isCreator = caseData.createdBy && caseData.createdBy.id === userId;
      const isAdmin = user?.role === 'ADMIN';
      const isManager = user?.role === 'MANAGER';
      const isSameClinic = caseData.clinic && caseData.clinic.id === clinicId;

      // Allow if:
      // 1. User is ADMIN (can delete any case from any clinic)
      // 2. User is MANAGER from the same clinic
      // 3. User is the creator of the case from the same clinic
      if (!isAdmin && !isSameClinic) {
        return res.status(403).json({ message: "Cannot access cases from other clinics" });
      }

      if (!isAdmin && !isManager && !isCreator) {
        return res.status(403).json({ message: "Only case creator or admins can delete cases" });
      }
      
      const caseNumber = caseData.caseNumber;
      await storage.deleteCase(req.params.id, clinicId);
      
      // Create notification for all clinic users (non-blocking)
      try {
        const clinicUsers = await storage.getUsersByClinic(clinicId);
        for (const user of clinicUsers) {
          const notification = await storage.createNotification({
            userId: user.id,
            type: 'CASE_UPDATED',
            title: user.id === userId ? 'Case Deleted' : 'Case Deleted',
            message: user.id === userId
              ? `You deleted case "${caseData.patientName || 'Case ' + caseNumber}"`
              : `Case "${caseData.patientName || 'Case ' + caseNumber}" has been deleted`,
            linkUrl: undefined,
            metadata: { caseId: req.params.id },
          });
          
          // Send real-time notification via WebSocket
          if (notificationManager) {
            notificationManager.sendNotification(user.id, notification);
          }
        }
      } catch (notifError) {
        console.error("[WARNING] Failed to create notifications:", notifError);
        // Don't block case deletion if notifications fail
      }
      
      await storage.createAuditLog({
        actorId: userId,
        clinicId,
        entityType: 'CASE',
        entityId: req.params.id,
        action: 'DELETE',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      res.json({ message: "Case deleted successfully" });
    } catch (error) {
      console.error("Delete case error:", error);
      res.status(500).json({ message: "Failed to delete case" });
    }
  });

  // Export cases route
  app.post("/api/cases/export", requireAuth, async (req, res) => {
    try {
      const clinicId = (req.session as any).clinicId;
      const userId = (req.session as any).userId;
      const { format, filters } = req.body;

      if (!format || !['csv', 'pdf', 'xlsx'].includes(format)) {
        return res.status(400).json({ message: "Invalid format. Use 'csv', 'pdf' or 'xlsx'" });
      }

      // Parse filters - map frontend filter names to API filter names
      // IMPORTANT: Only apply clinic filter if user explicitly filtered by clinic
      // Otherwise export ALL cases (no clinic restriction)
      const apiFilters: any = {};
      if (filters) {
        if (filters.zone && filters.zone.length) apiFilters.zones = filters.zone;
        if (filters.state && filters.state.length) apiFilters.states = filters.state;
        // Only apply clinic filter if explicitly set by user
        if (filters.clinicId && filters.clinicId.length) {
          apiFilters.clinicIds = filters.clinicId;
        }
        if (filters.tumourTypeId && filters.tumourTypeId.length) apiFilters.tumourTypeIds = filters.tumourTypeId;
        // Add support for species, outcome, and dates
        if (filters.species) apiFilters.species = filters.species;
        if (filters.outcome) apiFilters.outcome = filters.outcome;
        if (filters.startDate) apiFilters.startDate = filters.startDate;
        if (filters.endDate) apiFilters.endDate = filters.endDate;
      }
      // Note: No automatic clinic restriction - export all cases unless user explicitly filtered

      // Get cases with full details - fetch all matching cases without pagination for export
      // Fetch all cases by getting a large number (no effective limit)
      const casesForExport = await storage.getCases(undefined, { ...apiFilters, limit: 999999, offset: 0 });

      if (format === 'csv') {
        // Build CSV content manually for reliable export
        const outcomeLabels: Record<string, string> = {
          'REMISSION': 'Remission',
          'TREATMENT_ONGOING': 'Ongoing Treatment',
          'MORTALITY': 'Mortality',
          'EUTHANASIA': 'Euthanasia',
          'MANAGEMENT': 'Management',
          'DECEASED': 'Deceased',
          'LOST_TO_FOLLOWUP': 'Lost to Follow-up',
        };

        const headers = ['Case ID', 'Upload Date', 'Patient Name', 'Species', 'Breed', 'Age', 'Sex', 'Tumour Type', 'Anatomical Site', 'Stage', 'State', 'Clinic', 'Status', 'Diagnosis Date', 'Diagnosis Method'];
        
        const rows = casesForExport.map((c: any) => [
          c.caseNumber || '',
          c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '',
          c.patientName || '',
          c.species || '',
          c.breed || '',
          (c.ageYears ? `${c.ageYears}y` : '') + (c.ageMonths ? ` ${c.ageMonths}m` : ''),
          c.sex || '',
          c.tumourType?.name || c.tumourTypeCustom || '',
          c.anatomicalSite?.name || c.anatomicalSiteCustom || '',
          c.stage || '',
          c.state || '',
          c.clinic?.name || '',
          outcomeLabels[c.outcome as string] || c.outcome || '',
          c.diagnosisDate ? new Date(c.diagnosisDate).toLocaleDateString() : '',
          c.diagnosisMethod || ''
        ]);

        // Escape CSV values
        const escapeCsvValue = (value: string): string => {
          if (!value) return '';
          const needsQuotes = /[",\n\r]/.test(value);
          const escaped = value.replace(/"/g, '""');
          return needsQuotes ? `"${escaped}"` : escaped;
        };

        const csvContent = [
          headers.map(h => escapeCsvValue(h)).join(','),
          ...rows.map(row => row.map(v => escapeCsvValue(String(v))).join(','))
        ].join('\r\n');

        const blobContent = `\ufeff${csvContent}`;
        res.setHeader('Content-Type', 'text/csv;charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="cases-export-${new Date().toISOString().split('T')[0]}.csv"`);
        
        // Create notification before sending response
        try {
          const clinicUsers = await storage.getUsersByClinic(clinicId);
          const exporter = await storage.getUser(userId);
          for (const user of clinicUsers) {
            const notification = await storage.createNotification({
              userId: user.id,
              type: 'CASE_UPDATED',
              title: user.id === userId ? 'Cases Exported' : 'Cases Exported',
              message: user.id === userId
                ? `You exported ${casesForExport.length} case(s) as CSV`
                : `${exporter?.name} exported ${casesForExport.length} case(s) as CSV`,
              metadata: { caseCount: casesForExport.length, format: 'CSV' },
            });
            if (notificationManager) {
              notificationManager.sendNotification(user.id, notification);
            }
          }
        } catch (notifError) {
          console.error("[WARNING] Failed to create CSV export notification:", notifError);
        }
        
        res.send(blobContent);
      } else if (format === 'xlsx') {
        const outcomeLabels: Record<string, string> = {
          'REMISSION': 'Remission',
          'TREATMENT_ONGOING': 'Ongoing Treatment',
          'MORTALITY': 'Mortality',
          'EUTHANASIA': 'Euthanasia',
          'MANAGEMENT': 'Management',
          'DECEASED': 'Deceased',
          'LOST_TO_FOLLOWUP': 'Lost to Follow-up',
        };

        const wsData = casesForExport.map((c: any) => ({
          'Case ID': c.caseNumber,
          'Upload Date': c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '',
          'Patient Name': c.patientName || '',
          'Species': c.species || '',
          'Breed': c.breed || '',
          'Age': (c.ageYears ? `${c.ageYears}y` : '') + (c.ageMonths ? ` ${c.ageMonths}m` : ''),
          'Sex': c.sex || '',
          'Tumour Type': c.tumourType?.name || c.tumourTypeCustom || '',
          'Anatomical Site': c.anatomicalSite?.name || c.anatomicalSiteCustom || '',
          'Laterality': c.laterality || '',
          'Stage': c.stage || '',
          'State': c.state || '',
          'Clinic': c.clinic?.name || '',
          'Status': outcomeLabels[c.outcome as string] || c.outcome || '',
          'Treatment Plan': c.treatmentPlan || '',
          'Treatment Start': c.treatmentStart ? new Date(c.treatmentStart).toLocaleDateString() : '',
          'Last Follow Up': c.lastFollowUp ? new Date(c.lastFollowUp).toLocaleDateString() : '',
          'Diagnosis Date': c.diagnosisDate ? new Date(c.diagnosisDate).toLocaleDateString() : '',
          'Diagnosis Method': c.diagnosisMethod || '',
        }));

        const ws = XLSX.utils.json_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Cases');
        
        const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="cases-export-${new Date().toISOString().split('T')[0]}.xlsx"`);
        
        // Create notification before sending response
        try {
          const clinicUsers = await storage.getUsersByClinic(clinicId);
          const exporter = await storage.getUser(userId);
          for (const user of clinicUsers) {
            const notification = await storage.createNotification({
              userId: user.id,
              type: 'CASE_UPDATED',
              title: user.id === userId ? 'Cases Exported' : 'Cases Exported',
              message: user.id === userId
                ? `You exported ${casesForExport.length} case(s) as Excel`
                : `${exporter?.name} exported ${casesForExport.length} case(s) as Excel`,
              metadata: { caseCount: casesForExport.length, format: 'XLSX' },
            });
            if (notificationManager) {
              notificationManager.sendNotification(user.id, notification);
            }
          }
        } catch (notifError) {
          console.error("[WARNING] Failed to create XLSX export notification:", notifError);
        }
        
        res.send(buffer);
      } else if (format === 'pdf') {
        const outcomeLabels: Record<string, string> = {
          'REMISSION': 'Remission',
          'TREATMENT_ONGOING': 'Ongoing Treatment',
          'MORTALITY': 'Mortality',
          'EUTHANASIA': 'Euthanasia',
          'MANAGEMENT': 'Management',
          'DECEASED': 'Deceased',
          'LOST_TO_FOLLOWUP': 'Lost to Follow-up',
        };

        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
        });
        
        // Add title
        doc.setFontSize(16);
        doc.setFont('', 'bold');
        doc.text('Veterinary Oncology Cases Report', 14, 15);
        
        // Add metadata
        doc.setFontSize(9);
        doc.setFont('', 'normal');
        doc.setTextColor(100);
        doc.text(`Generated: ${new Date().toLocaleDateString()} | Total Cases: ${casesForExport.length}`, 14, 21);
        doc.setTextColor(0);

        let currentY = 28;
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 12;
        const pageWidth = doc.internal.pageSize.getWidth();
        const maxWidth = pageWidth - 2 * margin;
        const colWidth = maxWidth / 2;

        // Draw each case as a detailed card
        casesForExport.forEach((c: any, idx: number) => {
          // Check if we need a new page
          if (currentY > pageHeight - 40) {
            doc.addPage();
            currentY = 15;
          }

          // Prepare data
          const statusText = outcomeLabels[c.outcome as string] || c.outcome || 'Unknown';
          const diagDate = c.diagnosisDate ? new Date(c.diagnosisDate).toLocaleDateString() : 'N/A';
          const ageStr = (c.ageYears ? `${c.ageYears}y` : '') + (c.ageMonths ? ` ${c.ageMonths}m` : '') || 'N/A';
          const treatment = c.treatmentPlan || 'N/A';
          const diagMethod = c.diagnosisMethod || 'N/A';
          
          // Case card background (increased height to 38mm to fit all data)
          doc.setFillColor(250, 250, 250);
          doc.setDrawColor(220, 220, 220);
          doc.rect(margin, currentY, maxWidth, 38, 'FD');

          // Row 1: Case ID and Animal Status
          doc.setFont('', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(0);
          doc.text(`Case #${c.caseNumber}`, margin + 2, currentY + 4);
          
          doc.setFont('', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(76, 175, 80);
          const statusX = margin + colWidth;
          doc.text(`Animal Status: ${statusText}`, statusX, currentY + 4);

          // Row 2: Patient and Species
          doc.setTextColor(0);
          doc.setFont('', 'bold');
          doc.setFontSize(7);
          doc.text('Patient:', margin + 2, currentY + 9);
          doc.setFont('', 'normal');
          doc.text((c.patientName || 'N/A').substring(0, 22), margin + 18, currentY + 9);

          doc.setFont('', 'bold');
          doc.text('Species:', statusX, currentY + 9);
          doc.setFont('', 'normal');
          doc.text((c.species || 'N/A').substring(0, 18), statusX + 16, currentY + 9);

          // Row 3: Breed and Age
          doc.setFont('', 'bold');
          doc.text('Breed:', margin + 2, currentY + 13);
          doc.setFont('', 'normal');
          doc.text((c.breed || 'N/A').substring(0, 22), margin + 14, currentY + 13);

          doc.setFont('', 'bold');
          doc.text('Age:', statusX, currentY + 13);
          doc.setFont('', 'normal');
          doc.text(ageStr.substring(0, 18), statusX + 11, currentY + 13);

          // Row 4: Clinic and State
          doc.setFont('', 'bold');
          doc.text('Clinic:', margin + 2, currentY + 17);
          doc.setFont('', 'normal');
          doc.text((c.clinic?.name || 'N/A').substring(0, 22), margin + 16, currentY + 17);

          doc.setFont('', 'bold');
          doc.text('State:', statusX, currentY + 17);
          doc.setFont('', 'normal');
          doc.text((c.state || 'N/A').substring(0, 18), statusX + 11, currentY + 17);

          // Row 5: Diagnosis Date and Diagnosis Method
          doc.setFont('', 'bold');
          doc.text('Diagnosis:', margin + 2, currentY + 21);
          doc.setFont('', 'normal');
          doc.text(diagDate, margin + 24, currentY + 21);

          doc.setFont('', 'bold');
          doc.text('Method:', statusX, currentY + 21);
          doc.setFont('', 'normal');
          doc.text(diagMethod.substring(0, 15), statusX + 16, currentY + 21);

          // Row 6: Tumour Type and Treatment
          doc.setFont('', 'bold');
          doc.text('Tumour:', margin + 2, currentY + 25);
          doc.setFont('', 'normal');
          const tumourName = (c.tumourType?.name || c.tumourTypeCustom || 'N/A').substring(0, 22);
          doc.text(tumourName, margin + 16, currentY + 25);

          doc.setFont('', 'bold');
          doc.text('Treatment:', statusX, currentY + 25);
          doc.setFont('', 'normal');
          doc.text(treatment.substring(0, 13), statusX + 23, currentY + 25);

          // Row 7: Anatomical Site
          doc.setFont('', 'bold');
          doc.text('Site:', margin + 2, currentY + 29);
          doc.setFont('', 'normal');
          const siteName = (c.anatomicalSite?.name || c.anatomicalSiteCustom || 'N/A').substring(0, 22);
          doc.text(siteName, margin + 12, currentY + 29);

          doc.setFont('', 'bold');
          doc.text('Stage:', statusX, currentY + 29);
          doc.setFont('', 'normal');
          doc.text((c.stage || 'N/A').substring(0, 18), statusX + 15, currentY + 29);

          // Row 8: Notes (if exists)
          if (c.notes) {
            doc.setFont('', 'bold');
            doc.setFontSize(6.5);
            doc.text('Notes:', margin + 2, currentY + 33);
            doc.setFont('', 'normal');
            doc.text(c.notes.substring(0, 65), margin + 12, currentY + 33);
          }

          currentY += 40;
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="cases-export-${new Date().toISOString().split('T')[0]}.pdf"`);
        
        // Convert to buffer and send
        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
        
        // Create notification before sending response
        try {
          const clinicUsers = await storage.getUsersByClinic(clinicId);
          const exporter = await storage.getUser(userId);
          for (const user of clinicUsers) {
            const notification = await storage.createNotification({
              userId: user.id,
              type: 'CASE_UPDATED',
              title: user.id === userId ? 'Cases Exported' : 'Cases Exported',
              message: user.id === userId
                ? `You exported ${casesForExport.length} case(s) as PDF`
                : `${exporter?.name} exported ${casesForExport.length} case(s) as PDF`,
              metadata: { caseCount: casesForExport.length, format: 'PDF' },
            });
            if (notificationManager) {
              notificationManager.sendNotification(user.id, notification);
            }
          }
        } catch (notifError) {
          console.error("[WARNING] Failed to create PDF export notification:", notifError);
        }
        
        res.send(pdfBuffer);
      }
    } catch (error) {
      console.error("[ERROR] Cases export failed:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to export cases" });
    }
  });

  // Case file routes
  app.post("/api/cases/:caseId/files", requireAuth, caseFileUpload.single('file'), async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const clinicId = (req.session as any).clinicId;
      const { caseId } = req.params;

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Verify case exists and user has access
      const caseData = await storage.getCase(caseId, clinicId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }

      // Check file count limit
      const existingFiles = await storage.getCaseFiles(caseId);
      if (existingFiles.length >= MAX_FILES_PER_CASE) {
        return res.status(400).json({ message: `Maximum ${MAX_FILES_PER_CASE} files per case allowed` });
      }

      // Validate MIME type
      if (!isAllowedMimeType(req.file.mimetype)) {
        return res.status(415).json({ message: "Unsupported file type. Allowed: images and documents (PDF, DOC, CSV)" });
      }

      // Check file size
      if (req.file.size > MAX_FILE_SIZE) {
        return res.status(400).json({ message: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` });
      }

      // Check write permission: creator, same clinic admin, or super admin
      const user = await storage.getUser(userId);
      const isCreator = caseData.createdBy.id === userId;
      const isSuperAdmin = user?.role === 'SUPER_ADMIN';
      const isClinicAdmin = (user?.role === 'ADMIN' || user?.role === 'MANAGER') && user?.clinicId === caseData.clinic.id;
      
      if (!isCreator && !isSuperAdmin && !isClinicAdmin) {
        return res.status(403).json({ message: "Only case creator or clinic admins can upload files" });
      }

      // Read file buffer
      const fileBuffer = await readFile(req.file.path);
      await rm(req.file.path, { force: true });

      // Generate storage key and upload to object storage
      const storageKey = generateStorageKey(caseId, req.file.originalname);
      const { publicUrl } = await putObject({
        key: storageKey,
        buffer: fileBuffer,
        contentType: req.file.mimetype,
      });

      // Determine file kind
      const kind = determineFileKind(req.file.mimetype);

      // Save to database
      const caseFile = insertCaseFileSchema.parse({
        caseId,
        kind,
        storageKey,
        publicUrl,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        uploadedBy: userId,
      });

      const savedFile = await storage.createCaseFile(caseFile);

      // Create notification for clinic users (non-blocking)
      try {
        const clinicUsers = await storage.getUsersByClinic(clinicId);
        for (const user of clinicUsers) {
          const notification = await storage.createNotification({
            userId: user.id,
            type: 'CASE_UPDATED',
            title: user.id === userId ? 'File Uploaded' : 'File Uploaded to Case',
            message: user.id === userId
              ? `You uploaded "${req.file!.originalname}" to case "${caseData.patientName || 'Case ' + caseData.caseNumber}"`
              : `A file "${req.file!.originalname}" was uploaded to case "${caseData.patientName || 'Case ' + caseData.caseNumber}"`,
            linkUrl: `/cases/${caseId}`,
            metadata: { caseId, fileId: savedFile.id, fileName: req.file!.originalname },
          });
          
          if (notificationManager) {
            notificationManager.sendNotification(user.id, notification);
          }
        }
      } catch (notifError) {
        console.error("[WARNING] Failed to create file upload notification:", notifError);
      }

      await storage.createAuditLog({
        actorId: userId,
        clinicId,
        entityType: 'CASE_FILE',
        entityId: savedFile.id,
        action: 'CREATE',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.status(201).json(savedFile);
    } catch (error) {
      console.error('File upload error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to upload file" });
    }
  });

  app.get("/api/cases/:caseId/files", requireAuth, async (req, res) => {
    try {
      const clinicId = (req.session as any).clinicId;
      const { caseId } = req.params;

      // Verify case exists and user has access
      const caseData = await storage.getCase(caseId, clinicId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }

      const files = await storage.getCaseFiles(caseId);
      res.json(files);
    } catch (error) {
      res.status(500).json({ message: "Failed to get files" });
    }
  });

  app.get("/api/cases/:caseId/files/:fileId/download", requireAuth, async (req, res) => {
    try {
      const clinicId = (req.session as any).clinicId;
      const { caseId, fileId } = req.params;

      // Verify case exists and user has access
      const caseData = await storage.getCase(caseId, clinicId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }

      // Get file metadata
      const file = await storage.getCaseFileById(fileId);
      if (!file || file.caseId !== caseId) {
        return res.status(404).json({ message: "File not found" });
      }

      // Retrieve file from storage
      const { buffer, contentType } = await getObject({ key: file.storageKey });

      // Set headers for download
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
      res.setHeader('Content-Length', buffer.length);

      // Stream file to client
      res.send(buffer);
    } catch (error) {
      console.error('File download error:', error);
      res.status(500).json({ message: "Failed to download file" });
    }
  });

  app.delete("/api/cases/:caseId/files/:fileId", requireAuth, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const clinicId = (req.session as any).clinicId;
      const { caseId, fileId } = req.params;

      // Verify case exists and user has access
      const caseData = await storage.getCase(caseId, clinicId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }

      // Verify file exists
      const file = await storage.getCaseFileById(fileId);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      // Check write permission: creator, same clinic admin, or super admin
      const user = await storage.getUser(userId);
      const isCreator = caseData.createdBy.id === userId;
      const isSuperAdmin = user?.role === 'SUPER_ADMIN';
      const isClinicAdmin = (user?.role === 'ADMIN' || user?.role === 'MANAGER') && user?.clinicId === caseData.clinic.id;
      
      if (!isCreator && !isSuperAdmin && !isClinicAdmin) {
        return res.status(403).json({ message: "Only case creator, clinic admins, or super admins can delete files" });
      }

      // Soft delete
      await storage.softDeleteCaseFile(fileId);

      await storage.createAuditLog({
        actorId: userId,
        clinicId,
        entityType: 'CASE_FILE',
        entityId: fileId,
        action: 'DELETE',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json({ message: "File deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete file" });
    }
  });

  // Vocabulary routes
  app.get("/api/vocabulary/tumour-types", requireAuth, async (req, res) => {
    try {
      const clinicId = (req.session as any).clinicId;
      const { species } = req.query;
      
      const tumourTypes = await storage.getTumourTypes(clinicId, species as string);
      res.json(tumourTypes);
    } catch (error) {
      res.status(500).json({ message: "Failed to get tumour types" });
    }
  });

  app.post("/api/vocabulary/tumour-types", requireAuth, async (req, res) => {
    try {
      const clinicId = (req.session as any).clinicId;
      const userId = (req.session as any).userId;
      
      const tumourType = insertTumourTypeSchema.parse({
        ...req.body,
        clinicId,
        createdBy: userId,
      });
      
      const newType = await storage.createTumourType(tumourType);
      res.json(newType);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create tumour type" });
    }
  });

  app.get("/api/vocabulary/anatomical-sites", requireAuth, async (req, res) => {
    try {
      const clinicId = (req.session as any).clinicId;
      const { species } = req.query;
      
      const sites = await storage.getAnatomicalSites(clinicId, species as string);
      res.json(sites);
    } catch (error) {
      res.status(500).json({ message: "Failed to get anatomical sites" });
    }
  });

  app.post("/api/vocabulary/anatomical-sites", requireAuth, async (req, res) => {
    try {
      const clinicId = (req.session as any).clinicId;
      const userId = (req.session as any).userId;
      
      const site = insertAnatomicalSiteSchema.parse({
        ...req.body,
        clinicId,
        createdBy: userId,
      });
      
      const newSite = await storage.createAnatomicalSite(site);
      res.json(newSite);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create anatomical site" });
    }
  });

  // Lookup endpoints for filters
  app.get("/api/lookups/ng-states", requireAuth, async (req, res) => {
    try {
      const states = await storage.getNigerianStates();
      res.json(states);
    } catch (error) {
      res.status(500).json({ message: "Failed to get states" });
    }
  });

  app.get("/api/lookups/clinics", requireAuth, async (req, res) => {
    try {
      const clinics = await storage.getClinicsList();
      res.json(clinics);
    } catch (error) {
      res.status(500).json({ message: "Failed to get clinics" });
    }
  });

  app.get("/api/lookups/tumour-types", requireAuth, async (req, res) => {
    try {
      const tumourTypes = await storage.getTumourTypesList();
      res.json(tumourTypes);
    } catch (error) {
      res.status(500).json({ message: "Failed to get tumour types" });
    }
  });

  // Analytics - Cases by location (geographic distribution)
  app.get("/api/analytics/cases-by-location", requireAuth, async (req, res) => {
    try {
      const clinicId = (req.session as any).clinicId;
      const userId = (req.session as any).userId;
      const user = await storage.getUser(userId);
      
      // Build filters from query params
      const filters: any = {};
      
      if (req.query.startDate) filters.from = req.query.startDate as string;
      if (req.query.endDate) filters.to = req.query.endDate as string;
      if (req.query.species) filters.species = req.query.species as string;
      if (req.query.tumourType) filters.tumourTypeId = (req.query.tumourType as string).split(',');
      
      // For non-SUPER_ADMIN users, restrict to their clinic
      if (user?.role !== "SUPER_ADMIN") {
        filters.clinicIds = [clinicId];
      } else if (req.query.clinicId) {
        // SUPER_ADMIN can filter by specific clinic(s)
        const clinicIds = typeof req.query.clinicId === 'string' 
          ? req.query.clinicId.split(',')
          : Array.isArray(req.query.clinicId) ? req.query.clinicId : [];
        if (clinicIds.length > 0) filters.clinicIds = clinicIds;
      }
      
      const locationData = await storage.getCasesByLocation(filters);
      
      const totalCases = locationData.reduce((sum, d) => sum + d.caseCount, 0);
      
      res.json({
        data: locationData,
        meta: {
          totalCases,
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error("[ERROR] cases-by-location failed:", error);
      res.status(500).json({ 
        data: [],
        meta: { totalCases: 0, generatedAt: new Date().toISOString() },
        error: "Failed to fetch location data"
      });
    }
  });

  // Analytics - Zone detailed statistics
  app.get("/api/analytics/zone-stats", requireAuth, async (req, res) => {
    try {
      const zone = req.query.zone as string;
      const speciesFilter = req.query.species as string;
      if (!zone) {
        return res.status(400).json({ error: "Zone parameter required" });
      }

      const clinicId = (req.session as any).clinicId;
      const userId = (req.session as any).userId;
      const user = await storage.getUser(userId);
      
      const filters: any = { geoZones: [zone] };
      
      if (speciesFilter && speciesFilter !== "both") {
        filters.species = [speciesFilter];
      }
      
      // For non-SUPER_ADMIN users, restrict to their clinic
      if (user?.role !== "SUPER_ADMIN") {
        filters.clinicIds = [clinicId];
      }
      
      const zoneStats = await storage.getZoneStats(filters);
      
      res.json(zoneStats);
    } catch (error) {
      console.error("[ERROR] zone-stats failed:", error);
      res.status(500).json({ 
        error: "Failed to fetch zone stats",
        tumours: [],
        species: [],
        statuses: [],
        breeds: []
      });
    }
  });

  // Analytics - State detailed statistics
  app.get("/api/analytics/state-stats", requireAuth, async (req, res) => {
    try {
      const state = req.query.state as string;
      const speciesFilter = req.query.species as string;
      if (!state) {
        return res.status(400).json({ error: "State parameter required" });
      }

      const clinicId = (req.session as any).clinicId;
      const userId = (req.session as any).userId;
      const user = await storage.getUser(userId);
      
      const filters: any = { states: [state] };
      
      if (speciesFilter && speciesFilter !== "both") {
        filters.species = [speciesFilter];
      }
      
      // For non-SUPER_ADMIN users, restrict to their clinic
      if (user?.role !== "SUPER_ADMIN") {
        filters.clinicIds = [clinicId];
      }
      
      const stateStats = await storage.getStateStats(filters);
      
      res.json(stateStats);
    } catch (error) {
      console.error("[ERROR] state-stats failed:", error);
      res.status(500).json({ 
        error: "Failed to fetch state stats",
        tumours: [],
        species: [],
        breeds: []
      });
    }
  });

  // Analytics - Survival Analysis (Kaplan-Meier)
  app.get("/api/analytics/survival", requireAuth, async (req, res) => {
    try {
      const clinicId = (req.session as any).clinicId;
      const userId = (req.session as any).userId;
      const user = await storage.getUser(userId);

      // Build filters
      const filters: any = { statuses: ["ACTIVE", "COMPLETED"] };
      
      if (req.query.species) {
        filters.species = Array.isArray(req.query.species) ? req.query.species : [req.query.species];
      }
      if (req.query.tumourType) {
        const tt = Array.isArray(req.query.tumourType) ? req.query.tumourType[0] : req.query.tumourType;
        if (tt) filters.tumourTypeIds = [tt];
      }
      if (req.query.stage) {
        filters.stages = Array.isArray(req.query.stage) ? req.query.stage : [req.query.stage];
      }
      
      // Date range filtering
      if (req.query.startDate) {
        filters.startDate = new Date(req.query.startDate as string);
      }
      if (req.query.endDate) {
        filters.endDate = new Date(req.query.endDate as string);
      }

      // For non-SUPER_ADMIN users, restrict to their clinic
      if (user?.role !== "SUPER_ADMIN") {
        filters.clinicIds = [clinicId];
      } else if (req.query.clinicId) {
        const clinicIds = Array.isArray(req.query.clinicId) ? req.query.clinicId : [req.query.clinicId];
        if (clinicIds.length > 0) filters.clinicIds = clinicIds;
      }

      // Get all matching cases
      const cases = await storage.getCases(filters);

      // Filter for cases with both diagnosis date and follow-up/outcome info
      const validCases = cases.filter(c => 
        c.diagnosisDate && (c.lastFollowUp || c.outcome)
      );

      if (validCases.length === 0) {
        return res.json({
          data: [],
          meta: { nAtRisk: 0, nEvents: 0, nCensored: 0 }
        });
      }

      // Calculate survival times (in days) and events
      const survivalData = validCases.map(c => {
        const diagDate = new Date(c.diagnosisDate).getTime();
        const followUpDate = c.lastFollowUp ? new Date(c.lastFollowUp).getTime() : new Date().getTime();
        const timeDays = Math.ceil((followUpDate - diagDate) / (1000 * 60 * 60 * 24));
        
        // Event = 1 if mortality/euthanasia, 0 if censored
        const isEvent = c.outcome === "MORTALITY" || c.outcome === "EUTHANASIA" ? 1 : 0;
        
        return {
          time: Math.max(1, timeDays), // At least 1 day
          event: isEvent,
          outcome: c.outcome
        };
      });

      // Sort by time
      survivalData.sort((a, b) => a.time - b.time);

      // Calculate Kaplan-Meier curve
      let nAtRisk = survivalData.length;
      let cumSurvival = 1;
      const kmCurve: Array<{ time: number; survival: number }> = [];
      const uniqueTimes = new Set(survivalData.map(d => d.time));

      for (const timePoint of Array.from(uniqueTimes).sort((a, b) => a - b)) {
        const pointData = survivalData.filter(d => d.time === timePoint);
        const nEvents = pointData.filter(d => d.event === 1).length;
        
        if (nAtRisk > 0) {
          cumSurvival *= (1 - nEvents / nAtRisk);
          kmCurve.push({ 
            time: timePoint, 
            survival: cumSurvival * 100 
          });
        }
        
        nAtRisk -= pointData.length;
      }

      // Add starting point
      if (kmCurve.length > 0) {
        kmCurve.unshift({ time: 0, survival: 100 });
      }

      const nEvents = survivalData.filter(d => d.event === 1).length;
      const nCensored = validCases.length - nEvents;

      res.json({
        data: kmCurve,
        meta: {
          nAtRisk: validCases.length,
          nEvents,
          nCensored,
          totalCases: validCases.length
        }
      });
    } catch (error) {
      console.error("[ERROR] survival analysis failed:", error);
      res.status(500).json({ 
        error: "Failed to calculate survival analysis",
        data: [],
        meta: { nAtRisk: 0, nEvents: 0, nCensored: 0 }
      });
    }
  });

  // Import/Bulk upload routes
  app.post("/api/imports/upload", requireAuth, requireRole("MANAGER"), bulkUpload.single('file'), async (req, res) => {
    try {
      const clinicId = (req.session as any).clinicId;
      const userId = (req.session as any).userId;

      if (!req.file) {
        return res.status(400).json({ success: false, error: "No file uploaded" });
      }

      const sanitizedName = req.file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const savedFileName = `${Date.now()}-${sanitizedName}`;
      const relativeFilePath = path.join('uploads', savedFileName);
      const absoluteFilePath = path.resolve(import.meta.dirname, '..', relativeFilePath);

      await mkdir(path.dirname(absoluteFilePath), { recursive: true });
      await writeFile(absoluteFilePath, req.file.buffer);

      const importJob = await storage.createImportJob({
        clinicId,
        createdBy: userId,
        filename: req.file.originalname,
        fileUrl: relativeFilePath,
        mapping: {},
        status: 'PENDING',
        totalRows: 0,
        processedRows: 0,
        successRows: 0,
      });

      return res.json({ success: true, import_id: importJob.id });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to upload file" });
    }
  });

  app.post("/api/imports/:id/start", requireAuth, async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    
    try {
      const importId = req.params.id;
      const clinicId = (req.session as any).clinicId;
      const userId = (req.session as any).userId;
      
      const importJob = await storage.getImportJobById(importId);
      if (!importJob || importJob.clinicId !== clinicId) {
        return res.status(404).json({ success: false, error: "Import job not found" });
      }

      await storage.updateImportJob(importId, {
        status: 'PROCESSING',
        processedRows: 0,
        successRows: 0,
        errorRows: 0,
        errors: []
      });

      res.json({ success: true, message: 'Import started' });

      // Process import asynchronously
      setImmediate(async () => {
        try {
          const absoluteFilePath = path.resolve(import.meta.dirname, '..', importJob.fileUrl);
          
          // Parse CSV file
          const { parseCSVFile } = await import('./csv-import.js');
          const parseResult = await parseCSVFile(absoluteFilePath, clinicId, userId);

          if (!parseResult.success) {
            await storage.updateImportJob(importId, {
              status: 'FAILED',
              errors: [{ row: 0, error: parseResult.error || 'CSV parsing failed' }],
              completedAt: new Date()
            });
            return;
          }

          if (parseResult.totalRows === 0) {
            await storage.updateImportJob(importId, {
              status: 'FAILED',
              errors: [{ row: 0, error: 'File is empty or contains no valid data rows' }],
              completedAt: new Date()
            });
            return;
          }

          // Update total rows count
          await storage.updateImportJob(importId, { 
            totalRows: parseResult.totalRows 
          });

          const errors: Array<{row: number; error: string}> = [];
          let successCount = 0;
          let failedCount = 0;
          const BATCH_SIZE = 10;

          // Process rows in batches with progress updates
          for (let i = 0; i < parseResult.rows.length; i++) {
            const parsedRow = parseResult.rows[i];
            
            if (parsedRow.error) {
              errors.push({ row: i + 2, error: parsedRow.error });
              failedCount++;
            } else {
              try {
                // Normalize species before creating case
                const caseData = {
                  ...parsedRow.data,
                  species: normalizeSpecies(parsedRow.data.species),
                };
                await storage.createCase(caseData as any);
                successCount++;
              } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Unknown error creating case';
                errors.push({ row: i + 2, error: errorMsg });
                failedCount++;
              }
            }

            // Update progress every BATCH_SIZE rows
            if ((i + 1) % BATCH_SIZE === 0 || i === parseResult.rows.length - 1) {
              await storage.updateImportJob(importId, {
                processedRows: i + 1,
                successRows: successCount,
                errorRows: failedCount,
                errors: errors.slice(0, 100), // Keep first 100 errors
              });
            }
          }

          // Final update
          const finalStatus = successCount === 0 ? 'FAILED' : 'COMPLETED';
          await storage.updateImportJob(importId, {
            status: finalStatus,
            processedRows: parseResult.totalRows,
            successRows: successCount,
            errorRows: failedCount,
            errors: errors.slice(0, 100),
            completedAt: new Date()
          });
          
          // Create notification for user (non-blocking)
          try {
            const user = await storage.getUser(userId);
            if (user) {
              const clinicUsers = await storage.getUsersByClinic(clinicId);
              for (const clinicUser of clinicUsers) {
                await storage.createNotification({
                  userId: clinicUser.id,
                  type: 'CASE_UPDATED',
                  title: finalStatus === 'COMPLETED' ? 'Import Completed' : 'Import Failed',
                  message: clinicUser.id === userId
                    ? `Your import of "${importJob.filename}" completed: ${successCount} successful, ${failedCount} failed`
                    : `${user.name}'s import of "${importJob.filename}" completed: ${successCount} successful, ${failedCount} failed`,
                  metadata: { importId, successCount, failedCount, fileName: importJob.filename },
                });
              }
            }
          } catch (notifError) {
            console.error("[WARNING] Failed to create import completion notification:", notifError);
          }
        } catch (error) {
          console.error('[ERROR] Import processing failed:', error);
          await storage.updateImportJob(importId, {
            status: 'FAILED',
            errors: [{ row: 0, error: error instanceof Error ? error.message : 'Import processing failed' }],
            completedAt: new Date()
          });
        }
      });
    } catch (error) {
      console.error('[ERROR] Import start failed:', error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to start import" });
    }
  });

  app.get("/api/imports/:id/status", requireAuth, async (req, res) => {
    try {
      const importId = req.params.id;
      const clinicId = (req.session as any).clinicId;
      
      const importJob = await storage.getImportJobById(importId);
      if (!importJob || importJob.clinicId !== clinicId) {
        return res.status(404).json({ success: false, error: "Import job not found" });
      }

      res.json({
        status: importJob.status,
        total_rows: importJob.totalRows || 0,
        success: importJob.successRows || 0,
        failed: importJob.errorRows || 0,
        errors: importJob.errors || [],
        started_at: importJob.createdAt,
        finished_at: importJob.completedAt
      });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to get import status" });
    }
  });

  app.get("/api/imports/recent", requireAuth, async (req, res) => {
    try {
      const clinicId = (req.session as any).clinicId;
      const jobs = await storage.getImportJobs(clinicId);
      res.json(jobs.map(job => ({
        id: job.id,
        filename: job.filename,
        status: job.status,
        total_rows: job.totalRows || 0,
        success: job.successRows || 0,
        failed: job.errorRows || 0,
        created_at: job.createdAt
      })));
    } catch (error) {
      res.status(500).json({ message: "Failed to get import jobs" });
    }
  });

  app.get("/api/imports/template.csv", requireAuth, async (req, res) => {
    const csvContent = `name,species,breed,state,diagnosis_date,sex,age_years,age_months,tumour_type,tumour_type_custom,anatomical_site,anatomical_site_custom,laterality,stage,diagnosis_method,treatment_plan,treatment_start,outcome,last_follow_up,notes
Fluffy,Dog,Labrador Retriever,Lagos,2025-01-15,MALE_NEUTERED,5,6,Melanoma,,Skin,,Left,,Histopathology,Chemotherapy,2025-01-20,TREATMENT_ONGOING,2025-02-20,Responding well to treatment
Whiskers,Cat,Persian,Kano,2025-01-20,FEMALE_SPAYED,8,3,Lymphoma,,Lymph Node,,Bilateral,,Cytology,Palliative Care,2025-01-22,REMISSION,2025-02-10,Patient achieved remission`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="9ja-vetonco-bulk-template.csv"');
    res.send(csvContent);
  });

  // Legacy endpoint (redirect to new endpoint)
  app.post("/api/bulk-upload", requireAuth, requireRole("MANAGER"), bulkUpload.single('file'), async (req, res) => {
    res.status(301).json({ success: false, error: "Please use /api/imports/upload instead" });
  });

  app.get("/api/bulk-upload/jobs", requireAuth, async (req, res) => {
    try {
      const clinicId = (req.session as any).clinicId;
      const jobs = await storage.getImportJobs(clinicId);
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ message: "Failed to get import jobs" });
    }
  });

  // Feed routes
  app.get("/api/feeds", requireAuth, async (req, res) => {
    try {
      const clinicId = (req.session as any).clinicId;
      
      // Parse optional filters from query params
      const filters: any = {};
      
      if (req.query.clinicId) {
        filters.clinicId = req.query.clinicId as string;
      } else if (req.query.myClinicOnly === 'true' && clinicId) {
        filters.clinicId = clinicId;
      }
      
      if (req.query.state) filters.state = req.query.state as string;
      if (req.query.zone) filters.zone = req.query.zone as string;
      if (req.query.from) filters.from = req.query.from as string;
      if (req.query.to) filters.to = req.query.to as string;
      if (req.query.limit) filters.limit = parseInt(req.query.limit as string);
      if (req.query.cursor) filters.cursor = req.query.cursor as string;
      
      // Use shared feed posts with cursor pagination
      const result = await storage.getSharedFeedPosts(filters);
      
      // Fetch author info for each post
      const postsWithAuthors = await Promise.all(
        result.items.map(async (post) => {
          const author = await storage.getUser(post.authorId);
          return {
            ...post,
            authorName: author?.name || "Unknown Author",
            authorEmail: author?.email,
          };
        })
      );
      
      res.json({ items: postsWithAuthors, nextCursor: result.nextCursor });
    } catch (error) {
      console.error("[ERROR] Get feed posts failed:", error);
      // Return empty result instead of 500
      res.json({ items: [], warning: "Failed to load feed posts" });
    }
  });

  app.post("/api/feeds", requireAuth, async (req, res) => {
    try {
      const clinicId = (req.session as any).clinicId;
      const userId = (req.session as any).userId;
      
      const post = insertFeedPostSchema.parse({
        ...req.body,
        clinicId,
        authorId: userId,
        status: "PUBLISHED",
        publishedAt: new Date(),
      });
      
      const newPost = await storage.createFeedPost(post);
      
      // Create notification for all clinic users (non-blocking)
      try {
        const clinicUsers = await storage.getUsersByClinic(clinicId);
        const author = await storage.getUser(userId);
        for (const user of clinicUsers) {
          const notification = await storage.createNotification({
            userId: user.id,
            type: 'CASE_UPDATED',
            title: user.id === userId ? 'You posted to feed' : 'New Feed Post',
            message: user.id === userId
              ? `Your feed post: "${newPost.title || newPost.content?.substring(0, 50)}"`
              : `${author?.name || 'A colleague'} posted: "${newPost.title || newPost.content?.substring(0, 50)}"`,
            linkUrl: `/feeds`,
            metadata: { postId: newPost.id, authorId: userId },
          });
          
          if (notificationManager) {
            notificationManager.sendNotification(user.id, notification);
          }
        }
      } catch (notifError) {
        console.error("[WARNING] Failed to create feed notification:", notifError);
      }
      
      res.json(newPost);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create feed post" });
    }
  });

  app.put("/api/feeds/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const { id } = req.params;
      
      // Get the post to check author
      const post = await storage.getFeedPostById(id);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      
      // Only the author can edit
      if (post.authorId !== userId) {
        return res.status(403).json({ message: "Only the post author can edit this post" });
      }
      
      // Validate and only allow updating safe fields (prevent changing authorId, clinicId, etc.)
      const validatedUpdates = updateFeedPostSchema.parse(req.body);
      const updatedPost = await storage.updateFeedPost(id, validatedUpdates);
      res.json(updatedPost);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update feed post" });
    }
  });

  app.delete("/api/feeds/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const user = await storage.getUser(userId);
      const { id } = req.params;
      
      // Get the post to check author and clinic
      const post = await storage.getFeedPostById(id);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      
      // Author, ADMIN (from same clinic), or SUPER_ADMIN can delete
      const isAuthor = post.authorId === userId;
      const isAdmin = user?.role === 'ADMIN' && user?.clinicId === post.clinicId;
      const isSuperAdmin = user?.role === 'SUPER_ADMIN';
      
      if (!isAuthor && !isAdmin && !isSuperAdmin) {
        return res.status(403).json({ message: "Only the post author, admin, or super admin can delete this post" });
      }
      
      await storage.deleteFeedPost(id);
      res.json({ message: "Post deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete feed post" });
    }
  });

  app.get("/api/feeds/recent", requireAuth, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
      const posts = await storage.getRecentFeedPosts(limit);
      
      // Fetch author info for each post
      const postsWithAuthors = await Promise.all(
        posts.map(async (post) => {
          const author = await storage.getUser(post.authorId);
          return {
            ...post,
            authorName: author?.name || "Unknown Author",
            authorEmail: author?.email,
          };
        })
      );
      
      res.json(postsWithAuthors);
    } catch (error) {
      res.status(500).json({ message: "Failed to get recent feed posts" });
    }
  });

  // Serve feed image
  app.get("/api/feeds/images/:encodedKey", async (req, res) => {
    try {
      const storageKey = Buffer.from(decodeURIComponent(req.params.encodedKey), 'base64').toString('utf-8');
      const { buffer, contentType } = await getObject({ key: storageKey });
      
      res.type(contentType);
      res.send(buffer);
    } catch (error) {
      res.status(404).json({ message: "Image not found" });
    }
  });

  // Upload image for feed post
  app.post("/api/feeds/upload-image", requireAuth, feedImageUpload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image provided" });
      }

      const storageKey = `feed-images/${Date.now()}-${req.file.originalname}`;
      
      try {
        await putObject({
          key: storageKey,
          buffer: req.file.buffer,
          contentType: req.file.mimetype,
        });
        
        // Return URL that points to the feed image endpoint
        const encodedKey = Buffer.from(storageKey).toString('base64');
        res.json({ url: `/api/feeds/images/${encodeURIComponent(encodedKey)}` });
      } catch (storageError) {
        console.error("[WARNING] Failed to upload to object storage:", storageError);
        // Fallback to data URL for local storage
        const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        res.json({ url: dataUrl });
      }
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to upload image" });
    }
  });

  // Follow-up routes
  app.get("/api/cases/:caseId/follow-ups", requireAuth, async (req, res) => {
    try {
      const followUps = await storage.getFollowUps(req.params.caseId);
      res.json(followUps);
    } catch (error) {
      res.status(500).json({ message: "Failed to get follow-ups" });
    }
  });

  app.post("/api/cases/:caseId/follow-ups", requireAuth, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      
      const followUp = insertFollowUpSchema.parse({
        ...req.body,
        caseId: req.params.caseId,
        createdBy: userId,
        scheduledFor: new Date(req.body.scheduledFor),
      });
      
      const newFollowUp = await storage.createFollowUp(followUp);
      res.json(newFollowUp);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create follow-up" });
    }
  });

  app.get("/api/calendar/upcoming", requireAuth, async (req, res) => {
    try {
      const clinicId = (req.session as any).clinicId;
      const { days } = req.query;
      
      const followUps = await storage.getUpcomingFollowUps(clinicId, days ? parseInt(days as string) : undefined);
      res.json(followUps);
    } catch (error) {
      res.status(500).json({ message: "Failed to get upcoming follow-ups" });
    }
  });

  // Admin user management routes
  app.get("/api/admin/users", requireAuth, requireRole("ADMIN"), async (req, res) => {
    try {
      const userRole = (req.session as any).userRole;
      const clinicId = (req.session as any).clinicId;
      
      // Super admins can see all users, clinic admins see only their clinic's users
      if (userRole === "SUPER_ADMIN") {
        const allUsers = await storage.getAllUsers();
        res.json(allUsers);
      } else {
        // Regular admin must have a clinic
        if (!clinicId) {
          return res.status(403).json({ message: "Admin must belong to a clinic" });
        }
        const users = await storage.getUsersByClinic(clinicId);
        res.json(users);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to get users" });
    }
  });

  app.patch("/api/admin/users/:id/role", requireAuth, requireRole("ADMIN"), async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;
      const actorId = (req.session as any).userId;
      const userRole = (req.session as any).userRole;
      const clinicId = (req.session as any).clinicId;

      // Validate role
      const validRoles = userRole === "SUPER_ADMIN" 
        ? ["SUPER_ADMIN", "ADMIN", "MANAGER", "CLINICIAN", "RESEARCHER", "STUDENT"]
        : ["ADMIN", "MANAGER", "CLINICIAN", "RESEARCHER", "STUDENT"];
      
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      // Only super admins can promote to SUPER_ADMIN
      if (role === "SUPER_ADMIN" && userRole !== "SUPER_ADMIN") {
        return res.status(403).json({ message: "Only super admins can promote to SUPER_ADMIN" });
      }

      // Check if user exists
      const targetUser = await storage.getUserById(id);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Clinic admins can only manage users in their clinic
      if (userRole !== "SUPER_ADMIN") {
        if (!clinicId) {
          return res.status(403).json({ message: "Admin must belong to a clinic" });
        }
        if (targetUser.clinicId !== clinicId) {
          return res.status(404).json({ message: "User not found" });
        }
      }

      // Prevent demoting the last admin
      if (targetUser.role === "ADMIN" && role !== "ADMIN") {
        const clinicUsers = await storage.getUsersByClinic(clinicId);
        const adminCount = clinicUsers.filter(u => u.role === "ADMIN").length;
        if (adminCount <= 1) {
          return res.status(400).json({ message: "Cannot demote the last administrator" });
        }
      }

      const updatedUser = await storage.updateUser(id, { role: role as any });

      await storage.createAuditLog({
        actorId,
        clinicId,
        entityType: 'USER',
        entityId: id,
        action: 'UPDATE',
        diff: { before: { role: targetUser.role }, after: { role } },
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json(updatedUser);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update role" });
    }
  });

  app.patch("/api/admin/users/:id/status", requireAuth, requireRole("ADMIN"), async (req, res) => {
    try {
      const { id } = req.params;
      const { userStatus } = req.body;
      const actorId = (req.session as any).userId;
      const userRole = (req.session as any).userRole;
      const clinicId = (req.session as any).clinicId;

      // Validate status
      if (!["ACTIVE", "SUSPENDED", "RESTRICTED"].includes(userStatus)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      // Check if user exists
      const targetUser = await storage.getUserById(id);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Clinic admins can only manage users in their clinic
      if (userRole !== "SUPER_ADMIN") {
        if (!clinicId) {
          return res.status(403).json({ message: "Admin must belong to a clinic" });
        }
        if (targetUser.clinicId !== clinicId) {
          return res.status(404).json({ message: "User not found" });
        }
      }

      // Prevent suspending the last admin
      if (userStatus !== "ACTIVE" && targetUser.role === "ADMIN") {
        const clinicUsers = await storage.getUsersByClinic(clinicId);
        const activeAdminCount = clinicUsers.filter(u => u.role === "ADMIN" && u.userStatus === "ACTIVE").length;
        if (activeAdminCount <= 1) {
          return res.status(400).json({ message: "Cannot suspend the last active administrator" });
        }
      }

      const updatedUser = await storage.updateUser(id, { userStatus: userStatus as any });

      await storage.createAuditLog({
        actorId,
        clinicId,
        entityType: 'USER',
        entityId: id,
        action: 'UPDATE',
        diff: { before: { userStatus: targetUser.userStatus }, after: { userStatus } },
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json(updatedUser);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update status" });
    }
  });

  app.delete("/api/admin/users/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
    try {
      const { id } = req.params;
      const actorId = (req.session as any).userId;
      const userRole = (req.session as any).userRole;
      const clinicId = (req.session as any).clinicId;

      // Check if user exists
      const targetUser = await storage.getUserById(id);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Clinic admins can only manage users in their clinic
      if (userRole !== "SUPER_ADMIN") {
        if (!clinicId) {
          return res.status(403).json({ message: "Admin must belong to a clinic" });
        }
        if (targetUser.clinicId !== clinicId) {
          return res.status(404).json({ message: "User not found" });
        }
      }

      // Prevent deleting self
      if (id === actorId) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      // Prevent deleting the last admin
      if (targetUser.role === "ADMIN") {
        const clinicUsers = await storage.getUsersByClinic(clinicId);
        const adminCount = clinicUsers.filter(u => u.role === "ADMIN").length;
        if (adminCount <= 1) {
          return res.status(400).json({ message: "Cannot delete the last administrator" });
        }
      }

      // Soft delete by setting status to SUSPENDED and isActive to false
      await storage.updateUser(id, { userStatus: "SUSPENDED", isActive: false });

      await storage.createAuditLog({
        actorId,
        clinicId,
        entityType: 'USER',
        entityId: id,
        action: 'DELETE',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json({ message: "User deleted successfully" });
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to delete user" });
    }
  });

  // Setup first super admin (no auth required - only works if no super admin exists)
  app.post("/api/admin/setup-super-admin", async (req, res) => {
    try {
      const { email } = req.body;

      // Validate email
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ message: "Email is required" });
      }

      // Check if any super admin already exists
      const allUsers = await storage.getAllUsers();
      const existingSuperAdmin = allUsers.find(u => u.role === "SUPER_ADMIN");
      
      if (existingSuperAdmin) {
        return res.status(403).json({ message: "A SUPER_ADMIN already exists. This setup endpoint can only be used once." });
      }

      // Find user by email
      const targetUser = await storage.getUserByEmail(email);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Promote to SUPER_ADMIN
      const updatedUser = await storage.updateUser(targetUser.id, { role: "SUPER_ADMIN" as any });

      // Log this action (use the user's own ID as actor since this is setup)
      await storage.createAuditLog({
        actorId: targetUser.id,
        clinicId: targetUser.clinicId || '',
        entityType: 'USER',
        entityId: targetUser.id,
        action: 'UPDATE',
        diff: { before: { role: targetUser.role }, after: { role: 'SUPER_ADMIN' } },
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json({ message: "Super admin setup successful", user: updatedUser });
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to setup super admin" });
    }
  });

  // Normalize species in database (convert Canine to Dog, Feline to Cat)
  app.post("/api/admin/normalize-species", requireAuth, requireRole("SUPER_ADMIN"), async (req, res) => {
    try {
      // Use raw SQL to update species names
      const { sql: sqlFn } = await import("drizzle-orm");
      
      // Update using native query
      const result = await db.execute(
        sqlFn`UPDATE cases SET species = CASE 
          WHEN LOWER(species) = 'canine' THEN 'Dog'
          WHEN LOWER(species) = 'feline' THEN 'Cat'
          ELSE species 
        END 
        WHERE LOWER(species) IN ('canine', 'feline')`
      );
      
      res.json({ 
        message: "Species normalization completed", 
        affectedRows: (result as any).rowCount || 0 
      });
    } catch (error) {
      console.error('[normalize-species] Error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to normalize species" });
    }
  });

  // Notifications
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      const notifications = await storage.getNotifications(userId, limit);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/unread-count", requireAuth, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch notification count" });
    }
  });

  app.post("/api/notifications/:id/mark-read", requireAuth, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const { id } = req.params;
      
      await storage.markNotificationAsRead(id, userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to mark notification as read" });
    }
  });

  app.post("/api/notifications/mark-all-read", requireAuth, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      
      await storage.markAllNotificationsAsRead(userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to mark all notifications as read" });
    }
  });

  app.delete("/api/notifications/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const { id } = req.params;
      
      await storage.deleteNotification(id, userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to delete notification" });
    }
  });

  // Report generation with real data based on customization
  app.post("/api/reports/generate", requireAuth, async (req, res) => {
    try {
      const clinicId = (req.session as any).clinicId;
      const userId = (req.session as any).userId;
      const { templateId, duration, startDate, endDate, dataTypes, format } = req.body;

      // Calculate date range
      let dateStart = new Date();
      let dateEnd = new Date();
      
      if (duration === "week") {
        dateStart.setDate(dateEnd.getDate() - 7);
      } else if (duration === "month") {
        dateStart.setMonth(dateEnd.getMonth() - 1);
      } else if (duration === "quarter") {
        dateStart.setMonth(dateEnd.getMonth() - 3);
      } else if (duration === "year") {
        dateStart.setFullYear(dateEnd.getFullYear() - 1);
      } else if (duration === "custom" && startDate && endDate) {
        dateStart = new Date(startDate);
        dateEnd = new Date(endDate);
      }

      // Fetch cases within date range for clinic
      const allCases = await storage.getCases(clinicId, {
        startDate: dateStart,
        endDate: dateEnd,
      });

      // Generate report data based on template type
      let reportData: any = {};
      
      if (templateId === "1") {
        const totalCases = allCases.length;
        const remissionCases = allCases.filter(c => c.outcome === "REMISSION").length;
        const remissionRate = totalCases > 0 ? Math.round((remissionCases / totalCases) * 100) : 0;
        
        // Group by month
        const casesByMonth: Record<string, number> = {};
        allCases.forEach(c => {
          const monthKey = new Date(c.diagnosisDate).toLocaleDateString("en-US", { month: "long", year: "numeric" });
          casesByMonth[monthKey] = (casesByMonth[monthKey] || 0) + 1;
        });

        reportData = {
          totalCases,
          remissionRate,
          remissionCases,
          progressionCases: allCases.filter(c => c.outcome === "PROGRESSION").length,
          casesByMonth,
          avgCasesPerMonth: totalCases > 0 ? Math.round(totalCases / Object.keys(casesByMonth).length) : 0,
        };
      } else if (templateId === "2") {
        // Group by tumour type
        const tumourCounts: Record<string, number> = {};
        allCases.forEach(c => {
          const tumourType = c.tumourTypeCustom || c.tumourType?.name || "Unknown";
          tumourCounts[tumourType] = (tumourCounts[tumourType] || 0) + 1;
        });

        // Group by species
        const speciesCounts: Record<string, number> = {};
        allCases.forEach(c => {
          speciesCounts[c.species] = (speciesCounts[c.species] || 0) + 1;
        });

        reportData = {
          totalCases: allCases.length,
          tumourIncidence: tumourCounts,
          speciesDistribution: speciesCounts,
          topTumours: Object.entries(tumourCounts).sort((a, b) => b[1] - a[1]).slice(0, 5),
        };
      } else if (templateId === "3") {
        const outcomeData: Record<string, number> = {};
        allCases.forEach(c => {
          const outcome = c.outcome || "Unknown";
          outcomeData[outcome] = (outcomeData[outcome] || 0) + 1;
        });

        const totalWithOutcome = Object.values(outcomeData).reduce((a, b) => a + b, 0);
        const successRate = totalWithOutcome > 0 ? Math.round(((outcomeData["REMISSION"] || 0) / totalWithOutcome) * 100) : 0;

        reportData = {
          totalCases: allCases.length,
          outcomes: outcomeData,
          successRate,
          progressionRate: totalWithOutcome > 0 ? Math.round(((outcomeData["PROGRESSION"] || 0) / totalWithOutcome) * 100) : 0,
          deceasedRate: totalWithOutcome > 0 ? Math.round(((outcomeData["DECEASED"] || 0) / totalWithOutcome) * 100) : 0,
        };
      } else if (templateId === "4") {
        // Fetch from all clinics (for SUPER_ADMIN/broad overview)
        const allClinicsCases = await storage.getCases(undefined, {
          startDate: dateStart,
          endDate: dateEnd,
        });

        const clinicData: Record<string, any> = {};
        allClinicsCases.forEach(c => {
          if (!clinicData[c.clinicId]) {
            clinicData[c.clinicId] = { total: 0, outcomes: {} };
          }
          clinicData[c.clinicId].total += 1;
          const outcome = c.outcome || "Unknown";
          clinicData[c.clinicId].outcomes[outcome] = (clinicData[c.clinicId].outcomes[outcome] || 0) + 1;
        });

        // Calculate success rates per clinic
        const clinicPerformance = Object.entries(clinicData).map(([cId, data]: any) => ({
          clinicId: cId,
          totalCases: data.total,
          successRate: data.total > 0 ? Math.round(((data.outcomes["REMISSION"] || 0) / data.total) * 100) : 0,
          outcomes: data.outcomes,
        }));

        reportData = {
          totalCases: allClinicsCases.length,
          clinicsCount: Object.keys(clinicData).length,
          clinicPerformance,
        };
      }

      // Handle different export formats
      const reportFormat = format?.toLowerCase() || 'json';
      
      if (!['json', 'csv', 'xlsx', 'pdf'].includes(reportFormat)) {
        return res.status(400).json({ message: "Invalid format. Use 'json', 'csv', 'xlsx', or 'pdf'" });
      }

      const reportName = `Report_Template_${templateId}_${duration}`;
      const exporter = await storage.getUser(userId);
      const now = new Date().toLocaleString();

      if (reportFormat === 'csv') {
        const escapeCsvValue = (value: unknown): string => {
          if (value === null || value === undefined) return '';
          const stringValue = String(value);
          const needsQuotes = /[",\n\r]/.test(stringValue);
          const escaped = stringValue.replace(/"/g, '""');
          return needsQuotes ? `"${escaped}"` : escaped;
        };

        const csvLines: string[] = [];
        csvLines.push('Report');
        csvLines.push(`Template,${templateId}`);
        csvLines.push(`Duration,${duration}`);
        csvLines.push(`Date Range,"${dateStart.toLocaleDateString()} - ${dateEnd.toLocaleDateString()}"`);
        csvLines.push(`Generated By,"${exporter?.name || 'Unknown User'}"`);
        csvLines.push(`Export Date,"${now}"`);
        csvLines.push('');
        csvLines.push('Data');
        
        // Convert report data to CSV format
        Object.entries(reportData).forEach(([key, value]) => {
          if (typeof value === 'object' && !Array.isArray(value)) {
            Object.entries(value as Record<string, any>).forEach(([k, v]) => {
              csvLines.push(`${key} - ${k},${escapeCsvValue(v)}`);
            });
          } else if (Array.isArray(value)) {
            csvLines.push(`${key}:`);
            if (value.length > 0 && typeof value[0] === 'object') {
              const headers = Object.keys(value[0]);
              csvLines.push(headers.map(h => escapeCsvValue(h)).join(','));
              (value as any[]).forEach(row => {
                csvLines.push(headers.map(h => escapeCsvValue(row[h])).join(','));
              });
            }
          } else {
            csvLines.push(`${key},${escapeCsvValue(value)}`);
          }
        });

        const csvContent = csvLines.join('\r\n');
        const blobContent = `\ufeff${csvContent}`;
        res.setHeader('Content-Type', 'text/csv;charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${reportName}-${new Date().toISOString().split('T')[0]}.csv"`);

        // Notification
        try {
          const notification = await storage.createNotification({
            userId,
            type: 'CASE_UPDATED',
            title: 'Report Exported',
            message: `Report (template ${templateId}, ${duration}) has been exported as CSV`,
            metadata: { templateId, duration, format: 'CSV' },
          });
          if (notificationManager) notificationManager.sendNotification(userId, notification);
        } catch (notifError) {
          console.error("[WARNING] Failed to create report export notification:", notifError);
        }

        return res.send(blobContent);
      } else if (reportFormat === 'xlsx') {
        const wsData: any[] = [
          ['Report'],
          ['Template', templateId],
          ['Duration', duration],
          ['Date Range', `${dateStart.toLocaleDateString()} - ${dateEnd.toLocaleDateString()}`],
          ['Generated By', exporter?.name || 'Unknown User'],
          ['Export Date', now],
          [],
          ['Data']
        ];

        Object.entries(reportData).forEach(([key, value]) => {
          if (typeof value === 'object' && !Array.isArray(value)) {
            Object.entries(value as Record<string, any>).forEach(([k, v]) => {
              wsData.push([`${key} - ${k}`, v]);
            });
          } else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
            wsData.push([key]);
            const headers = Object.keys(value[0]);
            wsData.push(headers);
            (value as any[]).forEach(row => {
              wsData.push(headers.map(h => row[h]));
            });
          } else {
            wsData.push([key, value]);
          }
        });

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Report');
        const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${reportName}-${new Date().toISOString().split('T')[0]}.xlsx"`);

        // Notification
        try {
          const notification = await storage.createNotification({
            userId,
            type: 'CASE_UPDATED',
            title: 'Report Exported',
            message: `Report (template ${templateId}, ${duration}) has been exported as Excel`,
            metadata: { templateId, duration, format: 'XLSX' },
          });
          if (notificationManager) notificationManager.sendNotification(userId, notification);
        } catch (notifError) {
          console.error("[WARNING] Failed to create report export notification:", notifError);
        }

        return res.send(buffer);
      } else if (reportFormat === 'pdf') {
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
        });

        let yPos = 15;
        doc.setFontSize(16);
        doc.text('Report', 14, yPos);
        yPos += 12;

        doc.setFontSize(10);
        doc.text(`Template: ${templateId}`, 14, yPos);
        yPos += 6;
        doc.text(`Duration: ${duration}`, 14, yPos);
        yPos += 6;
        doc.text(`Date Range: ${dateStart.toLocaleDateString()} - ${dateEnd.toLocaleDateString()}`, 14, yPos);
        yPos += 6;
        doc.text(`Generated By: ${exporter?.name || 'Unknown User'}`, 14, yPos);
        yPos += 6;
        doc.text(`Export Date: ${now}`, 14, yPos);
        yPos += 12;

        doc.setFontSize(11);
        doc.text('Report Data', 14, yPos);
        yPos += 8;

        doc.setFontSize(9);
        Object.entries(reportData).forEach(([key, value]) => {
          if (yPos > 250) {
            doc.addPage();
            yPos = 15;
          }

          if (typeof value === 'object' && !Array.isArray(value)) {
            doc.text(`${key}:`, 14, yPos);
            yPos += 5;
            Object.entries(value as Record<string, any>).forEach(([k, v]) => {
              doc.text(`  ${k}: ${v}`, 18, yPos);
              yPos += 4;
            });
          } else if (!Array.isArray(value)) {
            doc.text(`${key}: ${value}`, 14, yPos);
            yPos += 5;
          }
        });

        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${reportName}-${new Date().toISOString().split('T')[0]}.pdf"`);

        // Notification
        try {
          const notification = await storage.createNotification({
            userId,
            type: 'CASE_UPDATED',
            title: 'Report Exported',
            message: `Report (template ${templateId}, ${duration}) has been exported as PDF`,
            metadata: { templateId, duration, format: 'PDF' },
          });
          if (notificationManager) notificationManager.sendNotification(userId, notification);
        } catch (notifError) {
          console.error("[WARNING] Failed to create report export notification:", notifError);
        }

        return res.send(pdfBuffer);
      } else {
        // JSON format (default)
        try {
          const notification = await storage.createNotification({
            userId,
            type: 'CASE_UPDATED',
            title: 'Report Generated',
            message: `Report (template ${templateId}, ${duration}) has been generated successfully`,
            metadata: { templateId, duration, format: 'JSON' },
          });
          if (notificationManager) notificationManager.sendNotification(userId, notification);
        } catch (notifError) {
          console.error("[WARNING] Failed to create report notification:", notifError);
        }

        return res.json({
          templateId,
          duration,
          dateRange: { start: dateStart, end: dateEnd },
          format: 'json',
          data: reportData,
        });
      }
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to generate report" });
    }
  });

  // Analytics export route with notifications - supports CSV, XLSX, PDF
  app.post("/api/analytics/export", requireAuth, async (req, res) => {
    try {
      const clinicId = (req.session as any).clinicId;
      const userId = (req.session as any).userId;
      const { chartName, headers, rows, summary, format = 'csv', chartImageData } = req.body;

      if (!chartName || !headers || !rows) {
        return res.status(400).json({ message: "Missing required fields: chartName, headers, rows" });
      }

      if (!['csv', 'xlsx', 'pdf'].includes(format?.toLowerCase())) {
        return res.status(400).json({ message: "Invalid format. Use 'csv', 'xlsx', or 'pdf'" });
      }

      const exporter = await storage.getUser(userId);
      const now = new Date().toLocaleString();
      const escapeCsvValue = (value: unknown): string => {
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        const needsQuotes = /[",\n\r]/.test(stringValue);
        const escaped = stringValue.replace(/"/g, '""');
        return needsQuotes ? `"${escaped}"` : escaped;
      };

      if (format.toLowerCase() === 'csv') {
        const csvLines: string[] = [];
        csvLines.push(`Analytics Export Report`);
        csvLines.push(`Report Title,"${chartName}"`);
        csvLines.push(`Exported By,"${exporter?.name || 'Unknown User'}"`);
        csvLines.push(`Export Date,"${now}"`);
        csvLines.push('');
        
        if (summary) {
          csvLines.push('Summary Statistics');
          if (summary.total !== undefined) csvLines.push(`Total,"${summary.total}"`);
          if (summary.average !== undefined) csvLines.push(`Average,"${summary.average}"`);
          if (summary.highest !== undefined) csvLines.push(`Highest,"${summary.highest}"`);
          if (summary.lowest !== undefined) csvLines.push(`Lowest,"${summary.lowest}"`);
          if (summary.successRate !== undefined) csvLines.push(`Success Rate,"${summary.successRate}%"`);
          if (summary.recordCount !== undefined) csvLines.push(`Record Count,"${summary.recordCount}"`);
          csvLines.push('');
        }

        csvLines.push('Data');
        const headerLine = (headers as string[]).map(h => escapeCsvValue(h)).join(',');
        csvLines.push(headerLine);
        const dataLines = (rows as any[]).map(row =>
          (headers as string[]).map(header => escapeCsvValue(row[header])).join(',')
        );
        csvLines.push(...dataLines);
        
        if (rows.length > 0) {
          csvLines.push('');
          csvLines.push('Summary Row');
          const totals: string[] = [];
          for (let i = 0; i < headers.length; i++) {
            const header = headers[i];
            if (header.toLowerCase().includes('cases') || header.toLowerCase().includes('count')) {
              const total = (rows as any[]).reduce((sum, row) => {
                const val = parseInt(row[header]) || 0;
                return sum + val;
              }, 0);
              totals.push(i === 0 ? 'TOTAL' : String(total));
            } else if (i === 0) {
              totals.push('TOTAL');
            } else {
              totals.push('');
            }
          }
          csvLines.push(totals.map(t => escapeCsvValue(t)).join(','));
        }

        const csvContent = csvLines.join('\r\n');
        const blobContent = `\ufeff${csvContent}`;
        res.setHeader('Content-Type', 'text/csv;charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="analytics-${chartName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv"`);
        
        // Notification
        try {
          const clinicUsers = await storage.getUsersByClinic(clinicId);
          for (const user of clinicUsers) {
            const notification = await storage.createNotification({
              userId: user.id,
              type: 'CASE_UPDATED',
              title: user.id === userId ? 'Analytics Exported' : 'Analytics Exported',
              message: user.id === userId
                ? `You exported "${chartName}" analytics as CSV`
                : `${exporter?.name} exported "${chartName}" analytics as CSV`,
              metadata: { chartName, rowCount: rows.length, format: 'CSV' },
            });
            if (notificationManager) notificationManager.sendNotification(user.id, notification);
          }
        } catch (notifError) {
          console.error("[WARNING] Failed to create analytics export notification:", notifError);
        }

        res.send(blobContent);
      } else if (format.toLowerCase() === 'xlsx') {
        const wsData = [
          ['Analytics Export Report'],
          ['Report Title', chartName],
          ['Exported By', exporter?.name || 'Unknown User'],
          ['Export Date', now],
          [],
        ];

        if (summary) {
          wsData.push(['Summary Statistics']);
          if (summary.total !== undefined) wsData.push(['Total', summary.total]);
          if (summary.average !== undefined) wsData.push(['Average', summary.average]);
          if (summary.highest !== undefined) wsData.push(['Highest', summary.highest]);
          if (summary.lowest !== undefined) wsData.push(['Lowest', summary.lowest]);
          if (summary.successRate !== undefined) wsData.push(['Success Rate', `${summary.successRate}%`]);
          if (summary.recordCount !== undefined) wsData.push(['Record Count', summary.recordCount]);
          wsData.push([]);
        }

        wsData.push(['Data']);
        wsData.push(headers as string[]);
        (rows as any[]).forEach(row => {
          wsData.push((headers as string[]).map(h => row[h] || ''));
        });

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, chartName.substring(0, 31));
        const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="analytics-${chartName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.xlsx"`);

        // Notification
        try {
          const clinicUsers = await storage.getUsersByClinic(clinicId);
          for (const user of clinicUsers) {
            const notification = await storage.createNotification({
              userId: user.id,
              type: 'CASE_UPDATED',
              title: user.id === userId ? 'Analytics Exported' : 'Analytics Exported',
              message: user.id === userId
                ? `You exported "${chartName}" analytics as Excel`
                : `${exporter?.name} exported "${chartName}" analytics as Excel`,
              metadata: { chartName, rowCount: rows.length, format: 'XLSX' },
            });
            if (notificationManager) notificationManager.sendNotification(user.id, notification);
          }
        } catch (notifError) {
          console.error("[WARNING] Failed to create analytics export notification:", notifError);
        }

        res.send(buffer);
      } else if (format.toLowerCase() === 'pdf') {
        const doc = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: 'a4',
        });

        const pageHeight = doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.getWidth();
        let yPos = 15;

        doc.setFontSize(16);
        doc.text('Analytics Export Report', 14, yPos);
        yPos += 10;

        doc.setFontSize(10);
        doc.text(`Report: ${chartName}`, 14, yPos);
        yPos += 6;
        doc.text(`Exported By: ${exporter?.name || 'Unknown User'}`, 14, yPos);
        yPos += 6;
        doc.text(`Date: ${now}`, 14, yPos);
        yPos += 10;

        // Add chart image if available
        if (chartImageData) {
          try {
            const chartWidth = 150;
            const chartHeight = 100;
            const chartX = (pageWidth - chartWidth) / 2;
            doc.addImage(chartImageData, 'PNG', chartX, yPos, chartWidth, chartHeight);
            yPos += chartHeight + 10;
          } catch (imgError) {
            console.warn('[PDF Export] Warning: Failed to add chart image:', imgError);
            // Continue without image
          }
        }

        if (summary) {
          doc.setFontSize(11);
          doc.text('Summary Statistics:', 14, yPos);
          yPos += 6;
          doc.setFontSize(9);
          if (summary.total !== undefined) {
            doc.text(`Total: ${summary.total}`, 20, yPos);
            yPos += 5;
          }
          if (summary.average !== undefined) {
            doc.text(`Average: ${summary.average}`, 20, yPos);
            yPos += 5;
          }
          if (summary.highest !== undefined) {
            doc.text(`Highest: ${summary.highest}`, 20, yPos);
            yPos += 5;
          }
          if (summary.lowest !== undefined) {
            doc.text(`Lowest: ${summary.lowest}`, 20, yPos);
            yPos += 5;
          }
          if (summary.successRate !== undefined) {
            doc.text(`Success Rate: ${summary.successRate}%`, 20, yPos);
            yPos += 5;
          }
          if (summary.recordCount !== undefined) {
            doc.text(`Record Count: ${summary.recordCount}`, 20, yPos);
            yPos += 5;
          }
          yPos += 5;
        }

        // Check if we need a new page for the table
        if (yPos > pageHeight - 80) {
          doc.addPage();
          yPos = 15;
        }

        const tableData: any[] = [(headers as string[])];
        (rows as any[]).forEach(row => {
          tableData.push((headers as string[]).map(h => row[h] || ''));
        });

        autoTable(doc, {
          startY: yPos,
          head: [headers as string[]],
          body: (rows as any[]).map(row => (headers as string[]).map(h => row[h] || '')),
          margin: 10,
          theme: 'grid',
          headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
          alternateRowStyles: { fillColor: [240, 240, 240] },
        });

        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="analytics-${chartName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf"`);

        // Notification
        try {
          const clinicUsers = await storage.getUsersByClinic(clinicId);
          for (const user of clinicUsers) {
            const notification = await storage.createNotification({
              userId: user.id,
              type: 'CASE_UPDATED',
              title: user.id === userId ? 'Analytics Exported' : 'Analytics Exported',
              message: user.id === userId
                ? `You exported "${chartName}" analytics as PDF`
                : `${exporter?.name} exported "${chartName}" analytics as PDF`,
              metadata: { chartName, rowCount: rows.length, format: 'PDF' },
            });
            if (notificationManager) notificationManager.sendNotification(user.id, notification);
          }
        } catch (notifError) {
          console.error("[WARNING] Failed to create analytics export notification:", notifError);
        }

        res.send(pdfBuffer);
      }
    } catch (error) {
      console.error("[ERROR] Analytics export failed:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to export analytics" });
    }
  });

  // AI Chat endpoint for testing ChatGPT integration
  app.post("/api/ai/test", requireAuth, async (req, res) => {
    try {
      const { question } = req.body;
      
      if (!question || typeof question !== 'string') {
        return res.status(400).json({ message: "question field is required and must be a string" });
      }

      const answer = await callChatGPT({ userMessage: question });
      res.json({ answer });
    } catch (error) {
      console.error("[ai.test]", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to get AI response" });
    }
  });

  // AI Chat endpoint using live database context
  app.post("/api/ai/live-test", requireAuth, async (req, res) => {
    try {
      const { question } = req.body;
      
      if (!question || typeof question !== 'string') {
        return res.status(400).json({ message: "question field is required and must be a string" });
      }

      // Fetch live data context from database
      const context = await buildLiveDataContext(10);

      // Call ChatGPT with the live data context
      const answer = await callChatGPT({ userMessage: question, context });
      res.json({ answer });
    } catch (error) {
      console.error("[ai.live-test]", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to get AI response" });
    }
  });

  // AI Analytics Query endpoint - generates safe SQL from natural language
  app.post("/api/ai/analytics-query", requireAuth, async (req, res) => {
    try {
      const { question, mode } = req.body;
      
      if (!question || typeof question !== 'string') {
        return res.status(400).json({ message: "question field is required and must be a string" });
      }

      // Normalize mode: only "universal" or "strict", default to "strict"
      const normalizedMode = mode === "universal" ? "universal" : "strict";

      // Execute the analytics query with a database executor
      const result = await executeAnalyticsQuery(
        question,
        async (sql: string) => {
          const result = await pool.query(sql);
          return result.rows;
        },
        normalizedMode
      );

      res.json(result);
    } catch (error) {
      console.error("[ai.analytics-query]", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to execute analytics query",
        summary: "An error occurred while processing your question. Please try again with a simpler query."
      });
    }
  });

  // AI Case Field Suggestions endpoint - suggests form field values from clinical notes
  app.post("/api/ai/suggest-case-fields", requireAuth, async (req, res) => {
    try {
      const { notes } = req.body;
      
      if (!notes || typeof notes !== 'string') {
        return res.status(400).json({ message: "notes field is required and must be a string" });
      }

      const suggestions = await suggestCaseFields(notes);
      res.json({ suggestions });
    } catch (error) {
      console.error("[ai.suggest-case-fields]", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to generate suggestions",
        suggestions: {}
      });
    }
  });

  // AI Report Generation endpoint - generates PDF/Excel reports from analytics queries
  app.post("/api/ai/generate-report", requireAuth, async (req, res) => {
    try {
      const { question, format = "json", mode = "strict" } = req.body;
      const userId = req.user?.id;
      
      if (!question || typeof question !== 'string') {
        return res.status(400).json({ message: "question field is required" });
      }

      if (!userId) {
        return res.status(401).json({ message: "User ID required" });
      }

      // Execute the analytics query
      const queryResult = await executeAnalyticsQuery(
        question,
        async (sql: string) => {
          const result = await pool.query(sql);
          return result.rows;
        },
        mode
      );

      // For JSON format, return with full data
      if (format === "json") {
        return res.json({
          reportId: `report-${Date.now()}`,
          title: question,
          generatedAt: new Date().toISOString(),
          data: queryResult,
          format: "json"
        });
      }

      // For other formats, return data that can be processed by frontend
      res.json({
        reportId: `report-${Date.now()}`,
        title: question,
        generatedAt: new Date().toISOString(),
        data: queryResult,
        format,
        message: `Report generated in ${format} format. Use this data to export to ${format.toUpperCase()}.`
      });
    } catch (error) {
      console.error("[ai.generate-report]", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to generate report"
      });
    }
  });

  // AI Case Extraction endpoint - extracts specific cases based on criteria
  app.post("/api/ai/extract-cases", requireAuth, async (req, res) => {
    try {
      const { criteria, limit = 50 } = req.body;
      const userId = req.user?.id;
      
      if (!criteria || typeof criteria !== 'string') {
        return res.status(400).json({ message: "criteria field is required" });
      }

      if (!userId) {
        return res.status(401).json({ message: "User ID required" });
      }

      // Use AI to generate SQL for case extraction
      const sqlQuery = await callChatGPT({
        systemPrompt: `You are a SQL query generator for VetOncoData veterinary database. 
Generate a SELECT query to extract cases based on criteria: "${criteria}"

IMPORTANT: You MUST include these fields in SELECT:
- c.id
- c.case_number
- c.patient_name
- c.species
- c.breed
- c.age_years
- c.outcome
- cl.name as clinic_name

Always include clinic join:
JOIN clinics cl ON c.clinic_id = cl.id

LIMIT ${Math.min(limit, 100)}

Only output the SQL query, no explanations.`,
        userMessage: `Extract cases where: ${criteria}`
      });

      // Validate and execute
      const validation = validateSQL(sqlQuery);
      if (!validation.valid) {
        return res.status(400).json({ 
          message: "Could not generate valid query for extraction criteria",
          error: validation.error 
        });
      }

      const result = await pool.query(sqlQuery);
      const cases = result.rows.map((row: any) => ({
        ...row,
        link: `/cases/${row.id}`
      }));

      res.json({
        criteria,
        totalFound: cases.length,
        cases
      });
    } catch (error) {
      console.error("[ai.extract-cases]", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to extract cases"
      });
    }
  });

  // Ensure unmatched API routes return JSON instead of falling back to the SPA HTML.
  app.use('/api', (_req, res) => {
    return res.status(404).json({ success: false, error: 'API route not found' });
  });

  const httpServer = createServer(app);
  return httpServer;
}
