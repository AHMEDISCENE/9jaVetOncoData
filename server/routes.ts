import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertClinicSchema, insertCaseSchema, insertTumourTypeSchema, insertAnatomicalSiteSchema, insertFeedPostSchema, insertFollowUpSchema } from "@shared/schema";
import bcrypt from "bcrypt";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import multer from "multer";
import { z } from "zod";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

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
  myClinicOnly: z.coerce.boolean().optional(),
  clinicId: z.string().uuid().optional(),
});

// File upload configuration
const upload = multer({
  dest: 'uploads/',
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
      const stats = await storage.getDashboardStats(clinicId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to get dashboard stats" });
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

      const cases = await storage.getCases({
        species: filters.species,
        tumourType: filters.tumourType,
        outcome: filters.outcome,
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        clinicId: filters.myClinicOnly ? clinicId : filters.clinicId,
        limit: filters.limit,
        offset: filters.offset,
      });

      res.json(cases);
    } catch (error) {
      console.error("[cases.list]", error);
      res.status(500).json({ message: "Failed to get cases" });
    }
  });

  app.get("/api/cases/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const userRole = (req.session as any).userRole;
      const caseData = await storage.getCase(req.params.id, { userId, userRole });
      
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
      const userRole = (req.session as any).userRole;
      
      // Transform data before validation
      const transformedData = {
        ...req.body,
        clinicId,
        createdBy: userId,
        diagnosisDate: new Date(req.body.diagnosisDate),
        treatmentStart: req.body.treatmentStart ? new Date(req.body.treatmentStart) : null,
        tumourTypeId: req.body.tumourTypeId || null,
        anatomicalSiteId: req.body.anatomicalSiteId || null,
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
      
      // Transform data before validation for updates
      const transformedUpdates = {
        ...req.body,
        diagnosisDate: req.body.diagnosisDate ? new Date(req.body.diagnosisDate) : undefined,
        treatmentStart: req.body.treatmentStart ? new Date(req.body.treatmentStart) : undefined,
        tumourTypeId: req.body.tumourTypeId || null,
        anatomicalSiteId: req.body.anatomicalSiteId || null,
      };
      
      const updates = insertCaseSchema.partial().parse(transformedUpdates);
      
      const updatedCase = await storage.updateCase(req.params.id, updates, {
        userId,
        userRole,
        clinicId,
      });
      
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
      const message = error instanceof Error ? error.message : "Failed to update case";
      const status = message.includes("Not allowed") ? 403 : 400;
      res.status(status).json({ message });
    }
  });

  app.delete("/api/cases/:id", requireAuth, requireRole("MANAGER"), async (req, res) => {
    try {
      const clinicId = (req.session as any).clinicId;
      const userId = (req.session as any).userId;
      const userRole = (req.session as any).userRole;

      await storage.deleteCase(req.params.id, { userId, userRole, clinicId });
      
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
      const message = error instanceof Error ? error.message : "Failed to delete case";
      const status = message.includes("Not allowed") ? 403 : 500;
      res.status(status).json({ message });
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

  // Bulk upload routes
  app.post("/api/bulk-upload", requireAuth, requireRole("MANAGER"), upload.single('file'), async (req, res) => {
    try {
      const clinicId = (req.session as any).clinicId;
      const userId = (req.session as any).userId;
      
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // Create import job
      const importJob = await storage.createImportJob({
        clinicId,
        createdBy: userId,
        filename: req.file.originalname,
        fileUrl: req.file.path,
        mapping: {},
        status: 'PENDING',
      });
      
      // TODO: Process file in background job
      
      res.json(importJob);
    } catch (error) {
      res.status(500).json({ message: "Failed to upload file" });
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
      const { limit } = req.query;
      
      const posts = await storage.getFeedPosts(clinicId, limit ? parseInt(limit as string) : undefined);
      res.json(posts);
    } catch (error) {
      res.status(500).json({ message: "Failed to get feed posts" });
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

  const httpServer = createServer(app);
  return httpServer;
}
