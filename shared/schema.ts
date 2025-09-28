import { sql } from "drizzle-orm";
import { pgTable, text, varchar, uuid, timestamp, integer, jsonb, pgEnum, boolean, index, pgView } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const roleEnum = pgEnum("role", ["ADMIN", "MANAGER", "CLINICIAN", "RESEARCHER"]);
export const sexEnum = pgEnum("sex", ["MALE_NEUTERED", "MALE_INTACT", "FEMALE_SPAYED", "FEMALE_INTACT"]);
export const statusEnum = pgEnum("status", ["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"]);
export const outcomeEnum = pgEnum("outcome", ["REMISSION", "TREATMENT_ONGOING", "DECEASED", "LOST_TO_FOLLOWUP"]);
export const attachmentKindEnum = pgEnum("attachment_kind", ["IMAGE", "PDF", "LAB"]);
export const reportStatusEnum = pgEnum("report_status", ["PENDING", "RUNNING", "COMPLETED", "FAILED"]);
export const feedStatusEnum = pgEnum("feed_status", ["DRAFT", "PUBLISHED", "MODERATION"]);

// Nigerian States for location context
export const stateEnum = pgEnum("state", [
  "ABIA", "ADAMAWA", "AKWA_IBOM", "ANAMBRA", "BAUCHI", "BAYELSA", "BENUE", "BORNO", 
  "CROSS_RIVER", "DELTA", "EBONYI", "EDO", "EKITI", "ENUGU", "FCT", "GOMBE", 
  "IMO", "JIGAWA", "KADUNA", "KANO", "KATSINA", "KEBBI", "KOGI", "KWARA", 
  "LAGOS", "NASARAWA", "NIGER", "OGUN", "ONDO", "OSUN", "OYO", "PLATEAU", 
  "RIVERS", "SOKOTO", "TARABA", "YOBE", "ZAMFARA"
]);

// Core Tables
export const clinics = pgTable("clinics", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  state: stateEnum("state").notNull(),
  city: text("city").notNull(),
  lga: text("lga"), // Local Government Area
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  logoUrl: text("logo_url"),
  letterheadUrl: text("letterhead_url"),
  settings: jsonb("settings").$type<{
    defaultReminders?: boolean;
    allowCustomVocab?: boolean;
    timezone?: string;
  }>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  password: text("password"), // nullable for OAuth users
  googleId: text("google_id").unique(), // for Google OAuth
  image: text("image"),
  role: roleEnum("role").notNull().default("CLINICIAN"),
  clinicId: uuid("clinic_id").references(() => clinics.id),
  emailVerified: timestamp("email_verified"),
  isActive: boolean("is_active").default(true).notNull(),
  lastLoginAt: timestamp("last_login_at"),
  preferences: jsonb("preferences").$type<{
    language?: string;
    theme?: string;
    notifications?: boolean;
  }>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  emailIdx: index("users_email_idx").on(table.email),
  clinicIdx: index("users_clinic_idx").on(table.clinicId),
  googleIdIdx: index("users_google_id_idx").on(table.googleId),
}));

export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  role: roleEnum("role").notNull(),
  clinicId: uuid("clinic_id").references(() => clinics.id).notNull(),
  invitedBy: uuid("invited_by").references(() => users.id).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Master vocabulary tables
export const tumourTypes = pgTable("tumour_types", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  species: text("species"), // optional species restriction
  isSystem: boolean("is_system").default(false).notNull(),
  clinicId: uuid("clinic_id").references(() => clinics.id), // null for global
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  nameSpeciesIdx: index("tumour_types_name_species_idx").on(table.name, table.species),
}));

export const anatomicalSites = pgTable("anatomical_sites", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  species: text("species"), // optional species restriction
  isSystem: boolean("is_system").default(false).notNull(),
  clinicId: uuid("clinic_id").references(() => clinics.id), // null for global
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  nameSpeciesIdx: index("anatomical_sites_name_species_idx").on(table.name, table.species),
}));

