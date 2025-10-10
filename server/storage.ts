import { 
  type User, 
  type InsertUser, 
  type Clinic, 
  type InsertClinic,
  type Case,
  type InsertCase,
  type CaseWithDetails,
  type UserWithClinic,
  type TumourType,
  type InsertTumourType,
  type AnatomicalSite,
  type InsertAnatomicalSite,
  type Attachment,
  type InsertAttachment,
  type CaseFile,
  type InsertCaseFile,
  type FeedPost,
  type InsertFeedPost,
  type FollowUp,
  type InsertFollowUp,
  type DashboardStats,
  type Invitation,
  type ImportJob,
  users,
  clinics,
  cases,
  tumourTypes,
  anatomicalSites,
  attachments,
  caseFiles,
  feedPosts,
  followUps,
  auditLogs,
  invitations,
  importJobs,
  ngStates
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, asc, count, sql, ilike, gte, lte, isNull, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { randomBytes } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserWithClinic(id: string): Promise<UserWithClinic | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User>;
  
  // Authentication
  verifyUserEmail(id: string): Promise<void>;
  updateLastLogin(id: string): Promise<void>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  linkGoogleAccount(userId: string, googleId: string): Promise<void>;
  createUserFromGoogle(googleUser: {
    googleId: string;
    email: string;
    name: string;
    photo?: string;
  }): Promise<User>;
  
  // Clinics
  getClinic(id: string): Promise<Clinic | undefined>;
  createClinic(clinic: InsertClinic): Promise<Clinic>;
  updateClinic(id: string, updates: Partial<InsertClinic>): Promise<Clinic>;
  
  // Invitations
  createInvitation(email: string, role: string, clinicId: string, invitedBy: string): Promise<Invitation>;
  getInvitationByToken(token: string): Promise<Invitation | undefined>;
  acceptInvitation(token: string, userId: string): Promise<void>;
  
  // Cases
  getCases(clinicId: string | undefined, filters?: {
    species?: string;
    tumourType?: string;
    outcome?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
    clinicIds?: string[];
    zones?: string[];
    states?: string[];
    tumourTypeIds?: string[];
    sort?: string;
    order?: string;
  }): Promise<CaseWithDetails[]>;
  getSharedCases(filters?: {
    from?: string;
    to?: string;
    clinicIds?: string[];
    geoZones?: string[];
    states?: string[];
    species?: string[];
    tumourTypeIds?: string[];
  }): Promise<Case[]>;
  getCase(id: string, clinicId: string): Promise<CaseWithDetails | undefined>;
  createCase(caseData: InsertCase): Promise<Case>;
  updateCase(id: string, updates: Partial<InsertCase>, clinicId: string): Promise<Case>;
  deleteCase(id: string, clinicId: string): Promise<void>;
  generateCaseNumber(clinicId: string): Promise<string>;
  
  // Vocabulary
  getTumourTypes(clinicId?: string, species?: string): Promise<TumourType[]>;
  createTumourType(tumourType: InsertTumourType): Promise<TumourType>;
  getAnatomicalSites(clinicId?: string, species?: string): Promise<AnatomicalSite[]>;
  createAnatomicalSite(site: InsertAnatomicalSite): Promise<AnatomicalSite>;
  
  // Lookups for filters
  getNigerianStates(): Promise<Array<{ code: string; name: string; zone: string }>>;
  getClinicsList(): Promise<Array<{ id: string; name: string }>>;
  getTumourTypesList(): Promise<Array<{ id: string; name: string }>>;
  
  // Attachments
  createAttachment(attachment: InsertAttachment): Promise<Attachment>;
  getAttachments(caseId: string): Promise<Attachment[]>;
  deleteAttachment(id: string, clinicId: string): Promise<void>;
  
  // Case Files
  createCaseFile(caseFile: InsertCaseFile): Promise<CaseFile>;
  getCaseFiles(caseId: string): Promise<CaseFile[]>;
  softDeleteCaseFile(id: string): Promise<void>;
  getCaseFileById(id: string): Promise<CaseFile | undefined>;
  
  // Feeds
  getFeedPosts(clinicId?: string, limit?: number): Promise<FeedPost[]>;
  getSharedFeedPosts(filters?: {
    clinicId?: string;
    state?: string;
    zone?: string;
    from?: string;
    to?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ items: FeedPost[]; nextCursor?: string }>;
  createFeedPost(post: InsertFeedPost): Promise<FeedPost>;
  updateFeedPost(id: string, updates: Partial<InsertFeedPost>, clinicId: string): Promise<FeedPost>;
  
  // Follow-ups
  getFollowUps(caseId: string): Promise<FollowUp[]>;
  createFollowUp(followUp: InsertFollowUp): Promise<FollowUp>;
  updateFollowUp(id: string, updates: Partial<InsertFollowUp>): Promise<FollowUp>;
  getUpcomingFollowUps(clinicId: string, days: number): Promise<FollowUp[]>;
  
  // Analytics
  getDashboardStats(clinicId: string): Promise<DashboardStats>;
  getSharedDashboardStats(filters?: {
    clinicIds?: string[];
    geoZones?: string[];
    states?: string[];
    species?: string[];
    tumourTypeIds?: string[];
    from?: string;
    to?: string;
  }): Promise<{
    totals: {
      totalCases: number;
      newThisMonth: number;
      remissionRate: number;
      activeClinics: number;
    };
    casesByMonth: Array<{ month: string; count: number }>;
    topTumourTypes: Array<{ name: string; count: number }>;
  }>;
  getSharedAnalyticsStats(filters?: {
    clinicIds?: string[];
    geoZones?: string[];
    states?: string[];
    species?: string[];
    tumourTypeIds?: string[];
    from?: string;
    to?: string;
  }): Promise<{
    totals: {
      totalCases: number;
      newThisMonth: number;
      remissionRate: number;
      activeClinics: number;
    };
    casesOverTime: Array<{ date: string; count: number }>;
    tumourDistribution: Array<{ name: string; count: number }>;
  }>;
  
  // Import jobs
  createImportJob(job: Partial<ImportJob>): Promise<ImportJob>;
  updateImportJob(id: string, updates: Partial<ImportJob>): Promise<ImportJob>;
  getImportJobs(clinicId: string): Promise<ImportJob[]>;
  
  // Audit
  createAuditLog(log: {
    actorId?: string;
    clinicId?: string;
    entityType: string;
    entityId: string;
    action: string;
    diff?: any;
    ip?: string;
    userAgent?: string;
  }): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserWithClinic(id: string): Promise<UserWithClinic | undefined> {
    const [result] = await db
      .select()
      .from(users)
      .leftJoin(clinics, eq(users.clinicId, clinics.id))
      .where(eq(users.id, id));
    
    if (!result) return undefined;
    
    return {
      ...result.users,
      clinic: result.clinics,
    };
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async verifyUserEmail(id: string): Promise<void> {
    await db
      .update(users)
      .set({ emailVerified: new Date() })
      .where(eq(users.id, id));
  }

  async updateLastLogin(id: string): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, id));
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user || undefined;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async linkGoogleAccount(userId: string, googleId: string): Promise<void> {
    await db
      .update(users)
      .set({ googleId, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async createUserFromGoogle(googleUser: {
    googleId: string;
    email: string;
    name: string;
    photo?: string;
  }): Promise<User> {
    const [user] = await db.insert(users).values({
      email: googleUser.email,
      name: googleUser.name,
      googleId: googleUser.googleId,
      image: googleUser.photo,
      emailVerified: new Date(), // Google accounts are pre-verified
    }).returning();
    return user;
  }

  async getClinic(id: string): Promise<Clinic | undefined> {
    const [clinic] = await db.select().from(clinics).where(eq(clinics.id, id));
    return clinic || undefined;
  }

  async createClinic(insertClinic: InsertClinic): Promise<Clinic> {
    const [clinic] = await db.insert(clinics).values(insertClinic).returning();
    return clinic;
  }

  async updateClinic(id: string, updates: Partial<InsertClinic>): Promise<Clinic> {
    const [clinic] = await db
      .update(clinics)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(clinics.id, id))
      .returning();
    return clinic;
  }

  async createInvitation(email: string, role: string, clinicId: string, invitedBy: string): Promise<Invitation> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    const [invitation] = await db.insert(invitations).values({
      email,
      role: role as any,
      clinicId,
      invitedBy,
      token,
      expiresAt,
    }).returning();
    
    return invitation;
  }

  async getInvitationByToken(token: string): Promise<Invitation | undefined> {
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(and(
        eq(invitations.token, token),
        gte(invitations.expiresAt, new Date()),
        isNull(invitations.acceptedAt)
      ));
    return invitation || undefined;
  }

  async acceptInvitation(token: string, userId: string): Promise<void> {
    await db
      .update(invitations)
      .set({ acceptedAt: new Date() })
      .where(eq(invitations.token, token));
  }

  async getCases(clinicId?: string, filters: {
    species?: string;
    tumourType?: string;
    outcome?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
    clinicIds?: string[];
    zones?: string[];
    states?: string[];
    tumourTypeIds?: string[];
    sort?: string;
    order?: string;
  } = {}): Promise<CaseWithDetails[]> {
    const { hasNgStates } = await import('./db/capabilities');
    const { computeZoneFromState, statesForZones } = await import('./geo/nigeria-zones');
    
    const creator = alias(users, 'creator');
    let useJoin = false;
    
    try {
      useJoin = await hasNgStates();
    } catch (error) {
      console.error('[getCases] Error checking ng_states capability:', error);
      useJoin = false;
    }
    
    let query;
    
    try {
      if (useJoin) {
        query = db
          .select({
            cases: cases,
            clinics: clinics,
            creator: creator,
            tumour_types: tumourTypes,
            anatomical_sites: anatomicalSites,
            geo_zone: sql<string>`COALESCE(ng_states.zone, '')`.as('geo_zone'),
          })
          .from(cases)
          .leftJoin(clinics, eq(cases.clinicId, clinics.id))
          .leftJoin(creator, eq(cases.createdBy, creator.id))
          .leftJoin(tumourTypes, eq(cases.tumourTypeId, tumourTypes.id))
          .leftJoin(anatomicalSites, eq(cases.anatomicalSiteId, anatomicalSites.id))
          .leftJoin(
            sql`ng_states`,
            sql`LOWER(TRIM(${cases.state})) = LOWER(TRIM(ng_states.name))`
          )
          .$dynamic();
      } else {
        query = db
          .select()
          .from(cases)
          .leftJoin(clinics, eq(cases.clinicId, clinics.id))
          .leftJoin(creator, eq(cases.createdBy, creator.id))
          .leftJoin(tumourTypes, eq(cases.tumourTypeId, tumourTypes.id))
          .leftJoin(anatomicalSites, eq(cases.anatomicalSiteId, anatomicalSites.id))
          .$dynamic();
      }

      // Shared reads - filter by clinic(s) if explicitly requested
      if (filters.clinicIds && filters.clinicIds.length > 0) {
        query = query.where(inArray(cases.clinicId, filters.clinicIds));
      } else {
        query = query.where(sql`1=1`);
      }

      if (filters.species) {
        query = query.where(eq(cases.species, filters.species));
      }
      if (filters.outcome) {
        query = query.where(eq(cases.outcome, filters.outcome as any));
      }
      if (filters.startDate) {
        query = query.where(gte(cases.diagnosisDate, filters.startDate));
      }
      if (filters.endDate) {
        query = query.where(lte(cases.diagnosisDate, filters.endDate));
      }
      
      // Zone filtering - resilient approach
      if (filters.zones && filters.zones.length > 0) {
        if (useJoin) {
          query = query.where(sql`ng_states.zone = ANY(ARRAY[${sql.join(filters.zones.map(z => sql`${z}`), sql`, `)}])`);
        } else {
          const allowedStates = statesForZones(filters.zones);
          if (allowedStates.length > 0) {
            query = query.where(
              sql`LOWER(TRIM(${cases.state})) = ANY(ARRAY[${sql.join(allowedStates.map(s => sql`${s}`), sql`, `)}])`
            );
          }
        }
      }
      
      if (filters.states && filters.states.length > 0) {
        query = query.where(inArray(cases.state, filters.states as any));
      }
      if (filters.tumourTypeIds && filters.tumourTypeIds.length > 0) {
        query = query.where(inArray(cases.tumourTypeId, filters.tumourTypeIds));
      }

      // Sorting
      const sortField = filters.sort || 'date';
      const sortOrder = filters.order || 'desc';
      
      if (sortField === 'clinic') {
        query = query.orderBy(sortOrder === 'asc' ? asc(clinics.name) : desc(clinics.name));
      } else if (sortField === 'zone') {
        if (useJoin) {
          query = query.orderBy(sortOrder === 'asc' ? sql`ng_states.zone ASC` : sql`ng_states.zone DESC`);
        } else {
          query = query.orderBy(sortOrder === 'asc' ? asc(cases.state) : desc(cases.state));
        }
      } else if (sortField === 'state') {
        query = query.orderBy(sortOrder === 'asc' ? asc(cases.state) : desc(cases.state));
      } else if (sortField === 'case_number') {
        query = query.orderBy(sortOrder === 'asc' ? asc(cases.caseNumber) : desc(cases.caseNumber));
      } else {
        query = query.orderBy(sortOrder === 'asc' ? asc(cases.diagnosisDate) : desc(cases.diagnosisDate));
      }

      query = query
        .limit(filters.limit || 50)
        .offset(filters.offset || 0);

      const results = await query;

      // Get attachments and follow-ups for each case
      const caseIds = results.map(r => r.cases.id);
      const attachmentsData = caseIds.length > 0 ? await db
        .select()
        .from(attachments)
        .where(inArray(attachments.caseId, caseIds)) : [];
      
      const followUpsData = caseIds.length > 0 ? await db
        .select()
        .from(followUps)
        .where(inArray(followUps.caseId, caseIds)) : [];

      // Get attachment aggregates (count + first image) - resilient
      let attachmentAggregates: Record<string, { count: number; firstImageUrl?: string }> = {};
      try {
        if (caseIds.length > 0) {
          const fileCountsQuery = await db
            .select({
              caseId: caseFiles.caseId,
              count: count(caseFiles.id).as('count'),
            })
            .from(caseFiles)
            .where(and(
              inArray(caseFiles.caseId, caseIds),
              isNull(caseFiles.deletedAt)
            ))
            .groupBy(caseFiles.caseId);

          const firstImages = await db
            .select({
              caseId: caseFiles.caseId,
              publicUrl: caseFiles.publicUrl,
            })
            .from(caseFiles)
            .where(and(
              inArray(caseFiles.caseId, caseIds),
              isNull(caseFiles.deletedAt),
              eq(caseFiles.kind, 'image')
            ))
            .orderBy(desc(caseFiles.createdAt));

          fileCountsQuery.forEach(fc => {
            attachmentAggregates[fc.caseId] = { count: fc.count };
          });

          const imageMap = new Map<string, string>();
          firstImages.forEach(img => {
            if (!imageMap.has(img.caseId)) {
              imageMap.set(img.caseId, img.publicUrl);
            }
          });

          imageMap.forEach((url, caseId) => {
            if (attachmentAggregates[caseId]) {
              attachmentAggregates[caseId].firstImageUrl = url;
            }
          });
        }
      } catch (error) {
        console.error('[getCases] Error fetching attachment aggregates:', error);
        // Continue without aggregates - non-blocking
      }

      return results.map(result => {
        const geoZone = useJoin && 'geo_zone' in result
          ? (result as any).geo_zone || computeZoneFromState(result.cases.state)
          : computeZoneFromState(result.cases.state);

        const aggregates = attachmentAggregates[result.cases.id] || { count: 0 };

        return {
          ...result.cases,
          geoZone,
          clinic: result.clinics!,
          createdBy: result.creator!,
          tumourType: result.tumour_types,
          anatomicalSite: result.anatomical_sites,
          attachments: attachmentsData.filter(a => a.caseId === result.cases.id),
          followUps: followUpsData.filter(f => f.caseId === result.cases.id),
          attachmentsCount: aggregates.count,
          firstImageUrl: aggregates.firstImageUrl,
        };
      });
    } catch (error) {
      console.error('[getCases] Error with zone filtering, falling back to safe query:', error);
      
      // Fallback: simple query without zone filtering
      query = db
        .select()
        .from(cases)
        .leftJoin(clinics, eq(cases.clinicId, clinics.id))
        .leftJoin(creator, eq(cases.createdBy, creator.id))
        .leftJoin(tumourTypes, eq(cases.tumourTypeId, tumourTypes.id))
        .leftJoin(anatomicalSites, eq(cases.anatomicalSiteId, anatomicalSites.id))
        .$dynamic();

      if (filters.clinicIds && filters.clinicIds.length > 0) {
        query = query.where(inArray(cases.clinicId, filters.clinicIds));
      }
      if (filters.species) {
        query = query.where(eq(cases.species, filters.species));
      }
      if (filters.outcome) {
        query = query.where(eq(cases.outcome, filters.outcome as any));
      }
      if (filters.startDate) {
        query = query.where(gte(cases.diagnosisDate, filters.startDate));
      }
      if (filters.endDate) {
        query = query.where(lte(cases.diagnosisDate, filters.endDate));
      }
      if (filters.states && filters.states.length > 0) {
        query = query.where(inArray(cases.state, filters.states as any));
      }
      if (filters.tumourTypeIds && filters.tumourTypeIds.length > 0) {
        query = query.where(inArray(cases.tumourTypeId, filters.tumourTypeIds));
      }

      query = query
        .limit(filters.limit || 50)
        .offset(filters.offset || 0)
        .orderBy(desc(cases.diagnosisDate));

      const results = await query;
      const caseIds = results.map(r => r.cases.id);
      const attachmentsData = caseIds.length > 0 ? await db
        .select()
        .from(attachments)
        .where(inArray(attachments.caseId, caseIds)) : [];
      
      const followUpsData = caseIds.length > 0 ? await db
        .select()
        .from(followUps)
        .where(inArray(followUps.caseId, caseIds)) : [];

      // Get attachment aggregates (fallback path)
      let attachmentAggregates: Record<string, { count: number; firstImageUrl?: string }> = {};
      try {
        if (caseIds.length > 0) {
          const fileCountsQuery = await db
            .select({
              caseId: caseFiles.caseId,
              count: count(caseFiles.id).as('count'),
            })
            .from(caseFiles)
            .where(and(
              inArray(caseFiles.caseId, caseIds),
              isNull(caseFiles.deletedAt)
            ))
            .groupBy(caseFiles.caseId);

          const firstImages = await db
            .select({
              caseId: caseFiles.caseId,
              publicUrl: caseFiles.publicUrl,
            })
            .from(caseFiles)
            .where(and(
              inArray(caseFiles.caseId, caseIds),
              isNull(caseFiles.deletedAt),
              eq(caseFiles.kind, 'image')
            ))
            .orderBy(desc(caseFiles.createdAt));

          fileCountsQuery.forEach(fc => {
            attachmentAggregates[fc.caseId] = { count: fc.count };
          });

          const imageMap = new Map<string, string>();
          firstImages.forEach(img => {
            if (!imageMap.has(img.caseId)) {
              imageMap.set(img.caseId, img.publicUrl);
            }
          });

          imageMap.forEach((url, caseId) => {
            if (attachmentAggregates[caseId]) {
              attachmentAggregates[caseId].firstImageUrl = url;
            }
          });
        }
      } catch (error) {
        console.error('[getCases fallback] Error fetching attachment aggregates:', error);
      }

      return results.map(result => {
        const aggregates = attachmentAggregates[result.cases.id] || { count: 0 };
        return {
          ...result.cases,
          geoZone: computeZoneFromState(result.cases.state),
          clinic: result.clinics!,
          createdBy: result.creator!,
          tumourType: result.tumour_types,
          anatomicalSite: result.anatomical_sites,
          attachments: attachmentsData.filter(a => a.caseId === result.cases.id),
          followUps: followUpsData.filter(f => f.caseId === result.cases.id),
          attachmentsCount: aggregates.count,
          firstImageUrl: aggregates.firstImageUrl,
        };
      });
    }
  }

  async getCase(id: string, clinicId?: string): Promise<CaseWithDetails | undefined> {
    const creator = alias(users, 'creator');
    
    const [result] = await db
      .select()
      .from(cases)
      .leftJoin(clinics, eq(cases.clinicId, clinics.id))
      .leftJoin(creator, eq(cases.createdBy, creator.id))
      .leftJoin(tumourTypes, eq(cases.tumourTypeId, tumourTypes.id))
      .leftJoin(anatomicalSites, eq(cases.anatomicalSiteId, anatomicalSites.id))
      .where(eq(cases.id, id));

    if (!result) return undefined;

    const attachmentsData = await db
      .select()
      .from(attachments)
      .where(eq(attachments.caseId, id));

    const followUpsData = await db
      .select()
      .from(followUps)
      .where(eq(followUps.caseId, id))
      .orderBy(desc(followUps.scheduledFor));

    return {
      ...result.cases,
      clinic: result.clinics!,
      createdBy: result.creator!,
      tumourType: result.tumour_types,
      anatomicalSite: result.anatomical_sites,
      attachments: attachmentsData,
      followUps: followUpsData,
    };
  }

  async getSharedCases(filters: {
    from?: string;
    to?: string;
    clinicIds?: string[];
    geoZones?: string[];
    states?: string[];
    species?: string[];
    tumourTypeIds?: string[];
  } = {}): Promise<Case[]> {
    try {
      const { hasNgStates } = await import('./db/capabilities');
      const { statesForZones } = await import('./geo/nigeria-zones');
      
      let useJoin = false;
      try {
        useJoin = await hasNgStates();
      } catch (error) {
        console.error('[getSharedCases] Error checking ng_states capability:', error);
        useJoin = false;
      }

      let query = db
        .select()
        .from(cases)
        .$dynamic();

      // Apply filters only if provided
      if (filters.clinicIds && filters.clinicIds.length > 0) {
        query = query.where(inArray(cases.clinicId, filters.clinicIds));
      }

      if (filters.geoZones && filters.geoZones.length > 0) {
        if (useJoin) {
          // Use ng_states table for zone filtering
          const allowedStates = await db
            .select({ code: sql<string>`name` })
            .from(sql`ng_states`)
            .where(sql`zone = ANY(ARRAY[${sql.join(filters.geoZones.map(z => sql`${z}`), sql`, `)}])`);
          
          if (allowedStates.length > 0) {
            query = query.where(
              sql`LOWER(TRIM(${cases.state})) = ANY(ARRAY[${sql.join(allowedStates.map(s => sql`LOWER(TRIM(${s.code}))`), sql`, `)}])`
            );
          }
        } else {
          const allowedStates = statesForZones(filters.geoZones);
          if (allowedStates.length > 0) {
            query = query.where(
              sql`LOWER(TRIM(${cases.state})) = ANY(ARRAY[${sql.join(allowedStates.map(s => sql`${s}`), sql`, `)}])`
            );
          }
        }
      }

      if (filters.states && filters.states.length > 0) {
        query = query.where(inArray(cases.state, filters.states));
      }

      if (filters.species && filters.species.length > 0) {
        query = query.where(inArray(cases.species, filters.species as any));
      }

      if (filters.tumourTypeIds && filters.tumourTypeIds.length > 0) {
        query = query.where(inArray(cases.tumourTypeId, filters.tumourTypeIds));
      }

      if (filters.from) {
        query = query.where(gte(cases.diagnosisDate, new Date(filters.from)));
      }

      if (filters.to) {
        query = query.where(lte(cases.diagnosisDate, new Date(filters.to)));
      }

      const results = await query;
      return results;
    } catch (error) {
      console.error('[getSharedCases] Error:', error);
      return [];
    }
  }

  async createCase(caseData: InsertCase): Promise<Case> {
    const caseNumber = await this.generateCaseNumber(caseData.clinicId);
    const [newCase] = await db
      .insert(cases)
      .values({ ...caseData, caseNumber })
      .returning();
    return newCase;
  }

  async updateCase(id: string, updates: Partial<InsertCase>, clinicId: string): Promise<Case> {
    const [updatedCase] = await db
      .update(cases)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(cases.id, id),
        eq(cases.clinicId, clinicId)
      ))
      .returning();
    return updatedCase;
  }

  async deleteCase(id: string, clinicId: string): Promise<void> {
    await db
      .delete(cases)
      .where(and(
        eq(cases.id, id),
        eq(cases.clinicId, clinicId)
      ));
  }

  async generateCaseNumber(clinicId: string): Promise<string> {
    // Atomic generation using sequence - prevents race conditions
    const year = new Date().getFullYear();
    const result = await db.execute<{ nextval: number }>(
      sql`SELECT nextval('case_number_seq') as nextval`
    );
    
    const seqNumber = result.rows[0]?.nextval || 1;
    return `VC-${year}-${seqNumber.toString().padStart(5, '0')}`;
  }

  async getTumourTypes(clinicId?: string, species?: string): Promise<TumourType[]> {
    let query = db.select().from(tumourTypes);
    
    const conditions = [];
    if (clinicId) {
      conditions.push(or(eq(tumourTypes.clinicId, clinicId), isNull(tumourTypes.clinicId)));
    } else {
      conditions.push(isNull(tumourTypes.clinicId));
    }
    
    if (species) {
      conditions.push(or(eq(tumourTypes.species, species), isNull(tumourTypes.species)));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return await query.orderBy(asc(tumourTypes.name));
  }

  async createTumourType(tumourType: InsertTumourType): Promise<TumourType> {
    const [newType] = await db.insert(tumourTypes).values(tumourType).returning();
    return newType;
  }

  async getAnatomicalSites(clinicId?: string, species?: string): Promise<AnatomicalSite[]> {
    let query = db.select().from(anatomicalSites);
    
    const conditions = [];
    if (clinicId) {
      conditions.push(or(eq(anatomicalSites.clinicId, clinicId), isNull(anatomicalSites.clinicId)));
    } else {
      conditions.push(isNull(anatomicalSites.clinicId));
    }
    
    if (species) {
      conditions.push(or(eq(anatomicalSites.species, species), isNull(anatomicalSites.species)));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return await query.orderBy(asc(anatomicalSites.name));
  }

  async createAnatomicalSite(site: InsertAnatomicalSite): Promise<AnatomicalSite> {
    const [newSite] = await db.insert(anatomicalSites).values(site).returning();
    return newSite;
  }

  async getNigerianStates(): Promise<Array<{ code: string; name: string; zone: string }>> {
    return await db.select({
      code: ngStates.code,
      name: ngStates.name,
      zone: ngStates.zone,
    }).from(ngStates).orderBy(asc(ngStates.name));
  }

  async getClinicsList(): Promise<Array<{ id: string; name: string }>> {
    return await db.select({
      id: clinics.id,
      name: clinics.name,
    }).from(clinics).orderBy(asc(clinics.name));
  }

  async getTumourTypesList(): Promise<Array<{ id: string; name: string }>> {
    return await db.select({
      id: tumourTypes.id,
      name: tumourTypes.name,
    }).from(tumourTypes)
      .where(eq(tumourTypes.isSystem, true))
      .orderBy(asc(tumourTypes.name));
  }

  async createAttachment(attachment: InsertAttachment): Promise<Attachment> {
    const [newAttachment] = await db.insert(attachments).values(attachment).returning();
    return newAttachment;
  }

  async getAttachments(caseId: string): Promise<Attachment[]> {
    return await db
      .select()
      .from(attachments)
      .where(eq(attachments.caseId, caseId))
      .orderBy(desc(attachments.createdAt));
  }

  async deleteAttachment(id: string, clinicId: string): Promise<void> {
    await db
      .delete(attachments)
      .where(and(
        eq(attachments.id, id),
        sql`EXISTS (SELECT 1 FROM ${cases} WHERE ${cases.id} = ${attachments.caseId} AND ${cases.clinicId} = ${clinicId})`
      ));
  }

  async createCaseFile(caseFile: InsertCaseFile): Promise<CaseFile> {
    const [newFile] = await db.insert(caseFiles).values(caseFile).returning();
    return newFile;
  }

  async getCaseFiles(caseId: string): Promise<CaseFile[]> {
    return await db
      .select()
      .from(caseFiles)
      .where(and(
        eq(caseFiles.caseId, caseId),
        isNull(caseFiles.deletedAt)
      ))
      .orderBy(desc(caseFiles.createdAt));
  }

  async softDeleteCaseFile(id: string): Promise<void> {
    await db
      .update(caseFiles)
      .set({ deletedAt: new Date() })
      .where(eq(caseFiles.id, id));
  }

  async getCaseFileById(id: string): Promise<CaseFile | undefined> {
    const [file] = await db.select().from(caseFiles).where(eq(caseFiles.id, id));
    return file || undefined;
  }

  async getFeedPosts(clinicId?: string, limit: number = 20): Promise<FeedPost[]> {
    let query = db
      .select()
      .from(feedPosts)
      .where(eq(feedPosts.status, 'PUBLISHED'));
    
    if (clinicId) {
      query = query.where(or(
        eq(feedPosts.clinicId, clinicId),
        isNull(feedPosts.clinicId)
      ));
    } else {
      query = query.where(isNull(feedPosts.clinicId));
    }
    
    return await query
      .orderBy(desc(feedPosts.publishedAt))
      .limit(limit);
  }

  async getSharedFeedPosts(filters: {
    clinicId?: string;
    state?: string;
    zone?: string;
    from?: string;
    to?: string;
    limit?: number;
    cursor?: string;
  } = {}): Promise<{ items: FeedPost[]; nextCursor?: string }> {
    try {
      const limit = filters.limit || 20;
      
      let query = db
        .select({
          post: feedPosts,
          clinic: clinics,
        })
        .from(feedPosts)
        .leftJoin(clinics, eq(feedPosts.clinicId, clinics.id))
        .where(eq(feedPosts.status, 'PUBLISHED'))
        .$dynamic();

      // Apply cursor pagination
      if (filters.cursor) {
        query = query.where(sql`${feedPosts.createdAt} < ${new Date(filters.cursor)}`);
      }

      // Apply optional filters
      if (filters.clinicId) {
        query = query.where(eq(feedPosts.clinicId, filters.clinicId));
      }

      if (filters.state) {
        query = query.where(eq(clinics.state, filters.state));
      }

      if (filters.zone) {
        // Zone filtering through clinic's state
        const { statesForZones } = await import('./geo/nigeria-zones');
        const allowedStates = statesForZones([filters.zone]);
        if (allowedStates.length > 0) {
          query = query.where(inArray(clinics.state, allowedStates));
        }
      }

      if (filters.from) {
        query = query.where(gte(feedPosts.createdAt, new Date(filters.from)));
      }

      if (filters.to) {
        query = query.where(lte(feedPosts.createdAt, new Date(filters.to)));
      }

      // Fetch limit + 1 to determine if there's a next page
      const results = await query
        .orderBy(desc(feedPosts.createdAt))
        .limit(limit + 1);

      const hasMore = results.length > limit;
      const items = hasMore ? results.slice(0, limit) : results;
      
      const feedItems = items.map(r => r.post);
      const nextCursor = hasMore && feedItems.length > 0
        ? feedItems[feedItems.length - 1].createdAt.toISOString()
        : undefined;

      return {
        items: feedItems,
        nextCursor,
      };
    } catch (error) {
      console.error('[getSharedFeedPosts] Error:', error);
      return {
        items: [],
      };
    }
  }

  async createFeedPost(post: InsertFeedPost): Promise<FeedPost> {
    const [newPost] = await db.insert(feedPosts).values(post).returning();
    return newPost;
  }

  async updateFeedPost(id: string, updates: Partial<InsertFeedPost>, clinicId: string): Promise<FeedPost> {
    const [updatedPost] = await db
      .update(feedPosts)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(feedPosts.id, id),
        eq(feedPosts.clinicId, clinicId)
      ))
      .returning();
    return updatedPost;
  }

  async getFollowUps(caseId: string): Promise<FollowUp[]> {
    return await db
      .select()
      .from(followUps)
      .where(eq(followUps.caseId, caseId))
      .orderBy(desc(followUps.scheduledFor));
  }

  async createFollowUp(followUp: InsertFollowUp): Promise<FollowUp> {
    const [newFollowUp] = await db.insert(followUps).values(followUp).returning();
    return newFollowUp;
  }

  async updateFollowUp(id: string, updates: Partial<InsertFollowUp>): Promise<FollowUp> {
    const [updatedFollowUp] = await db
      .update(followUps)
      .set(updates)
      .where(eq(followUps.id, id))
      .returning();
    return updatedFollowUp;
  }

  async getUpcomingFollowUps(clinicId: string, days: number = 7): Promise<FollowUp[]> {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    
    return await db
      .select()
      .from(followUps)
      .leftJoin(cases, eq(followUps.caseId, cases.id))
      .where(and(
        eq(cases.clinicId, clinicId),
        eq(followUps.isCompleted, false),
        lte(followUps.scheduledFor, endDate),
        gte(followUps.scheduledFor, new Date())
      ))
      .orderBy(asc(followUps.scheduledFor));
  }

  async getDashboardStats(clinicId: string): Promise<DashboardStats> {
    // Total cases
    const [totalCasesResult] = await db
      .select({ count: count() })
      .from(cases)
      .where(eq(cases.clinicId, clinicId));

    // New cases this month
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    
    const [newThisMonthResult] = await db
      .select({ count: count() })
      .from(cases)
      .where(and(
        eq(cases.clinicId, clinicId),
        gte(cases.createdAt, thisMonth)
      ));

    // Remission rate
    const [remissionResult] = await db
      .select({ 
        total: count(),
        remission: count(sql`CASE WHEN ${cases.outcome} = 'REMISSION' THEN 1 END`)
      })
      .from(cases)
      .where(and(
        eq(cases.clinicId, clinicId),
        sql`${cases.outcome} IS NOT NULL`
      ));

    const remissionRate = remissionResult.total > 0 
      ? Math.round((remissionResult.remission / remissionResult.total) * 100) 
      : 0;

    // Top tumour types
    const topTumourTypesRaw = await db
      .select({
        name: tumourTypes.name,
        customName: cases.tumourTypeCustom,
        count: count()
      })
      .from(cases)
      .leftJoin(tumourTypes, eq(cases.tumourTypeId, tumourTypes.id))
      .where(eq(cases.clinicId, clinicId))
      .groupBy(tumourTypes.name, cases.tumourTypeCustom)
      .orderBy(desc(count()))
      .limit(5);

    const topTumourTypes = topTumourTypesRaw.map(item => ({
      name: item.name || item.customName || 'Unknown',
      count: item.count
    }));

    // Cases by month (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const casesByMonthRaw = await db
      .select({
        month: sql<string>`TO_CHAR(${cases.diagnosisDate}, 'YYYY-MM')`,
        count: count()
      })
      .from(cases)
      .where(and(
        eq(cases.clinicId, clinicId),
        gte(cases.diagnosisDate, sixMonthsAgo)
      ))
      .groupBy(sql`TO_CHAR(${cases.diagnosisDate}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${cases.diagnosisDate}, 'YYYY-MM')`);

    // Mock data for demonstration - replace with real queries
    return {
      totalCases: totalCasesResult.count,
      newThisMonth: newThisMonthResult.count,
      activeClinics: 1, // Current clinic
      remissionRate,
      casesByMonth: casesByMonthRaw.map(item => ({
        month: item.month,
        count: item.count
      })),
      topTumourTypes,
      casesByState: [], // Would need clinic location data
      recentActivity: [] // Would need audit logs
    };
  }

  async getSharedDashboardStats(filters: {
    clinicIds?: string[];
    geoZones?: string[];
    states?: string[];
    species?: string[];
    tumourTypeIds?: string[];
    from?: string;
    to?: string;
  } = {}): Promise<DashboardStats> {
    try {
      const { hasNgStates } = await import('./db/capabilities');
      const { statesForZones } = await import('./geo/nigeria-zones');
      
      let useJoin = false;
      try {
        useJoin = await hasNgStates();
      } catch {
        useJoin = false;
      }

      // Build dynamic query with filters
      let query = db.select().from(cases).$dynamic();

      if (filters.clinicIds && filters.clinicIds.length > 0) {
        query = query.where(inArray(cases.clinicId, filters.clinicIds));
      }

      if (filters.geoZones && filters.geoZones.length > 0) {
        if (useJoin) {
          const allowedStates = await db
            .select({ code: sql<string>`name` })
            .from(sql`ng_states`)
            .where(sql`zone = ANY(ARRAY[${sql.join(filters.geoZones.map(z => sql`${z}`), sql`, `)}])`);
          
          if (allowedStates.length > 0) {
            query = query.where(
              sql`LOWER(TRIM(${cases.state})) = ANY(ARRAY[${sql.join(allowedStates.map(s => sql`LOWER(TRIM(${s.code}))`), sql`, `)}])`
            );
          }
        } else {
          const allowedStates = statesForZones(filters.geoZones);
          if (allowedStates.length > 0) {
            query = query.where(
              sql`LOWER(TRIM(${cases.state})) = ANY(ARRAY[${sql.join(allowedStates.map(s => sql`${s}`), sql`, `)}])`
            );
          }
        }
      }

      if (filters.states && filters.states.length > 0) {
        query = query.where(inArray(cases.state, filters.states));
      }

      if (filters.species && filters.species.length > 0) {
        query = query.where(inArray(cases.species, filters.species as any));
      }

      if (filters.tumourTypeIds && filters.tumourTypeIds.length > 0) {
        query = query.where(inArray(cases.tumourTypeId, filters.tumourTypeIds));
      }

      if (filters.from) {
        query = query.where(gte(cases.diagnosisDate, new Date(filters.from)));
      }

      if (filters.to) {
        query = query.where(lte(cases.diagnosisDate, new Date(filters.to)));
      }

      // Execute the filtered query to get all matching cases
      const allCases = await query;

      // Total cases
      const totalCases = allCases.length;

      // New cases this month
      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);
      const newThisMonth = allCases.filter(c => new Date(c.diagnosisDate) >= thisMonth).length;

      // Remission rate
      const casesWithOutcome = allCases.filter(c => c.outcome);
      const remissionCases = casesWithOutcome.filter(c => c.outcome === 'REMISSION').length;
      const remissionRate = casesWithOutcome.length > 0 
        ? remissionCases / casesWithOutcome.length
        : 0;

      // Active clinics (distinct clinic IDs)
      const uniqueClinics = new Set(allCases.map(c => c.clinicId));
      const activeClinics = uniqueClinics.size;

      // Cases by month
      const monthCounts = new Map<string, number>();
      allCases.forEach(c => {
        const month = new Date(c.diagnosisDate).toISOString().slice(0, 7); // YYYY-MM
        monthCounts.set(month, (monthCounts.get(month) || 0) + 1);
      });
      const casesByMonth = Array.from(monthCounts.entries())
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month));

      // Top tumour types
      const tumourCounts = new Map<string, number>();
      allCases.forEach(c => {
        const tumourName = c.tumourTypeCustom || 'Unknown';
        tumourCounts.set(tumourName, (tumourCounts.get(tumourName) || 0) + 1);
      });
      
      // Get tumour type names from database for cases with tumourTypeId
      const casesWithTumourType = allCases.filter(c => c.tumourTypeId);
      if (casesWithTumourType.length > 0) {
        const tumourTypeIds = [...new Set(casesWithTumourType.map(c => c.tumourTypeId).filter(Boolean))];
        const tumourTypesData = await db
          .select()
          .from(tumourTypes)
          .where(inArray(tumourTypes.id, tumourTypeIds as string[]));
        
        const tumourTypeMap = new Map(tumourTypesData.map(t => [t.id, t.name]));
        casesWithTumourType.forEach(c => {
          const name = tumourTypeMap.get(c.tumourTypeId!) || 'Unknown';
          tumourCounts.set(name, (tumourCounts.get(name) || 0) + 1);
        });
      }

      const topTumourTypes = Array.from(tumourCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        totalCases,
        newThisMonth,
        remissionRate: Math.round(remissionRate * 100),
        activeClinics,
        casesByMonth,
        topTumourTypes,
        casesByState: [],
        recentActivity: [],
      };
    } catch (error) {
      console.error('[getSharedDashboardStats] Error:', error);
      return {
        totalCases: 0,
        newThisMonth: 0,
        remissionRate: 0,
        activeClinics: 0,
        casesByMonth: [],
        topTumourTypes: [],
        casesByState: [],
        recentActivity: [],
      };
    }
  }

  async getSharedAnalyticsStats(filters: {
    clinicIds?: string[];
    geoZones?: string[];
    states?: string[];
    species?: string[];
    tumourTypeIds?: string[];
    from?: string;
    to?: string;
  } = {}): Promise<{
    totals: {
      totalCases: number;
      newThisMonth: number;
      remissionRate: number;
      activeClinics: number;
    };
    casesOverTime: Array<{ date: string; count: number }>;
    tumourDistribution: Array<{ name: string; count: number }>;
  }> {
    try {
      // Reuse dashboard stats logic
      const dashboardStats = await this.getSharedDashboardStats(filters);
      
      // Map to analytics format
      return {
        totals: dashboardStats.totals,
        casesOverTime: dashboardStats.casesByMonth.map(item => ({
          date: item.month, // YYYY-MM format
          count: item.count
        })),
        tumourDistribution: dashboardStats.topTumourTypes
      };
    } catch (error) {
      console.error('[getSharedAnalyticsStats] Error:', error);
      return {
        totals: {
          totalCases: 0,
          newThisMonth: 0,
          remissionRate: 0,
          activeClinics: 0,
        },
        casesOverTime: [],
        tumourDistribution: [],
      };
    }
  }

  async createImportJob(job: Partial<ImportJob>): Promise<ImportJob> {
    const [newJob] = await db.insert(importJobs).values(job as any).returning();
    return newJob;
  }

  async updateImportJob(id: string, updates: Partial<ImportJob>): Promise<ImportJob> {
    const [updatedJob] = await db
      .update(importJobs)
      .set(updates)
      .where(eq(importJobs.id, id))
      .returning();
    return updatedJob;
  }

  async getImportJobs(clinicId: string): Promise<ImportJob[]> {
    return await db
      .select()
      .from(importJobs)
      .where(eq(importJobs.clinicId, clinicId))
      .orderBy(desc(importJobs.createdAt));
  }

  async createAuditLog(log: {
    actorId?: string;
    clinicId?: string;
    entityType: string;
    entityId: string;
    action: string;
    diff?: any;
    ip?: string;
    userAgent?: string;
  }): Promise<void> {
    await db.insert(auditLogs).values(log);
  }
}

export const storage = new DatabaseStorage();
