import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertClinicSchema, insertCaseSchema, insertTumourTypeSchema, insertAnatomicalSiteSchema, insertFeedPostSchema, insertFollowUpSchema, insertCaseFileSchema } from "@shared/schema";
import bcrypt from "bcrypt";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import multer from "multer";
import { z } from "zod";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { putObject, deleteObject, generateStorageKey, isAllowedMimeType, determineFileKind, MAX_FILE_SIZE, MAX_FILES_PER_CASE } from "./storage/files";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

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
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "MANAGER", "CLINICIAN", "RESEARCHER"]),
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
  const roleHierarchy = ["RESEARCHER", "CLINICIAN", "MANAGER", "ADMIN"];
  const userRoleIndex = roleHierarchy.indexOf(req.session?.userRole || "");
  const minRoleIndex = roleHierarchy.indexOf(minRole);
  
  if (userRoleIndex < minRoleIndex) {
    return res.status(403).json({ message: "Insufficient permissions" });
  }
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
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
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: "/api/auth/google/callback",
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

  // Clinic setup route for Google OAuth users
  app.post("/api/auth/setup-clinic", requireAuth, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const { clinicName, clinicState, clinicCity, role } = req.body;

      // Create clinic
      const clinic = await storage.createClinic({
        name: clinicName,
        state: clinicState as any,
        city: clinicCity,
      });

      // Update user with clinic and role
      const updatedUser = await storage.updateUser(userId, {
        clinicId: clinic.id,
        role: role || "CLINICIAN",
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
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, name, password, clinicName, clinicState, clinicCity } = registerSchema.parse(req.body);
      
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
      
      // Create user as admin of the clinic
      const user = await storage.createUser({
        email,
        name,
        password: hashedPassword,
        role: "ADMIN",
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
  app.post("/api/invitations", requireAuth, requireRole("MANAGER"), async (req, res) => {
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
      const { name, email } = req.body;
      
      const updatedUser = await storage.updateUser(userId, { name, email });
      
      res.json({ 
        user: { 
          id: updatedUser.id, 
          email: updatedUser.email, 
          name: updatedUser.name, 
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
      
      // Shared reads - all authenticated users see all cases
      const cases = await storage.getCases(undefined, {
        ...filters,
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        // Multi-clinic filter support
        clinicIds: normalizeToArray(filters.clinicId),
        zones: normalizeToArray(filters.zone),
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

  app.put("/api/cases/:id", requireAuth, async (req, res) => {
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
      
      const updatedCase = await storage.updateCase(req.params.id, updates, clinicId);
      
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
  });

  app.delete("/api/cases/:id", requireAuth, requireRole("MANAGER"), async (req, res) => {
    try {
      const clinicId = (req.session as any).clinicId;
      const userId = (req.session as any).userId;
      
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
      res.status(500).json({ message: "Failed to delete case" });
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
      const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';
      
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

  // Bulk upload routes
  app.post("/api/bulk-upload", requireAuth, requireRole("MANAGER"), bulkUpload.single('file'), async (req, res) => {
    try {
      const clinicId = (req.session as any).clinicId;
      const userId = (req.session as any).userId;

      if (!req.file) {
        return res.status(400).json({ success: false, error: "No file uploaded" });
      }

      // Count CSV rows (minus header) as a lightweight validation pass.
      let imported = 0;
      if (req.file.mimetype === 'text/csv' || req.file.originalname.toLowerCase().endsWith('.csv')) {
        const csv = req.file.buffer.toString('utf8');
        const rows = csv
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
        imported = rows.length > 1 ? rows.length - 1 : 0;
      } else {
        // We currently only parse CSV in-memory; other types will be handled by later processors.
        imported = 1;
      }

      const sanitizedName = req.file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const savedFileName = `${Date.now()}-${sanitizedName}`;
      const relativeFilePath = path.join('uploads', savedFileName);
      const absoluteFilePath = path.resolve(import.meta.dirname, '..', relativeFilePath);

      // Persist the uploaded buffer after validation so legacy code expecting a file path still works.
      await mkdir(path.dirname(absoluteFilePath), { recursive: true });
      await writeFile(absoluteFilePath, req.file.buffer);

      const importJob = await storage.createImportJob({
        clinicId,
        createdBy: userId,
        filename: req.file.originalname,
        fileUrl: relativeFilePath,
        mapping: {},
        status: 'COMPLETED',
        totalRows: imported,
        processedRows: imported,
        successRows: imported,
      });

      return res.json({ success: true, imported, jobId: importJob.id });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to upload file" });
    }
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
      res.json(result);
    } catch (error) {
      console.error("[ERROR] Get feed posts failed:", error);
      // Return empty result instead of 500
      res.json({ items: [], warning: "Failed to load feed posts" });
    }
  });

  app.post("/api/feeds", requireAuth, requireRole("MANAGER"), async (req, res) => {
    try {
      const clinicId = (req.session as any).clinicId;
      const userId = (req.session as any).userId;
      
      const post = insertFeedPostSchema.parse({
        ...req.body,
        clinicId,
        authorId: userId,
      });
      
      const newPost = await storage.createFeedPost(post);
      res.json(newPost);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create feed post" });
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

  // Ensure unmatched API routes return JSON instead of falling back to the SPA HTML.
  app.use('/api', (_req, res) => {
    return res.status(404).json({ success: false, error: 'API route not found' });
  });

  const httpServer = createServer(app);
  return httpServer;
}