// Cases - the core entity
export const cases = pgTable("cases", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  caseNumber: text("case_number").notNull().unique(),
  clinicId: uuid("clinic_id").references(() => clinics.id).notNull(),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  
  // Patient information
  patientName: text("patient_name"),
  species: text("species").notNull(),
  breed: text("breed").notNull(),
  sex: sexEnum("sex"),
  ageYears: integer("age_years"),
  ageMonths: integer("age_months"),
  
  // Tumour details
  tumourTypeId: uuid("tumour_type_id").references(() => tumourTypes.id),
  tumourTypeCustom: text("tumour_type_custom"),
  anatomicalSiteId: uuid("anatomical_site_id").references(() => anatomicalSites.id),
  anatomicalSiteCustom: text("anatomical_site_custom"),
  laterality: text("laterality"), // left, right, bilateral, central
  stage: text("stage"),
  
  // Diagnosis
  diagnosisMethod: text("diagnosis_method"),
  diagnosisDate: timestamp("diagnosis_date").notNull(),
  
  // Treatment
  treatmentPlan: text("treatment_plan"),
  treatmentStart: timestamp("treatment_start"),
  
  // Outcome
  outcome: outcomeEnum("outcome"),
  lastFollowUp: timestamp("last_follow_up"),
  
  // Additional data
  notes: text("notes"),
  status: statusEnum("status").default("DRAFT").notNull(),
  extra: jsonb("extra").$type<Record<string, any>>().default({}),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  clinicIdx: index("cases_clinic_idx").on(table.clinicId),
  speciesIdx: index("cases_species_idx").on(table.species),
  tumourTypeIdx: index("cases_tumour_type_idx").on(table.tumourTypeId),
  anatomicalSiteIdx: index("cases_anatomical_site_idx").on(table.anatomicalSiteId),
  outcomeIdx: index("cases_outcome_idx").on(table.outcome),
  diagnosisDateIdx: index("cases_diagnosis_date_idx").on(table.diagnosisDate),
}));

export const sharedCasesView = pgView("shared_cases_view", {
  id: uuid("id"),
  caseNumber: text("case_number"),
  clinicId: uuid("clinic_id"),
  createdBy: uuid("created_by"),
  patientAlias: text("patient_alias"),
  species: text("species"),
  breed: text("breed"),
  sex: sexEnum("sex"),
  ageYears: integer("age_years"),
  ageMonths: integer("age_months"),
  tumourTypeId: uuid("tumour_type_id"),
  tumourTypeCustom: text("tumour_type_custom"),
  anatomicalSiteId: uuid("anatomical_site_id"),
  anatomicalSiteCustom: text("anatomical_site_custom"),
  laterality: text("laterality"),
  stage: text("stage"),
  diagnosisMethod: text("diagnosis_method"),
  diagnosisDate: timestamp("diagnosis_date"),
  treatmentPlan: text("treatment_plan"),
  treatmentStart: timestamp("treatment_start"),
  outcome: outcomeEnum("outcome"),
  lastFollowUp: timestamp("last_follow_up"),
  notes: text("notes"),
  status: statusEnum("status"),
  extra: jsonb("extra"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
  clinicName: text("clinic_name"),
  clinicState: stateEnum("clinic_state"),
  clinicCity: text("clinic_city"),
});

export const attachments = pgTable("attachments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: uuid("case_id").references(() => cases.id).notNull(),
  kind: attachmentKindEnum("kind").notNull(),
  filename: text("filename").notNull(),
  url: text("url").notNull(),
  size: integer("size"),
  mimeType: text("mime_type"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  caseIdx: index("attachments_case_idx").on(table.caseId),
}));

