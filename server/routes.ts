import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertClinicSchema, insertCaseSchema, insertTumourTypeSchema, insertAnatomicalSiteSchema, insertFeedPostSchema, updateFeedPostSchema, insertFollowUpSchema, insertCaseFileSchema } from "@shared/schema";
import bcrypt from "bcrypt";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import multer from "multer";
import { z } from "zod";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { putObject, getObject, deleteObject, generateStorageKey, isAllowedMimeType, determineFileKind, MAX_FILE_SIZE, MAX_FILES_PER_CASE } from "./storage/files";
import { readFile, writeFile, mkdir, rm } from "fs/promises";
import path from "path";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

const PgSession = ConnectPgSimple(session);

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
      
      res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, clinic });
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
          role: user.role 
        }, 
        clinic: userWithClinic?.clinic 
      });
    } catch (error) {
      res.status(400).json({ message: "Login failed" });
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
      
      res.json({ 
        user: { 
          id: userWithClinic.id, 
          email: userWithClinic.email, 
          name: userWithClinic.name, 
          role: userWithClinic.role 
        }, 
        clinic: userWithClinic.clinic 
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get user data" });
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
        displayName,
        bio 
      } = req.body;
      
      const profileSchema = z.object({
        name: z.string().optional(),
        email: z.string().email().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        title: z.string().optional(),
        jobTitle: z.string().optional(),
        specialty: z.string().optional(),
        displayName: z.string().optional(),
        bio: z.string().optional(),
      });

      const validated = profileSchema.parse({
        name,
        email,
        firstName,
        lastName,
        title,
        jobTitle,
        specialty,
        displayName,
        bio,
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
          displayName: updatedUser.displayName,
          bio: updatedUser.bio,
          role: updatedUser.role 
        } 
      });
    } catch (error) {
      console.error("[ERROR] Update profile failed:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update profile" });
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
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const userId = req.session.userId;
      let clinicId = req.session.clinicId;

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
        req.session.clinicId = defaultClinic.id;
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
      
      await storage.deleteCase(req.params.id, clinicId);
      
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
      const { format, filters } = req.body;

      if (!format || !['pdf', 'xlsx'].includes(format)) {
        return res.status(400).json({ message: "Invalid format. Use 'pdf' or 'xlsx'" });
      }

      // Parse filters
      const apiFilters: any = {};
      if (filters) {
        if (filters.zone && filters.zone.length) apiFilters.zones = filters.zone;
        if (filters.state && filters.state.length) apiFilters.states = filters.state;
        if (filters.clinicId && filters.clinicId.length) {
          apiFilters.clinicIds = filters.clinicId;
        } else if (clinicId) {
          apiFilters.clinicIds = [clinicId];
        }
        if (filters.tumourTypeId && filters.tumourTypeId.length) apiFilters.tumourTypeIds = filters.tumourTypeId;
      } else if (clinicId) {
        apiFilters.clinicIds = [clinicId];
      }

      // Get cases with full details
      const cases = await storage.getCases(undefined, apiFilters);

      if (format === 'xlsx') {
        const wsData = cases.map((c: any) => ({
          'Case ID': c.caseNumber,
          'Upload Date': c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '',
          'Patient Name': c.patientName || '',
          'Species': c.species || '',
          'Breed': c.breed || '',
          'Age': (c.ageYears ? `${c.ageYears}y` : '') + (c.ageMonths ? ` ${c.ageMonths}m` : ''),
          'Tumour Type': c.tumourType?.name || c.tumourTypeCustom || '',
          'Anatomical Site': c.anatomicalSite?.name || c.anatomicalSiteCustom || '',
          'State': c.state || '',
          'Clinic': c.clinic?.name || '',
          'Status': c.status || '',
          'Outcome': c.outcome || '',
          'Diagnosis Date': c.diagnosisDate ? new Date(c.diagnosisDate).toLocaleDateString() : '',
        }));

        const ws = XLSX.utils.json_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Cases');
        
        const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="cases-export-${new Date().toISOString().split('T')[0]}.xlsx"`);
        res.send(buffer);
      } else if (format === 'pdf') {
        const doc = new jsPDF();
        
        // Add title
        doc.setFontSize(16);
        doc.text('Veterinary Cases Report', 14, 15);
        
        // Add metadata
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 25);
        doc.text(`Total Cases: ${cases.length}`, 14, 32);
        doc.setTextColor(0);

        // Add simple table with case data
        let yPosition = 45;
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 14;
        const lineHeight = 6;
        
        // Table headers
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.text('Case ID', margin, yPosition);
        doc.text('Upload Date', margin + 25, yPosition);
        doc.text('Patient', margin + 50, yPosition);
        doc.text('Species', margin + 85, yPosition);
        doc.text('Tumour Type', margin + 115, yPosition);
        yPosition += lineHeight;
        
        // Draw line
        doc.setDrawColor(150);
        doc.line(margin, yPosition, 196, yPosition);
        yPosition += lineHeight;
        
        // Table rows
        doc.setFont(undefined, 'normal');
        cases.forEach((c: any) => {
          if (yPosition > pageHeight - 15) {
            doc.addPage();
            yPosition = 20;
          }
          
          doc.text(c.caseNumber, margin, yPosition);
          doc.text(c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '', margin + 25, yPosition);
          doc.text(c.patientName || '', margin + 50, yPosition);
          doc.text(c.species || '', margin + 85, yPosition);
          doc.text(((c.tumourType?.name || c.tumourTypeCustom) || '').substring(0, 20), margin + 115, yPosition);
          
          yPosition += lineHeight;
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="cases-export-${new Date().toISOString().split('T')[0]}.pdf"`);
        res.send(doc.output('arraybuffer'));
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

      // Check write permission: creator or admin
      const user = await storage.getUser(userId);
      const isCreator = caseData.createdBy.id === userId;
      const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';
      
      if (!isCreator && !isAdmin) {
        return res.status(403).json({ message: "Only case creator or admins can upload files" });
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

      // Check write permission: creator or admin
      const user = await storage.getUser(userId);
      const isCreator = caseData.createdBy.id === userId;
      const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'SUPER_ADMIN';
      
      if (!isCreator && !isAdmin) {
        return res.status(403).json({ message: "Only case creator or admins can delete files" });
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
                await storage.createCase(parsedRow.data as any);
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
          await storage.updateImportJob(importId, {
            status: successCount === 0 ? 'FAILED' : 'COMPLETED',
            processedRows: parseResult.totalRows,
            successRows: successCount,
            errorRows: failedCount,
            errors: errors.slice(0, 100),
            completedAt: new Date()
          });
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
Fluffy,Canine,Labrador Retriever,Lagos,2025-01-15,MALE_NEUTERED,5,6,Melanoma,,Skin,,Left,,Histopathology,Chemotherapy,2025-01-20,TREATMENT_ONGOING,2025-02-20,Responding well to treatment
Whiskers,Feline,Persian,Kano,2025-01-20,FEMALE_SPAYED,8,3,Lymphoma,,Lymph Node,,Bilateral,,Cytology,Palliative Care,2025-01-22,REMISSION,2025-02-10,Patient achieved remission`;
    
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
      
      // Get the post to check author
      const post = await storage.getFeedPostById(id);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      
      // Author or ADMIN can delete
      const isAuthor = post.authorId === userId;
      const isAdmin = user?.role === 'ADMIN';
      
      if (!isAuthor && !isAdmin) {
        return res.status(403).json({ message: "Only the post author or admin can delete this post" });
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

  // Ensure unmatched API routes return JSON instead of falling back to the SPA HTML.
  app.use('/api', (_req, res) => {
    return res.status(404).json({ success: false, error: 'API route not found' });
  });

  const httpServer = createServer(app);
  return httpServer;
}