// Reports system
export const reportTemplates = pgTable("report_templates", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  definition: jsonb("definition").$type<{
    inputs: Array<{name: string; type: string; required: boolean}>;
    queries: Array<{id: string; sql: string; params: string[]}>;
    layout: {sections: Array<{type: string; config: any}>};
    redaction: {fields: string[]};
  }>().notNull(),
  version: integer("version").default(1).notNull(),
  isSystem: boolean("is_system").default(false).notNull(),
  clinicId: uuid("clinic_id").references(() => clinics.id), // null for global
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reportInstances = pgTable("report_instances", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: uuid("template_id").references(() => reportTemplates.id).notNull(),
  clinicId: uuid("clinic_id").references(() => clinics.id).notNull(),
  runBy: uuid("run_by").references(() => users.id).notNull(),
  status: reportStatusEnum("status").default("PENDING").notNull(),
  params: jsonb("params").$type<Record<string, any>>().default({}),
  format: text("format").notNull(), // PDF, DOCX, CSV
  outputUrl: text("output_url"),
  checksum: text("checksum"),
  queryIds: text("query_ids").array(),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const scheduledReports = pgTable("scheduled_reports", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: uuid("template_id").references(() => reportTemplates.id).notNull(),
  clinicId: uuid("clinic_id").references(() => clinics.id).notNull(),
  name: text("name").notNull(),
  cron: text("cron").notNull(),
  recipients: text("recipients").array().notNull(),
  format: text("format").notNull(),
  filters: jsonb("filters").$type<Record<string, any>>().default({}),
  accessRoleMin: roleEnum("access_role_min").default("CLINICIAN").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Feeds system
export const feedPosts = pgTable("feed_posts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  body: text("body").notNull(), // markdown
  tags: text("tags").array().default([]),
  attachments: text("attachments").array().default([]),
  status: feedStatusEnum("status").default("DRAFT").notNull(),
  clinicId: uuid("clinic_id").references(() => clinics.id), // null for public
  authorId: uuid("author_id").references(() => users.id).notNull(),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  statusIdx: index("feed_posts_status_idx").on(table.status),
  clinicIdx: index("feed_posts_clinic_idx").on(table.clinicId),
}));

// Calendar/reminders
export const followUps = pgTable("follow_ups", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: uuid("case_id").references(() => cases.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  scheduledFor: timestamp("scheduled_for").notNull(),
  isCompleted: boolean("is_completed").default(false).notNull(),
  completedAt: timestamp("completed_at"),
  reminderSent: boolean("reminder_sent").default(false).notNull(),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  caseIdx: index("follow_ups_case_idx").on(table.caseId),
  scheduledIdx: index("follow_ups_scheduled_idx").on(table.scheduledFor),
}));

// Audit logging
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  actorId: uuid("actor_id").references(() => users.id),
  clinicId: uuid("clinic_id").references(() => clinics.id),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  action: text("action").notNull(), // CREATE, UPDATE, DELETE
  diff: jsonb("diff").$type<{before?: any; after?: any}>(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  actorIdx: index("audit_logs_actor_idx").on(table.actorId),
  entityIdx: index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  clinicIdx: index("audit_logs_clinic_idx").on(table.clinicId),
}));

// Bulk import tracking
export const importJobs = pgTable("import_jobs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  clinicId: uuid("clinic_id").references(() => clinics.id).notNull(),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  filename: text("filename").notNull(),
  fileUrl: text("file_url").notNull(),
  mapping: jsonb("mapping").$type<Record<string, string>>().notNull(),
  status: text("status").notNull(), // PENDING, PROCESSING, COMPLETED, FAILED
  totalRows: integer("total_rows"),
  processedRows: integer("processed_rows").default(0),
  successRows: integer("success_rows").default(0),
  errorRows: integer("error_rows").default(0),
  errors: jsonb("errors").$type<Array<{row: number; error: string}>>().default([]),
  errorFileUrl: text("error_file_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  clinicIdx: index("import_jobs_clinic_idx").on(table.clinicId),
  statusIdx: index("import_jobs_status_idx").on(table.status),
}));

// Relations
export const clinicsRelations = relations(clinics, ({ many }) => ({
  users: many(users),
  cases: many(cases),
  tumourTypes: many(tumourTypes),
  anatomicalSites: many(anatomicalSites),
  reportTemplates: many(reportTemplates),
  reportInstances: many(reportInstances),
  scheduledReports: many(scheduledReports),
  feedPosts: many(feedPosts),
  auditLogs: many(auditLogs),
  importJobs: many(importJobs),
  invitations: many(invitations),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  clinic: one(clinics, {
    fields: [users.clinicId],
    references: [clinics.id],
  }),
  cases: many(cases),
  tumourTypes: many(tumourTypes),
  anatomicalSites: many(anatomicalSites),
  reportInstances: many(reportInstances),
  scheduledReports: many(scheduledReports),
  feedPosts: many(feedPosts),
  followUps: many(followUps),
  auditLogs: many(auditLogs),
  importJobs: many(importJobs),
  invitations: many(invitations),
}));

export const casesRelations = relations(cases, ({ one, many }) => ({
  clinic: one(clinics, {
    fields: [cases.clinicId],
    references: [clinics.id],
  }),
  createdBy: one(users, {
    fields: [cases.createdBy],
    references: [users.id],
  }),
  tumourType: one(tumourTypes, {
    fields: [cases.tumourTypeId],
    references: [tumourTypes.id],
  }),
  anatomicalSite: one(anatomicalSites, {
    fields: [cases.anatomicalSiteId],
    references: [anatomicalSites.id],
  }),
  attachments: many(attachments),
  followUps: many(followUps),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  case: one(cases, {
    fields: [attachments.caseId],
    references: [cases.id],
  }),
}));

export const followUpsRelations = relations(followUps, ({ one }) => ({
  case: one(cases, {
    fields: [followUps.caseId],
    references: [cases.id],
  }),
  createdBy: one(users, {
    fields: [followUps.createdBy],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertClinicSchema = createInsertSchema(clinics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  emailVerified: true,
  lastLoginAt: true,
});

export const insertCaseSchema = createInsertSchema(cases).omit({
  id: true,
  caseNumber: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  species: z.string().min(1),
  breed: z.string().min(1),
  diagnosisDate: z.string().or(z.date()),
});

export const insertTumourTypeSchema = createInsertSchema(tumourTypes).omit({
  id: true,
  createdAt: true,
});

export const insertAnatomicalSiteSchema = createInsertSchema(anatomicalSites).omit({
  id: true,
  createdAt: true,
});

export const insertAttachmentSchema = createInsertSchema(attachments).omit({
  id: true,
  createdAt: true,
});

export const insertFeedPostSchema = createInsertSchema(feedPosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
});

export const insertFollowUpSchema = createInsertSchema(followUps).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

// Types
export type Clinic = typeof clinics.$inferSelect;
export type User = typeof users.$inferSelect;
export type Case = typeof cases.$inferSelect;
export type TumourType = typeof tumourTypes.$inferSelect;
export type AnatomicalSite = typeof anatomicalSites.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
export type ReportTemplate = typeof reportTemplates.$inferSelect;
export type ReportInstance = typeof reportInstances.$inferSelect;
export type ScheduledReport = typeof scheduledReports.$inferSelect;
export type FeedPost = typeof feedPosts.$inferSelect;
export type FollowUp = typeof followUps.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type ImportJob = typeof importJobs.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;

export type InsertClinic = z.infer<typeof insertClinicSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertCase = z.infer<typeof insertCaseSchema>;
export type InsertTumourType = z.infer<typeof insertTumourTypeSchema>;
export type InsertAnatomicalSite = z.infer<typeof insertAnatomicalSiteSchema>;
export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;
export type InsertFeedPost = z.infer<typeof insertFeedPostSchema>;
export type InsertFollowUp = z.infer<typeof insertFollowUpSchema>;

// User with clinic data
export type UserWithClinic = User & {
  clinic: Clinic | null;
};

// Case with related data
export type CaseWithDetails = Case & {
  clinic: Clinic;
  createdBy: User;
  tumourType: TumourType | null;
  anatomicalSite: AnatomicalSite | null;
  attachments: Attachment[];
  followUps: FollowUp[];
};

// Session table for express-session
export const session = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

// Dashboard stats type
export type DashboardStats = {
  totalCases: number;
  newThisMonth: number;
  activeClinics: number;
  remissionRate: number;
  casesByMonth: Array<{month: string; count: number}>;
  topTumourTypes: Array<{name: string; count: number}>;
  casesByState: Array<{state: string; count: number}>;
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: Date;
    user: string;
    clinic: string;
  }>;
};
