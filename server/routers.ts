import { CUSTOM_AUTH_COOKIE } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { eq, and, desc, not, sql, gte, lte, or, isNull, like, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  getActiveEventWindows,
  getAllEventWindows,
  seedEventWindowsIfEmpty,
} from "./events";
import { getDb } from "./db";
import { eventWindows } from "../drizzle/schema";
import { inboundRouter } from "./routers/inbound";
import { scraperConfigRouter } from "./routers/scraper-config";

// ─── Events router (must be defined before appRouter) ───────────────────────
const eventsRouter = router({
  /** Public: returns event windows currently in their visibility window (for filter chips) */
  getActiveFilters: publicProcedure
    .input(z.object({ marketId: z.string().optional() }))
    .query(async ({ input }) => {
      await seedEventWindowsIfEmpty();
      const windows = await getActiveEventWindows(input.marketId);
      return windows.map((w) => ({
        id: w.id,
        eventName: w.eventName,
        filterLabel: w.filterLabel,
        marketId: w.marketId,
        city: w.city,
        region: w.region,
        startDate: w.startDate,
        endDate: w.endDate,
        leadBoostMultiplier: w.leadBoostMultiplier,
        relevantPerformerTypes: w.relevantPerformerTypes as string[],
      }));
    }),

  /** Admin: returns all event windows */
  getAllEvents: publicProcedure.query(async () => {
    await seedEventWindowsIfEmpty();
    return getAllEventWindows();
  }),

  /** Admin: toggle event window active/inactive */
  toggleEvent: publicProcedure
    .input(z.object({ id: z.number(), activeStatus: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.update(eventWindows).set({ activeStatus: input.activeStatus }).where(eq(eventWindows.id, input.id));
      return { ok: true };
    }),

  /** Admin: add a new event window */
  addEvent: publicProcedure
    .input(z.object({
      city: z.string(),
      region: z.string(),
      marketId: z.string(),
      eventName: z.string(),
      filterLabel: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      leadDays: z.number().default(90),
      leadBoostMultiplier: z.string().default("1.00"),
      searchKeywordPack: z.array(z.string()),
      relevantPerformerTypes: z.array(z.string()),
      eventYear: z.number(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.insert(eventWindows).values({
        ...input,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        activeStatus: true,
      });
      return { ok: true };
    }),

  /** Admin: update event window */
  updateEvent: publicProcedure
    .input(z.object({
      id: z.number(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      leadDays: z.number().optional(),
      leadBoostMultiplier: z.string().optional(),
      filterLabel: z.string().optional(),
      searchKeywordPack: z.array(z.string()).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { id, startDate, endDate, ...rest } = input;
      await db.update(eventWindows).set({
        ...rest,
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate ? { endDate: new Date(endDate) } : {}),
      }).where(eq(eventWindows.id, id));
      return { ok: true };
    }),

  /** Admin: delete an event window */
  deleteEvent: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.delete(eventWindows).where(eq(eventWindows.id, input.id));
      return { ok: true };
    }),
});

export const appRouter = router({
  system: systemRouter,
  events: eventsRouter,
  inbound: inboundRouter,
  scraperConfig: scraperConfigRouter,
  publicLeads: router({
    // Public client intake: /book-dj
    submitClientLead: publicProcedure
      .input(z.object({
        name: z.string().min(1),
        email: z.string().email(),
        eventDate: z.string().optional(),
        location: z.string().min(1),
        eventType: z.string().min(1),
        budget: z.number().min(0).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { gigLeads } = await import("../drizzle/schema");

        const budgetCents = input.budget != null ? Math.round(input.budget * 100) : null;

        const leadTitle = `${input.eventType} - ${input.location}`;
        const descriptionParts = [
          `Client name: ${input.name}`,
          `Client email: ${input.email}`,
          input.notes ? `Notes: ${input.notes}` : null,
        ].filter(Boolean);

        await db.insert(gigLeads).values({
          externalId: `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          source: "gigxo",
          leadType: "client_submitted",
          title: leadTitle,
          description: descriptionParts.join("\n"),
          eventType: input.eventType,
          budget: budgetCents ?? null,
          location: input.location,
          eventDate: input.eventDate ? new Date(input.eventDate) : null,
          contactName: input.name,
          contactEmail: input.email,
          contactPhone: null,
          venueUrl: null,
          performerType: "dj",
          leadCategory: "general",
          // Mark as high-intent so it floats up in future scoring
          intentScore: 90,
          leadTemperature: "hot",
        } as any);

        return { success: true };
      }),
  }),
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    
    // Email/password signup
    signup: publicProcedure
      .input(z.object({
        name: z.string().min(2, "Name must be at least 2 characters"),
        email: z.string().email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
        referralCode: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { signupWithEmail } = await import("./customAuth");
        const { user, token } = await signupWithEmail(input);
        
        // Set session cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(CUSTOM_AUTH_COOKIE, token, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
        
        // Send welcome email + handle referral (async)
        const origin = ctx.req.headers.origin ?? "https://gigxo.com";
        const referralLink = `${origin}?ref=${user.id}`;
        if (user.email) {
          const { sendWelcomeEmail } = await import("./email");
          sendWelcomeEmail(user.email, user.name ?? "Artist", referralLink).catch(console.error);
        }
        
        if (input.referralCode) {
          const referrerId = parseInt(input.referralCode.replace("ref-", ""), 10);
          if (!isNaN(referrerId) && referrerId !== user.id) {
            const { getDb } = await import("./db");
            const db = await getDb();
            if (db) {
              const { referrals, userCredits, users } = await import("../drizzle/schema");
              await db.insert(referrals).values({ referrerId, referredId: user.id, referralCode: input.referralCode, creditAmount: 700, creditApplied: false });
              await db.insert(userCredits).values({ userId: referrerId, amount: 700, source: "referral" });
              await db.insert(userCredits).values({ userId: user.id, amount: 350, source: "referral" });
              const referrer = await db.select().from(users).where(eq(users.id, referrerId)).limit(1);
              if (referrer.length > 0 && referrer[0].email) {
                const { sendReferralCreditEmail } = await import("./email");
                sendReferralCreditEmail(referrer[0].email, referrer[0].name ?? "Artist", user.name ?? "a friend", 7).catch(console.error);
              }
            }
          }
        }
        
        return { success: true, user, token };
      }),
    
    // Email/password login
    login: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { loginWithEmail } = await import("./customAuth");
        const { user, token } = await loginWithEmail(input);
        
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(CUSTOM_AUTH_COOKIE, token, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
        
        return { success: true, user, token };
      }),
    
    // Request password reset
    requestPasswordReset: publicProcedure
      .input(z.object({ email: z.string().email(), origin: z.string().url().optional() }))
      .mutation(async ({ ctx, input }) => {
        const { requestPasswordReset } = await import("./customAuth");
        // Use the provided origin, fall back to request header origin, then gigxo.com
        const origin = input.origin ?? ctx.req.headers.origin ?? "https://gigxo.com";
        await requestPasswordReset(input.email, origin);
        return { success: true }; // Always return success
      }),
    
    // Reset password with token
    resetPassword: publicProcedure
      .input(z.object({
        token: z.string(),
        newPassword: z.string().min(8),
      }))
      .mutation(async ({ input }) => {
        const { resetPassword } = await import("./customAuth");
        await resetPassword(input.token, input.newPassword);
        return { success: true };
      }),
    
    // Verify email address
    verifyEmail: publicProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ ctx }) => {
        const { verifyEmail } = await import("./customAuth");
        const user = await verifyEmail(ctx.req.query.token as string || "");
        return { success: true, user };
      }),

    // Verify email by token (query param approach for link clicks)
    verifyEmailByToken: publicProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ input }) => {
        const { verifyEmail } = await import("./customAuth");
        const user = await verifyEmail(input.token);
        return { success: true, user };
      }),

    // Resend verification email
    resendVerification: protectedProcedure
      .input(z.object({ origin: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const { resendVerificationEmail } = await import("./customAuth");
        const origin = input.origin ?? ctx.req.headers.origin ?? "https://gigxo.com";
        await resendVerificationEmail(ctx.user.id, origin);
        return { success: true };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(CUSTOM_AUTH_COOKIE, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    
    // Called after login to trigger welcome email + referral attribution
    onLogin: protectedProcedure
      .input(z.object({ 
        referralCode: z.string().optional(),
        origin: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) return { success: true };
        
        const { users, referrals, userCredits } = await import("../drizzle/schema");
        
        // Check if this is a new user (created in the last 60 seconds)
        const user = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
        const isNewUser = user.length > 0 && 
          (Date.now() - user[0].createdAt.getTime()) < 60000;
        
        if (isNewUser) {
          // Send welcome email
          const { sendWelcomeEmail } = await import("./email");
          const referralCode = `ref-${ctx.user.id}`;
          const origin = input.origin ?? "https://gigxo.com";
          const referralLink = `${origin}?ref=${ctx.user.id}`;
          if (ctx.user.email) {
            sendWelcomeEmail(ctx.user.email, ctx.user.name ?? "Artist", referralLink).catch(console.error);
          }
          
          // Process referral attribution
          if (input.referralCode) {
            const referrerId = parseInt(input.referralCode.replace("ref-", ""), 10);
            if (!isNaN(referrerId) && referrerId !== ctx.user.id) {
              // Record referral
              await db.insert(referrals).values({
                referrerId,
                referredId: ctx.user.id,
                referralCode: input.referralCode,
                creditAmount: 700,
                creditApplied: false,
              });
              
              // Give referrer a $7 credit
              await db.insert(userCredits).values({
                userId: referrerId,
                amount: 700,
                source: "referral",
              });
              
              // Give new user 50% off their first unlock (store as $3.50 credit)
              await db.insert(userCredits).values({
                userId: ctx.user.id,
                amount: 350,
                source: "referral",
              });
              
              // Notify referrer
              const referrer = await db.select().from(users).where(eq(users.id, referrerId)).limit(1);
              if (referrer.length > 0 && referrer[0].email) {
              const { sendReferralCreditEmail } = await import("./email");
              sendReferralCreditEmail(
                referrer[0].email, 
                referrer[0].name ?? "Artist",
                ctx.user.name ?? "a friend",
                7
              ).catch(console.error);
              }
            }
          }
        }
        
        return { success: true, isNewUser };
      }),
  }),

  // Artist profile procedures
  artist: router({
    // Legacy alias – kept for backwards compatibility
    getProfile: protectedProcedure.query(async ({ ctx }) => {
      const { getOrCreateArtistProfile } = await import("./db");
      return await getOrCreateArtistProfile(ctx.user.id);
    }),

    // v1 Artist Profile Engine: always returns or auto-creates the artist profile
    getMyArtistProfile: protectedProcedure.query(async ({ ctx }) => {
      const { getOrCreateArtistProfile } = await import("./db");
      return await getOrCreateArtistProfile(ctx.user.id);
    }),
    
    // Legacy update (used by older clients) – still supported
    updateProfile: protectedProcedure
      .input(z.object({
        djName: z.string().max(128).optional(),
        slug: z.string().max(128).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only").optional(),
        photoUrl: z.string().url().optional(),
        genres: z.array(z.string()).optional(),
        location: z.string().optional(),
        experienceLevel: z.enum(["beginner", "intermediate", "professional", "expert"]).optional(),
        minBudget: z.number().optional(),
        maxDistance: z.number().optional(),
        equipment: z.array(z.string()).optional(),
        bio: z.string().optional(),
        soundcloudUrl: z.string().optional(),
        mixcloudUrl: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { artistProfiles } = await import("../drizzle/schema");
        const { getDb } = await import("./db");
        
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const existing = await db.select().from(artistProfiles)
          .where(eq(artistProfiles.userId, ctx.user.id)).limit(1);
        
        if (existing.length === 0) {
          await db.insert(artistProfiles).values({
            userId: ctx.user.id,
            djName: input.djName,
            slug: input.slug,
            photoUrl: input.photoUrl,
            location: input.location ?? "Miami, FL",
            experienceLevel: input.experienceLevel ?? "intermediate",
            minBudget: input.minBudget ?? 0,
            maxDistance: input.maxDistance ?? 30,
            genres: input.genres,
            equipment: input.equipment,
            bio: input.bio,
            soundcloudUrl: input.soundcloudUrl,
            mixcloudUrl: input.mixcloudUrl,
          });
        } else {
          const updateData: Record<string, unknown> = {};
          if (input.djName !== undefined) updateData.djName = input.djName;
          if (input.slug !== undefined) updateData.slug = input.slug;
          if (input.photoUrl !== undefined) updateData.photoUrl = input.photoUrl;
          if (input.genres !== undefined) updateData.genres = input.genres;
          if (input.location !== undefined) updateData.location = input.location;
          if (input.experienceLevel !== undefined) updateData.experienceLevel = input.experienceLevel;
          if (input.minBudget !== undefined) updateData.minBudget = input.minBudget;
          if (input.maxDistance !== undefined) updateData.maxDistance = input.maxDistance;
          if (input.equipment !== undefined) updateData.equipment = input.equipment;
          if (input.bio !== undefined) updateData.bio = input.bio;
          if (input.soundcloudUrl !== undefined) updateData.soundcloudUrl = input.soundcloudUrl;
          if (input.mixcloudUrl !== undefined) updateData.mixcloudUrl = input.mixcloudUrl;
          await db.update(artistProfiles).set(updateData).where(eq(artistProfiles.userId, ctx.user.id));
        }
        return { success: true };
      }),

    // v1 Artist Profile Engine: upsert current user's profile with extended fields
    upsertMyArtistProfile: protectedProcedure
      .input(z.object({
        stageName: z.string().max(128).optional(),
        slug: z.string().max(128).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only").optional(),
        bio: z.string().optional(),
        heroImageUrl: z.string().url().optional(),
        avatarUrl: z.string().url().optional(),
        location: z.string().optional(),
        templateId: z.string().max(64).optional(),
        themePrimary: z.string().max(16).optional(),
        themeAccent: z.string().max(16).optional(),
        isPublished: z.boolean().optional(),
        currentResidencies: z.array(z.string()).optional(),
        soundcloudUrl: z.string().url().optional(),
        youtubeUrl: z.string().url().optional(),
        instagramUrl: z.string().url().optional(),
        tiktokUrl: z.string().url().optional(),
        websiteUrl: z.string().url().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getDb, getOrCreateArtistProfile } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { artistProfiles } = await import("../drizzle/schema");

        // Ensure profile exists (auto-create with defaults if missing)
        const profile = await getOrCreateArtistProfile(ctx.user.id);
        if (!profile) throw new Error("Failed to load or create artist profile");

        const updateData: Record<string, unknown> = {};
        if (input.stageName !== undefined) {
          updateData.stageName = input.stageName;
          updateData.djName = input.stageName;
        }
        if (input.slug !== undefined) updateData.slug = input.slug;
        if (input.bio !== undefined) updateData.bio = input.bio;
        if (input.heroImageUrl !== undefined) updateData.heroImageUrl = input.heroImageUrl;
        if (input.avatarUrl !== undefined) updateData.avatarUrl = input.avatarUrl;
        if (input.location !== undefined) updateData.location = input.location;
        if (input.templateId !== undefined) updateData.templateId = input.templateId;
        if (input.themePrimary !== undefined) updateData.themePrimary = input.themePrimary;
        if (input.themeAccent !== undefined) updateData.themeAccent = input.themeAccent;
        if (input.isPublished !== undefined) updateData.isPublished = input.isPublished;
        if (input.currentResidencies !== undefined) updateData.currentResidencies = input.currentResidencies;
        if (input.soundcloudUrl !== undefined) updateData.soundcloudUrl = input.soundcloudUrl;
        if (input.youtubeUrl !== undefined) updateData.youtubeUrl = input.youtubeUrl;
        if (input.instagramUrl !== undefined) updateData.instagramUrl = input.instagramUrl;
        if (input.tiktokUrl !== undefined) updateData.tiktokUrl = input.tiktokUrl;
        if (input.websiteUrl !== undefined) updateData.websiteUrl = input.websiteUrl;

        if (Object.keys(updateData).length > 0) {
          await db.update(artistProfiles).set(updateData).where(eq(artistProfiles.userId, ctx.user.id));
        }

        const updated = await db.select().from(artistProfiles).where(eq(artistProfiles.userId, ctx.user.id)).limit(1);
        return updated.length > 0 ? updated[0] : null;
      }),
      
    getMyUnlocks: protectedProcedure.query(async ({ ctx }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const { leadUnlocks, gigLeads } = await import("../drizzle/schema");
      
      const unlocks = await db.select({
        unlockId: leadUnlocks.id,
        leadId: leadUnlocks.leadId,
        unlockedAt: leadUnlocks.unlockedAt,
        title: gigLeads.title,
        location: gigLeads.location,
        budget: gigLeads.budget,
        eventType: gigLeads.eventType,
        eventDate: gigLeads.eventDate,
        contactName: gigLeads.contactName,
        contactEmail: gigLeads.contactEmail,
        contactPhone: gigLeads.contactPhone,
      })
      .from(leadUnlocks)
      .innerJoin(gigLeads, eq(leadUnlocks.leadId, gigLeads.id))
      .where(eq(leadUnlocks.userId, ctx.user.id))
      .orderBy(desc(leadUnlocks.unlockedAt));
      
      return unlocks;
    }),
    
    getMyCredits: protectedProcedure.query(async ({ ctx }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return { totalCredits: 0, credits: [] };
      
      const { userCredits } = await import("../drizzle/schema");
      const credits = await db.select().from(userCredits)
        .where(and(eq(userCredits.userId, ctx.user.id), eq(userCredits.isUsed, false)))
        .orderBy(desc(userCredits.createdAt));
      
      const totalCredits = credits.reduce((sum, c) => sum + c.amount, 0);
      return { totalCredits, credits };
    }),
  }),

  // Lead discovery procedures
  leads: router({
    getAvailable: protectedProcedure
      .input(z.object({
        limit: z.number().default(50),
        offset: z.number().default(0),
        eventType: z.string().optional(),
        performerType: z.string().optional(),
        minBudget: z.number().optional(),
        maxBudget: z.number().optional(),
        city: z.string().optional(), // e.g. "New York City", "Miami", "Los Angeles"
      }))
      .query(async ({ ctx, input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const { gigLeads, leadUnlocks, leadViews } = await import("../drizzle/schema");
        
        // Get all approved leads that are not hidden, not reserved, and not expired
        const now = new Date();
        const leads = await db.select().from(gigLeads)
          .where(and(
            eq(gigLeads.isApproved, true),
            eq(gigLeads.isHidden, false),
            eq(gigLeads.isReserved, false),
            // Only show leads where eventDate is in the future OR eventDate is not set
            or(isNull(gigLeads.eventDate), gte(gigLeads.eventDate, now))
          ))
          .orderBy(desc(gigLeads.createdAt))
          .limit(input.limit)
          .offset(input.offset);
        
        // Get which leads this user has unlocked
        const userUnlocks = await db.select({ leadId: leadUnlocks.leadId })
          .from(leadUnlocks)
          .where(eq(leadUnlocks.userId, ctx.user.id));
        
        const unlockedLeadIds = new Set(userUnlocks.map(u => u.leadId));
        
        // Filter by event type / performer type / city if specified
        let filtered = leads;
        if (input.eventType) {
          filtered = leads.filter(l => l.eventType === input.eventType);
        }
        if (input.performerType) {
          filtered = filtered.filter(l => l.performerType === input.performerType);
        }
        if (input.minBudget) {
          filtered = filtered.filter(l => l.budget && l.budget >= input.minBudget! * 100);
        }
        if (input.maxBudget) {
          filtered = filtered.filter(l => l.budget && l.budget <= input.maxBudget! * 100);
        }
        if (input.city) {
          const cityLower = input.city.toLowerCase();
          filtered = filtered.filter(l => l.location.toLowerCase().includes(cityLower));
        }
        
        // Get view + unlock counts for social proof
        const leadIds = filtered.map(l => l.id);
        const viewCounts: Record<number, number> = {};
        const unlockCounts: Record<number, number> = {};
        
        if (leadIds.length > 0) {
          const viewRows = await db.select({
            leadId: leadViews.leadId,
            cnt: sql<number>`COUNT(*)`,
          }).from(leadViews)
            .where(sql`${leadViews.leadId} IN (${sql.join(leadIds.map(id => sql`${id}`), sql`, `)})`)
            .groupBy(leadViews.leadId);
          
          const unlockRows = await db.select({
            leadId: leadUnlocks.leadId,
            cnt: sql<number>`COUNT(*)`,
          }).from(leadUnlocks)
            .where(sql`${leadUnlocks.leadId} IN (${sql.join(leadIds.map(id => sql`${id}`), sql`, `)})`)
            .groupBy(leadUnlocks.leadId);
          
          viewRows.forEach(r => { viewCounts[r.leadId] = r.cnt; });
          unlockRows.forEach(r => { unlockCounts[r.leadId] = r.cnt; });
        }
        
        // Record view for this user (async, don't await)
        filtered.forEach(lead => {
          if (!unlockedLeadIds.has(lead.id)) {
            db.insert(leadViews).values({ leadId: lead.id, userId: ctx.user.id })
              .catch(() => {}); // Ignore duplicate errors
          }
        });
        
        // Return leads with contact info blurred unless unlocked
        return filtered.map(lead => ({
          ...lead,
          isUnlocked: unlockedLeadIds.has(lead.id),
          contactName: unlockedLeadIds.has(lead.id) ? lead.contactName : (lead.contactName ? "Contact info locked" : null),
          contactEmail: unlockedLeadIds.has(lead.id) ? lead.contactEmail : null,
          contactPhone: unlockedLeadIds.has(lead.id) ? lead.contactPhone : null,
          viewCount: (viewCounts[lead.id] ?? 0) + ((lead.id * 17 + 43) % 67) + 12,
          unlockCount: unlockCounts[lead.id] ?? 0,
        }));
      }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const { getLeadById, hasUnlockedLead } = await import("./db");
        const lead = await getLeadById(input.id);
        
        if (!lead) throw new Error("Lead not found");
        
        const unlocked = await hasUnlockedLead(ctx.user.id, input.id);
        
        return {
          ...lead,
          isUnlocked: unlocked,
          contactName: unlocked ? lead.contactName : (lead.contactName ? "Contact info locked" : null),
          contactEmail: unlocked ? lead.contactEmail : null,
          contactPhone: unlocked ? lead.contactPhone : null,
        };
      }),
      
    getStats: protectedProcedure.query(async ({ ctx }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const { gigLeads, leadUnlocks } = await import("../drizzle/schema");
      
      const [totalLeads] = await db.select({ count: sql<number>`COUNT(*)` }).from(gigLeads)
        .where(eq(gigLeads.isApproved, true));
      
      const [userUnlocks] = await db.select({ count: sql<number>`COUNT(*)` }).from(leadUnlocks)
        .where(eq(leadUnlocks.userId, ctx.user.id));
      
      return {
        totalAvailable: totalLeads.count,
        myUnlocks: userUnlocks.count,
      };
    }),
    generatePitch: protectedProcedure
      .input(z.object({ leadId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { gigLeads, leadUnlocks } = await import("../drizzle/schema");
        const { invokeLLM } = await import("./_core/llm");

        // Must have unlocked this lead first
        const [unlock] = await db.select().from(leadUnlocks)
          .where(and(eq(leadUnlocks.userId, ctx.user.id), eq(leadUnlocks.leadId, input.leadId)))
          .limit(1);
        if (!unlock) throw new TRPCError({ code: "FORBIDDEN", message: "Unlock this lead first to generate a pitch." });

        const [lead] = await db.select().from(gigLeads).where(eq(gigLeads.id, input.leadId)).limit(1);
        if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found." });

        const prompt = [
          `You are a professional booking agent helping a performing artist write a short, compelling pitch to a potential client.`,
          `Write a 3-paragraph outreach message (under 200 words) for the artist to send to the contact below.`,
          `Tone: warm, professional, confident. Do NOT use generic filler phrases like "I hope this finds you well".`,
          ``,
          `Event details:`,
          `- Title: ${lead.title}`,
          `- Event type: ${lead.eventType || "event"}`,
          `- Location: ${lead.location}`,
          `- Budget: ${lead.budget || "not specified"}`,
          `- Description: ${lead.description || "no additional details"}`,
          ``,
          `The artist's performer type: ${lead.performerType?.replace(/_/g, " ") || "musician"}.`,
          ``,
          `Output ONLY the pitch message text. No subject line, no sign-off name placeholder, no extra commentary.`,
        ].join("\n");

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You write short, compelling artist booking pitches." },
            { role: "user", content: prompt },
          ],
        });

        const pitch = (response as any)?.choices?.[0]?.message?.content?.trim() ?? "";
        if (!pitch) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to generate pitch. Try again." });

        return { pitch };
      }),

    submitFeedback: protectedProcedure
      .input(z.object({
        leadId: z.number(),
        outcome: z.enum(["booked", "no_response", "lost", "price_too_high", "not_relevant"]),
        notes: z.string().optional(),
        rateCharged: z.number().optional(), // in cents
      }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { leadFeedback, leadUnlocks } = await import("../drizzle/schema");

        // Must have unlocked this lead
        const [unlock] = await db.select().from(leadUnlocks)
          .where(and(eq(leadUnlocks.userId, ctx.user.id), eq(leadUnlocks.leadId, input.leadId)))
          .limit(1);
        if (!unlock) throw new TRPCError({ code: "FORBIDDEN", message: "You must unlock this lead before submitting feedback." });

        // Upsert feedback (one per user per lead)
        const existing = await db.select({ id: leadFeedback.id })
          .from(leadFeedback)
          .where(and(eq(leadFeedback.userId, ctx.user.id), eq(leadFeedback.leadId, input.leadId)))
          .limit(1);

        if (existing.length > 0) {
          await db.update(leadFeedback)
            .set({ outcome: input.outcome, notes: input.notes, rateCharged: input.rateCharged })
            .where(eq(leadFeedback.id, existing[0].id));
        } else {
          await db.insert(leadFeedback).values({
            userId: ctx.user.id,
            leadId: input.leadId,
            outcome: input.outcome,
            notes: input.notes,
            rateCharged: input.rateCharged,
          });
        }

        return { success: true };
      }),

    getMyFeedback: protectedProcedure.query(async ({ ctx }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];
      const { leadFeedback } = await import("../drizzle/schema");
      return db.select().from(leadFeedback).where(eq(leadFeedback.userId, ctx.user.id));
    }),

    getFeatured: publicProcedure.query(async () => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];
      const { gigLeads } = await import("../drizzle/schema");
      const { desc, and, eq, isNotNull, gte } = await import("drizzle-orm");

      // Pull top approved, visible, non-reserved leads with a budget, sorted by budget desc
      const rows = await db.select({
        id: gigLeads.id,
        title: gigLeads.title,
        location: gigLeads.location,
        eventType: gigLeads.eventType,
        performerType: gigLeads.performerType,
        budget: gigLeads.budget, // int in cents
        description: gigLeads.description,
        eventDate: gigLeads.eventDate,
        unlockPriceCents: gigLeads.unlockPriceCents,
      }).from(gigLeads)
        .where(and(
          eq(gigLeads.isApproved, true),
          eq(gigLeads.isHidden, false),
          eq(gigLeads.isReserved, false),
          isNotNull(gigLeads.budget),
          or(isNull(gigLeads.eventDate), gte(gigLeads.eventDate, new Date())),
        ))
        .orderBy(desc(gigLeads.budget))
        .limit(3);

      return rows.map(r => ({
        ...r,
        // Never expose contact info on public endpoint
        contactName: null,
        contactEmail: null,
        contactPhone: null,
      }));
    }),
  }),

  // Payment procedures
  payments: router({
    getConfig: publicProcedure.query(async () => {
      const { ENV } = await import("./_core/env");
      return {
        publishableKey: ENV.stripePublishableKey || null,
        isDemoMode: !ENV.stripeSecretKey,
      };
    }),
    createPaymentIntent: protectedProcedure
      .input(z.object({ leadId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { getLeadById, hasUnlockedLead } = await import("./db");
        const { createLeadUnlockPaymentIntent } = await import("./stripe");
        const { getLeadUnlockPriceCents } = await import("../shared/leadPricing");
        
        const lead = await getLeadById(input.leadId);
        if (!lead) throw new Error("Lead not found");
        if (!lead.isApproved) throw new Error("Lead not available");
        if ((lead as any).isHidden) throw new Error("Lead not available");
        if ((lead as any).isReserved) throw new Error("Lead not available");
        
        // Dynamic price based on budget
        const DYNAMIC_PRICE = getLeadUnlockPriceCents((lead as any).budget, (lead as any).unlockPriceCents);
        
        // Check if already unlocked
        const alreadyUnlocked = await hasUnlockedLead(ctx.user.id, input.leadId);
        if (alreadyUnlocked) throw new Error("Lead already unlocked");
        
        // First unlock intro price: $1 for new users
        const { FIRST_UNLOCK_PRICE_CENTS } = await import("../shared/leadPricing");
        if (!ctx.user.hasUsedFreeTrial) {
          const firstResult = await createLeadUnlockPaymentIntent(
            ctx.user.id, input.leadId, lead.title, FIRST_UNLOCK_PRICE_CENTS
          );
          return {
            clientSecret: firstResult.clientSecret,
            paymentIntentId: firstResult.paymentIntentId,
            amount: FIRST_UNLOCK_PRICE_CENTS,
            originalAmount: DYNAMIC_PRICE,
            creditApplied: 0,
            leadTitle: lead.title,
            isDemoMode: 'demoMode' in firstResult && firstResult.demoMode === true,
            isFirstUnlock: true,
          };
        }
        
        // Check for available credits
        const { getDb } = await import("./db");
        const db = await getDb();
        let creditApplied = 0;
        if (db) {
          const { userCredits } = await import("../drizzle/schema");
          const credits = await db.select().from(userCredits)
            .where(and(eq(userCredits.userId, ctx.user.id), eq(userCredits.isUsed, false)))
            .orderBy(userCredits.createdAt)
            .limit(1);
          if (credits.length > 0) {
            creditApplied = Math.min(credits[0].amount, DYNAMIC_PRICE);
          }
        }
        
        const finalAmount = Math.max(0, DYNAMIC_PRICE - creditApplied);
        
        // If credits cover the full price, skip Stripe entirely
        if (finalAmount === 0 && creditApplied > 0) {
          return {
            clientSecret: null,
            paymentIntentId: null,
            amount: 0,
            originalAmount: DYNAMIC_PRICE,
            creditApplied,
            leadTitle: lead.title,
            isDemoMode: false,
            isFreeWithCredits: true,
          };
        }
        
        const result = await createLeadUnlockPaymentIntent(
          ctx.user.id,
          input.leadId,
          lead.title,
          finalAmount  // Charge only what credits don't cover
        );
        
        return {
          clientSecret: result.clientSecret,
          paymentIntentId: result.paymentIntentId,
          amount: finalAmount,
          originalAmount: DYNAMIC_PRICE,
          creditApplied,
          leadTitle: lead.title,
          isDemoMode: 'demoMode' in result && result.demoMode === true,
          isFreeWithCredits: false,
        };
      }),
    
    confirmPayment: protectedProcedure
      .input(z.object({ 
        leadId: z.number(), 
        paymentIntentId: z.string().nullable(),
        isFree: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { recordLeadUnlock, createTransaction, getLeadById, hasUnlockedLead } = await import("./db");
        const { verifyPaymentIntent, LEAD_UNLOCK_PRICE_CENTS } = await import("./stripe");
        const { sendLeadUnlockConfirmation } = await import("./email");
        
        const lead = await getLeadById(input.leadId);
        if (!lead) throw new Error("Lead not found");
        
        // Check if already unlocked
        const alreadyUnlocked = await hasUnlockedLead(ctx.user.id, input.leadId);
        if (alreadyUnlocked) {
          return { 
            success: true, 
            leadId: input.leadId,
            contactInfo: {
              name: lead.contactName,
              email: lead.contactEmail,
              phone: lead.contactPhone,
            }
          };
        }
        
        // Mark first unlock used if this was their intro $1 payment
        const isFirstUnlock = !ctx.user.hasUsedFreeTrial;
        const { FIRST_UNLOCK_PRICE_CENTS, getLeadUnlockPriceCents } = await import("../shared/leadPricing");
        const { getLeadById: getLead2 } = await import("./db");
        const lead2 = await getLead2(input.leadId);
        const actualAmount = isFirstUnlock
          ? FIRST_UNLOCK_PRICE_CENTS
          : getLeadUnlockPriceCents((lead2 as any)?.budget, (lead2 as any)?.unlockPriceCents);
        
        // Verify payment — skip if fully covered by credits
        if (!input.isFree) {
          if (!input.paymentIntentId) throw new Error("Payment intent required");
          const paymentValid = await verifyPaymentIntent(input.paymentIntentId);
          if (!paymentValid) throw new Error("Payment not verified");
        }
        
        // Mark first unlock used
        if (isFirstUnlock) {
          const { getDb } = await import("./db");
          const db2 = await getDb();
          if (db2) {
            const { users } = await import("../drizzle/schema");
            await db2.update(users).set({ hasUsedFreeTrial: true }).where(eq(users.id, ctx.user.id));
          }
        } else {
          // Apply any available credits for non-first unlocks
          const { getDb } = await import("./db");
          const db = await getDb();
          if (db) {
            const { userCredits } = await import("../drizzle/schema");
            const credits = await db.select().from(userCredits)
              .where(and(eq(userCredits.userId, ctx.user.id), eq(userCredits.isUsed, false)))
              .orderBy(userCredits.createdAt);
            let remaining = actualAmount;
            for (const credit of credits) {
              if (remaining <= 0) break;
              await db.update(userCredits).set({ isUsed: true }).where(eq(userCredits.id, credit.id));
              remaining -= credit.amount;
            }
          }
        }
        
        // Record the unlock
        await recordLeadUnlock(ctx.user.id, input.leadId);
        
        // Record transaction
        await createTransaction({
          userId: ctx.user.id,
          leadId: input.leadId,
          amount: actualAmount,
          transactionType: "lead_unlock",
          stripePaymentIntentId: input.paymentIntentId,
          status: "completed",
        });
        
        // Send confirmation email
        if (ctx.user.email) {
          sendLeadUnlockConfirmation(ctx.user.email, ctx.user.name ?? "", lead).catch(console.error);
        }
        
        return { 
          success: true, 
          leadId: input.leadId,
          contactInfo: {
            name: lead.contactName,
            email: lead.contactEmail,
            phone: lead.contactPhone,
          }
        };
      }),
    
    getUnlockedLeadInfo: protectedProcedure
      .input(z.object({ leadId: z.number() }))
      .query(async ({ ctx, input }) => {
        const { hasUnlockedLead, getLeadById } = await import("./db");
        
        const unlocked = await hasUnlockedLead(ctx.user.id, input.leadId);
        if (!unlocked) throw new Error("Lead not unlocked");
        
        const lead = await getLeadById(input.leadId);
        if (!lead) throw new Error("Lead not found");
        
        return {
          contactName: lead.contactName,
          contactEmail: lead.contactEmail,
          contactPhone: lead.contactPhone,
          venueUrl: lead.venueUrl,
          description: lead.description,
        };
      }),
      
    getMyTransactions: protectedProcedure.query(async ({ ctx }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const { transactions, gigLeads } = await import("../drizzle/schema");
      
      return await db.select({
        id: transactions.id,
        amount: transactions.amount,
        status: transactions.status,
        createdAt: transactions.createdAt,
        leadTitle: gigLeads.title,
        leadLocation: gigLeads.location,
      })
      .from(transactions)
      .leftJoin(gigLeads, eq(transactions.leadId, gigLeads.id))
      .where(eq(transactions.userId, ctx.user.id))
      .orderBy(desc(transactions.createdAt));
    }),

    // Purchase a credit pack (3/10/25 unlocks)
    purchaseCreditPack: protectedProcedure
      .input(z.object({ packId: z.enum(["pack_3", "pack_10", "pack_25"]) }))
      .mutation(async ({ ctx, input }) => {        
        const { CREDIT_PACKS } = await import("../shared/leadPricing");
        const pack = CREDIT_PACKS.find(p => p.id === input.packId);
        if (!pack) throw new Error("Invalid pack");

        const stripe = (await import("stripe")).default;
        const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });

        const origin = ctx.req.headers.origin ?? "https://www.gigxo.com";
        const session = await stripeClient.checkout.sessions.create({
          payment_method_types: ["card"],
          mode: "payment",
          customer_email: ctx.user.email ?? undefined,
          client_reference_id: ctx.user.id.toString(),
          metadata: {
            user_id: ctx.user.id.toString(),
            pack_id: pack.id,
            unlocks: pack.unlocks.toString(),
            pack_label: pack.label,
          },
          line_items: [{
            price_data: {
              currency: "usd",
              unit_amount: pack.priceCents,
              product_data: {
                name: `Gigxo ${pack.label} — ${pack.unlocks} Lead Unlocks`,
                description: `Unlock ${pack.unlocks} gig leads at a discounted rate. Saves ${pack.savings} vs. paying individually.`,
              },
            },
            quantity: 1,
          }],
          allow_promotion_codes: true,
          success_url: `${origin}/dashboard?pack_success=${pack.id}`,
          cancel_url: `${origin}/dashboard?pack_cancel=1`,
        });

        return { checkoutUrl: session.url };
      }),
  }),
  
  // Referral procedures
  referrals: router({
    getReferralLink: protectedProcedure
      .input(z.object({ origin: z.string().optional() }))
      .query(({ ctx, input }) => {
        const origin = input.origin ?? "https://gigxo.com";
        const referralCode = `ref-${ctx.user.id}`;
        return { 
          referralCode,
          link: `${origin}?ref=${ctx.user.id}`,
          creditAmount: 7,
          newUserDiscount: "50% off first unlock",
        };
      }),
    
    getReferralStats: protectedProcedure.query(async ({ ctx }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return { referrals: 0, earnings: 0, pendingCredits: 0, availableCredits: 0 };
      
      const { referrals, userCredits } = await import("../drizzle/schema");
      
      const myReferrals = await db.select().from(referrals)
        .where(eq(referrals.referrerId, ctx.user.id));
      
      const myCredits = await db.select().from(userCredits)
        .where(eq(userCredits.userId, ctx.user.id));
      
      const availableCredits = myCredits
        .filter(c => !c.isUsed)
        .reduce((sum, c) => sum + c.amount, 0);
      
      const usedCredits = myCredits
        .filter(c => c.isUsed)
        .reduce((sum, c) => sum + c.amount, 0);
      
      return { 
        referrals: myReferrals.length, 
        earnings: usedCredits / 100,
        pendingCredits: availableCredits / 100,
        availableCredits,
      };
    }),
  }),
  
  // Admin procedures
  admin: router({
    getPendingLeads: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== 'admin') throw new Error("Unauthorized");
      
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const { gigLeads } = await import("../drizzle/schema");
      return await db.select().from(gigLeads)
        .where(and(eq(gigLeads.isApproved, false), eq(gigLeads.isRejected, false)))
        .orderBy(desc(gigLeads.createdAt));
    }),
    
    getAllLeads: protectedProcedure
      .input(z.object({
        status: z.enum(["all", "approved", "pending", "rejected"]).default("all"),
        limit: z.number().default(100),
        performerType: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        if (ctx.user?.role !== 'admin') throw new Error("Unauthorized");
        
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const { gigLeads } = await import("../drizzle/schema");
        
        const buildWhere = (statusCondition: any) => {
          if (input.performerType) {
            const ptVal = input.performerType as typeof gigLeads.performerType._.data;
          return statusCondition
              ? and(statusCondition, eq(gigLeads.performerType, ptVal))
              : eq(gigLeads.performerType, ptVal);
          }
          return statusCondition;
        };
        
        if (input.status === "approved") {
          return await db.select().from(gigLeads).where(buildWhere(eq(gigLeads.isApproved, true))).orderBy(desc(gigLeads.createdAt)).limit(input.limit);
        } else if (input.status === "pending") {
          return await db.select().from(gigLeads).where(buildWhere(and(eq(gigLeads.isApproved, false), eq(gigLeads.isRejected, false)))).orderBy(desc(gigLeads.createdAt)).limit(input.limit);
        } else if (input.status === "rejected") {
          return await db.select().from(gigLeads).where(buildWhere(eq(gigLeads.isRejected, true))).orderBy(desc(gigLeads.createdAt)).limit(input.limit);
        }
        
        return await db.select().from(gigLeads).where(buildWhere(null)).orderBy(desc(gigLeads.createdAt)).limit(input.limit);
      }),
    
    approveLead: protectedProcedure
      .input(z.object({ leadId: z.union([z.number(), z.string()]).pipe(z.coerce.number()) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== 'admin') throw new Error("Unauthorized");
        
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const { gigLeads } = await import("../drizzle/schema");
        await db.update(gigLeads).set({ isApproved: true, isRejected: false }).where(eq(gigLeads.id, input.leadId));
        return { success: true };
      }),
    
    rejectLead: protectedProcedure
      .input(z.object({ leadId: z.union([z.number(), z.string()]).pipe(z.coerce.number()), reason: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== 'admin') throw new Error("Unauthorized");
        
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const { gigLeads } = await import("../drizzle/schema");
        await db.update(gigLeads).set({ 
          isRejected: true, 
          isApproved: false,
          rejectionReason: input.reason ?? "Does not meet quality standards",
        }).where(eq(gigLeads.id, input.leadId));
        return { success: true };
      }),
    
    toggleHideLead: protectedProcedure
      .input(z.object({ leadId: z.union([z.number(), z.string()]).pipe(z.coerce.number()), isHidden: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== 'admin') throw new Error("Unauthorized");
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { gigLeads } = await import("../drizzle/schema");
        await db.update(gigLeads).set({ isHidden: input.isHidden }).where(eq(gigLeads.id, input.leadId));
        return { success: true };
      }),

    reserveLead: protectedProcedure
      .input(z.object({ leadId: z.number(), isReserved: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== 'admin') throw new Error("Unauthorized");
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { gigLeads } = await import("../drizzle/schema");
        await db.update(gigLeads).set({ isReserved: input.isReserved }).where(eq(gigLeads.id, input.leadId));
        return { success: true };
      }),

    setLeadPrice: protectedProcedure
      .input(z.object({ leadId: z.number(), priceDollars: z.number().min(1).max(999) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== 'admin') throw new Error("Unauthorized");
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { gigLeads } = await import("../drizzle/schema");
        await db.update(gigLeads).set({ unlockPriceCents: Math.round(input.priceDollars * 100) }).where(eq(gigLeads.id, input.leadId));
        return { success: true };
      }),

    updateLead: protectedProcedure
      .input(z.object({
        leadId: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        location: z.string().optional(),
        eventType: z.string().optional(),
        budget: z.number().optional(),
        eventDate: z.string().optional(),
        contactName: z.string().optional(),
        contactEmail: z.string().optional(),
        contactPhone: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== 'admin') throw new Error("Unauthorized");
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { gigLeads } = await import("../drizzle/schema");
        
        const updateData: any = {};
        if (input.title !== undefined) updateData.title = input.title;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.location !== undefined) updateData.location = input.location;
        if (input.eventType !== undefined) updateData.eventType = input.eventType;
        if (input.budget !== undefined) updateData.budget = Math.round(input.budget * 100);
        if (input.eventDate !== undefined) updateData.eventDate = input.eventDate ? new Date(input.eventDate) : null;
        if (input.contactName !== undefined) updateData.contactName = input.contactName;
        if (input.contactEmail !== undefined) updateData.contactEmail = input.contactEmail;
        if (input.contactPhone !== undefined) updateData.contactPhone = input.contactPhone;
        
        await db.update(gigLeads).set(updateData).where(eq(gigLeads.id, input.leadId));
        return { success: true };
      }),


    addManualLead: protectedProcedure
      .input(z.object({
        title: z.string(),
        description: z.string().optional(),
        eventType: z.string(),
        budget: z.number(), // In dollars
        location: z.string(),
        eventDate: z.string().optional(), // ISO date string
        contactName: z.string(),
        contactEmail: z.string(),
        contactPhone: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== 'admin') throw new Error("Unauthorized");
        
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const { gigLeads } = await import("../drizzle/schema");
        const { getLeadUnlockPriceCents } = await import("../shared/leadPricing");
        const budgetCents = Math.round(input.budget * 100);
        const autoPrice = getLeadUnlockPriceCents(budgetCents, null);
        await db.insert(gigLeads).values({
          title: input.title,
          description: input.description,
          eventType: input.eventType,
          budget: budgetCents,
          location: input.location,
          eventDate: input.eventDate ? new Date(input.eventDate) : undefined,
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          externalId: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          source: "manual",
          unlockPriceCents: autoPrice,
          isApproved: true,
        });
        return { success: true };
      }),
    
    getAnalytics: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== 'admin') throw new Error("Unauthorized");
      
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const { gigLeads, transactions, users, leadUnlocks, referrals } = await import("../drizzle/schema");
      
      const [leadsStats] = await db.select({
        total: sql<number>`COUNT(*)`,
        approved: sql<number>`SUM(CASE WHEN ${gigLeads.isApproved} = 1 THEN 1 ELSE 0 END)`,
        pending: sql<number>`SUM(CASE WHEN ${gigLeads.isApproved} = 0 AND ${gigLeads.isRejected} = 0 THEN 1 ELSE 0 END)`,
        rejected: sql<number>`SUM(CASE WHEN ${gigLeads.isRejected} = 1 THEN 1 ELSE 0 END)`,
      }).from(gigLeads);
      
      const [txStats] = await db.select({
        total: sql<number>`COUNT(*)`,
        revenue: sql<number>`SUM(CASE WHEN ${transactions.status} = 'completed' THEN ${transactions.amount} ELSE 0 END)`,
      }).from(transactions);
      
      const [userStats] = await db.select({ total: sql<number>`COUNT(*)` }).from(users);
      const [unlockStats] = await db.select({ total: sql<number>`COUNT(*)` }).from(leadUnlocks);
      const [referralStats] = await db.select({ total: sql<number>`COUNT(*)` }).from(referrals);
      
      return {
        leads: {
          total: leadsStats.total,
          approved: Number(leadsStats.approved ?? 0),
          pending: Number(leadsStats.pending ?? 0),
          rejected: Number(leadsStats.rejected ?? 0),
        },
        revenue: {
          total: Number(txStats.revenue ?? 0) / 100,
          transactions: txStats.total,
        },
        users: {
          total: userStats.total,
        },
        unlocks: {
          total: unlockStats.total,
        },
        referrals: {
          total: referralStats.total,
        },
      };
    }),
    
    getUsers: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== 'admin') throw new Error("Unauthorized");
      
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const { users } = await import("../drizzle/schema");
      
      const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
      
      return allUsers.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
        lastSignedIn: u.lastSignedIn,
      }));
    }),
    
    triggerDailyDigest: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user?.role !== 'admin') throw new Error("Unauthorized");
      
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const { users, gigLeads } = await import("../drizzle/schema");
      const { sendDailyDigest } = await import("./email");
      
      // Get leads added in the last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const newLeads = await db.select().from(gigLeads)
        .where(and(
          eq(gigLeads.isApproved, true),
          sql`${gigLeads.createdAt} > ${oneDayAgo}`
        ))
        .limit(10);
      
      if (newLeads.length === 0) {
        return { success: true, message: "No new leads to send", sent: 0 };
      }
      
      // Get all users with emails
      const allUsers = await db.select().from(users);
      const usersWithEmail = allUsers.filter(u => u.email);
      
      let sent = 0;
      for (const user of usersWithEmail) {
        if (user.email) {
          const success = await sendDailyDigest(user.email, user.name ?? "", newLeads);
          if (success) sent++;
        }
      }
      
      return { success: true, message: `Sent to ${sent} users`, sent };
    }),
    
    // Run the daily scraper to pull new leads
    // Inbound lead capture feature: Run new Reddit-based scraper pipeline
    runScraper: protectedProcedure
      .input(z.object({
        marketId: z.string().optional(),
        leadsPerCity: z.number().optional(),
        focusPerformerType: z.string().optional(),
      }).optional())
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== 'admin') throw new Error("Unauthorized");
        const { runScraperPipeline } = await import("./scraper-collectors/scraper-pipeline");
        const { gigLeads } = await import("../drizzle/schema");
        const { getDb } = await import("./db");
        
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        // Pass city and performerType from input to scraper pipeline
        const { stats, leads, sourceCounts } = await runScraperPipeline(input?.marketId, input?.focusPerformerType);
        
        let inserted = 0;
        let skipped = 0;
        
        for (const lead of leads) {
          const [existing] = await db
            .select({ id: gigLeads.id })
            .from(gigLeads)
            .where(eq(gigLeads.externalId, lead.externalId))
            .limit(1);
          
          if (existing) {
            // Upsert behavior for DBPR venue intelligence: update existing row instead of inserting a duplicate.
            if (lead.externalId.startsWith("dbpr-")) {
              const updateData: any = {
                source:        lead.source as any,
                sourceLabel:   lead.sourceLabel ?? null,
                title:         lead.title,
                description:   lead.description,
                eventType:     lead.eventType,
                budget:        lead.budget,
                location:      lead.location,
                latitude:      lead.latitude ? parseFloat(lead.latitude.toString()) : null,
                longitude:     lead.longitude ? parseFloat(lead.longitude.toString()) : null,
                eventDate:     lead.eventDate,
                contactName:   lead.contactName,
                contactEmail:  lead.contactEmail,
                contactPhone:  lead.contactPhone,
                venueUrl:      lead.venueUrl,
                performerType: lead.performerType as any,
                intentScore:   lead.intentScore ?? null,
                leadType:      (lead as any).leadType ?? undefined,
                leadCategory:  (lead as any).leadCategory ?? undefined,
              };
              await db.update(gigLeads).set(updateData).where(eq(gigLeads.id, existing.id));
            } else {
              skipped++;
            }
            continue;
          }
          
          try {
            const insertData: any = {
              externalId:    lead.externalId,
              source:        lead.source as any,
              sourceLabel:   lead.sourceLabel ?? null,
              title:         lead.title,
              description:   lead.description,
              eventType:     lead.eventType,
              budget:        lead.budget,
              location:      lead.location,
              latitude:      lead.latitude ? parseFloat(lead.latitude.toString()) : null,
              longitude:     lead.longitude ? parseFloat(lead.longitude.toString()) : null,
              eventDate:     lead.eventDate,
              contactName:   lead.contactName,
              contactEmail:  lead.contactEmail,
              contactPhone:  lead.contactPhone,
              venueUrl:      lead.venueUrl,
              performerType: lead.performerType as any,
              intentScore:   lead.intentScore ?? null,
              leadType:      (lead as any).leadType ?? undefined,
              leadCategory:  (lead as any).leadCategory ?? undefined,
              isApproved:    false,
              isRejected:    false,
              isHidden:      false,
              isReserved:    false,
            };
            await db.insert(gigLeads).values(insertData);
            inserted++;
          } catch (err) {
            console.error("[runScraper] Insert error:", lead.externalId, err);
          }
        }
        
        console.log(`[runScraper] Inserted ${inserted} leads, skipped ${skipped} duplicates`);

        const { scraperRuns } = await import("../drizzle/schema");
        await db.insert(scraperRuns).values({
          collected: stats.collected,
          negativeRejected: stats.negativeRejected,
          intentRejected: stats.intentRejected,
          accepted: stats.classified,
          inserted,
          skipped,
          sourceCounts: sourceCounts ?? undefined,
        });
        
        return {
          collected:  stats.collected,
          filtered:   stats.filtered,
          classified: stats.classified,
          inserted,
          skipped,
          errors:     stats.errors,
          saved:      inserted,
          duplicates: skipped,
          message:    `Scraped ${stats.collected} posts → ${inserted} new leads added to approval queue`,
          sourceCounts,
        };
      }),

    // Get list of available city markets for the scraper UI
    getMarkets: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== 'admin') throw new Error("Unauthorized");
      const { US_MARKETS } = await import("./scraper");
      return US_MARKETS.map(m => ({ id: m.id, displayName: m.displayName, state: m.state }));
    }),

    // ── Admin Leads Explorer ───────────────────────────────────────────────────
    getLeadsExplorer: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
        sources: z.array(z.string()).optional(),
        location: z.string().optional(),
        performerType: z.string().optional(),
        minIntentScore: z.number().min(0).max(100).optional(),
        status: z.enum(["all", "pending", "approved", "rejected"]).default("all"),
        dateFrom: z.string().datetime().optional(),
        dateTo: z.string().datetime().optional(),
        searchText: z.string().optional(),
        includePhrases: z.array(z.string()).optional(),
        excludePhrases: z.array(z.string()).optional(),
        leadType: z.string().optional(),
        leadCategory: z.string().optional(),
        hasEmail: z.boolean().optional(),
        hasPhone: z.boolean().optional(),
        hasVenueUrl: z.boolean().optional(),
        missingContact: z.boolean().optional(),
      }))
      .query(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { gigLeads } = await import("../drizzle/schema");
        const conditions: any[] = [];
        if (input.sources?.length) conditions.push(inArray(gigLeads.source, input.sources as any));
        if (input.location?.trim()) conditions.push(like(gigLeads.location, `%${input.location.trim()}%`));
        if (input.performerType) conditions.push(eq(gigLeads.performerType, input.performerType as any));
        if (input.minIntentScore != null) conditions.push(gte(gigLeads.intentScore, input.minIntentScore));
        if (input.status === "pending") conditions.push(and(eq(gigLeads.isApproved, false), eq(gigLeads.isRejected, false)));
        else if (input.status === "approved") conditions.push(eq(gigLeads.isApproved, true));
        else if (input.status === "rejected") conditions.push(eq(gigLeads.isRejected, true));
        if (input.dateFrom) conditions.push(gte(gigLeads.createdAt, new Date(input.dateFrom)));
        if (input.dateTo) conditions.push(lte(gigLeads.createdAt, new Date(input.dateTo)));
        if (input.searchText?.trim()) {
          const term = `%${input.searchText.trim()}%`;
          conditions.push(or(
            like(gigLeads.title, term),
            like(gigLeads.description, term),
            like(gigLeads.location, term),
            like(gigLeads.sourceLabel, term),
            like(gigLeads.contactEmail, term),
            like(gigLeads.contactPhone, term),
            like(gigLeads.venueUrl, term),
          )!);
        }
        if (input.leadType?.trim()) {
          conditions.push(eq(gigLeads.leadType, input.leadType as any));
        }
        if (input.leadCategory?.trim()) {
          conditions.push(eq(gigLeads.leadCategory, input.leadCategory as any));
        }
        if (input.hasEmail) {
          conditions.push(not(isNull(gigLeads.contactEmail)));
        }
        if (input.hasPhone) {
          conditions.push(not(isNull(gigLeads.contactPhone)));
        }
        if (input.hasVenueUrl) {
          conditions.push(not(isNull(gigLeads.venueUrl)));
        }
        if (input.missingContact) {
          conditions.push(and(isNull(gigLeads.contactEmail), isNull(gigLeads.contactPhone)));
        }
        if (input.includePhrases?.length) {
          const includeConds = input.includePhrases
            .filter((p) => p.trim().length > 0)
            .map((p) => or(like(gigLeads.title, `%${p.trim()}%`), like(gigLeads.description, `%${p.trim()}%`))!);
          if (includeConds.length) conditions.push(or(...includeConds)!);
        }
        if (input.excludePhrases?.length) {
          for (const p of input.excludePhrases) {
            if (p.trim().length === 0) continue;
            const term = `%${p.trim()}%`;
            conditions.push(not(or(like(gigLeads.title, term), like(gigLeads.description, term))!));
          }
        }
        const where = conditions.length ? and(...conditions) : undefined;
        const [totalRow] = await db.select({ count: sql<number>`COUNT(*)` }).from(gigLeads).where(where ?? sql`1=1`);
        const total = Number(totalRow?.count ?? 0);
        const items = await db.select({
          id: gigLeads.id,
          title: gigLeads.title,
          source: gigLeads.source,
          sourceLabel: gigLeads.sourceLabel,
          location: gigLeads.location,
          performerType: gigLeads.performerType,
          intentScore: gigLeads.intentScore,
          createdAt: gigLeads.createdAt,
          venueUrl: gigLeads.venueUrl,
          isApproved: gigLeads.isApproved,
          isRejected: gigLeads.isRejected,
          description: gigLeads.description,
          contactEmail: gigLeads.contactEmail,
          contactPhone: gigLeads.contactPhone,
          leadType: gigLeads.leadType,
          leadCategory: gigLeads.leadCategory,
        })
          .from(gigLeads)
          .where(where ?? sql`1=1`)
          // Newest first, then highest intent within the window
          .orderBy(desc(gigLeads.createdAt), desc(gigLeads.intentScore))
          .limit(input.limit)
          .offset(input.offset);
        return { items, total };
      }),

    getScraperRunHistory: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { scraperRuns } = await import("../drizzle/schema");
        return db.select().from(scraperRuns).orderBy(desc(scraperRuns.createdAt)).limit(input?.limit ?? 50);
      }),

    getSourceToggles: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const { explorerSourceToggles } = await import("../drizzle/schema");
      const rows = await db.select().from(explorerSourceToggles);
      const keys = ["reddit", "eventbrite", "craigslist", "facebook"];
      const map: Record<string, boolean> = {};
      for (const k of keys) map[k] = true;
      for (const r of rows) map[r.sourceKey] = !!r.enabled;
      return map;
    }),

    setSourceToggles: protectedProcedure
      .input(z.object({ sourceKey: z.string(), enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { explorerSourceToggles } = await import("../drizzle/schema");
        await db.insert(explorerSourceToggles).values({ sourceKey: input.sourceKey, enabled: input.enabled })
          .onDuplicateKeyUpdate({ set: { enabled: input.enabled } });
        return { success: true };
      }),

    getPhraseSets: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const { explorerPhraseSets } = await import("../drizzle/schema");
      return db.select().from(explorerPhraseSets).orderBy(desc(explorerPhraseSets.createdAt));
    }),

    savePhraseSet: protectedProcedure
      .input(z.object({ name: z.string(), type: z.enum(["include", "exclude"]), phrases: z.array(z.string()) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { explorerPhraseSets } = await import("../drizzle/schema");
        await db.insert(explorerPhraseSets).values({ name: input.name, type: input.type, phrases: input.phrases });
        return { success: true };
      }),

    deletePhraseSet: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { explorerPhraseSets } = await import("../drizzle/schema");
        await db.delete(explorerPhraseSets).where(eq(explorerPhraseSets.id, input.id));
        return { success: true };
      }),

    getSavedSearches: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin" || !ctx.user?.id) throw new TRPCError({ code: "FORBIDDEN" });
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const { savedSearches } = await import("../drizzle/schema");
      return db.select().from(savedSearches).where(eq(savedSearches.userId, ctx.user.id)).orderBy(desc(savedSearches.createdAt));
    }),

    saveSearch: protectedProcedure
      .input(z.object({ name: z.string(), filterJson: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin" || !ctx.user?.id) throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { savedSearches } = await import("../drizzle/schema");
        await db.insert(savedSearches).values({ userId: ctx.user.id, name: input.name, filterJson: input.filterJson });
        return { success: true };
      }),

    deleteSavedSearch: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { savedSearches } = await import("../drizzle/schema");
        await db.delete(savedSearches).where(eq(savedSearches.id, input.id));
        return { success: true };
      }),

    // ── Live Lead Search (admin: query live web with custom phrase) ─────────────
    runLiveLeadSearch: protectedProcedure
      .input(z.object({
        customPhrase: z.string(),
        sources: z.array(z.enum(["reddit", "craigslist", "eventbrite"])),
        city: z.string().optional(),
        performerType: z.string().optional(),
        includeKeywords: z.array(z.string()).default([]),
        excludeKeywords: z.array(z.string()).default([]),
        maxResults: z.number().min(1).max(200).optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { runLiveLeadSearch: runLive } = await import("./scraper-collectors/scraper-pipeline");
        return runLive({
          customPhrase: input.customPhrase,
          sources: input.sources,
          city: input.city,
          performerType: input.performerType,
          includeKeywords: input.includeKeywords,
          excludeKeywords: input.excludeKeywords,
          maxResults: input.maxResults,
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
        });
      }),

    saveLeadsToGigLeads: protectedProcedure
      .input(z.object({
        leads: z.array(z.object({
          externalId: z.string(),
          source: z.string(),
          sourceLabel: z.string(),
          title: z.string(),
          description: z.string(),
          eventType: z.string().optional(),
          budget: z.number().nullable().optional(),
          location: z.string(),
          latitude: z.number().nullable().optional(),
          longitude: z.number().nullable().optional(),
          eventDate: z.union([z.date(), z.string()]).nullable().optional(),
          contactName: z.string().nullable().optional(),
          contactEmail: z.string().nullable().optional(),
          contactPhone: z.string().nullable().optional(),
          venueUrl: z.string(),
          performerType: z.string(),
          intentScore: z.number().optional(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { gigLeads } = await import("../drizzle/schema");
        let inserted = 0;
        let skipped = 0;
        for (const lead of input.leads) {
          const [existing] = await db.select({ id: gigLeads.id }).from(gigLeads).where(eq(gigLeads.externalId, lead.externalId)).limit(1);
          if (existing) {
            if (lead.externalId.startsWith("dbpr-")) {
              const updateRow = {
                source: lead.source as any,
                sourceLabel: lead.sourceLabel ?? null,
                title: lead.title,
                description: lead.description ?? null,
                eventType: lead.eventType ?? null,
                budget: lead.budget ?? null,
                location: lead.location,
                latitude: lead.latitude ?? null,
                longitude: lead.longitude ?? null,
                eventDate: lead.eventDate != null ? (lead.eventDate instanceof Date ? lead.eventDate : new Date(lead.eventDate as string)) : null,
                contactName: lead.contactName ?? null,
                contactEmail: lead.contactEmail ?? null,
                contactPhone: lead.contactPhone ?? null,
                venueUrl: lead.venueUrl ?? null,
                performerType: (lead.performerType as any) ?? "other",
                intentScore: lead.intentScore ?? null,
              };
              await db.update(gigLeads).set(updateRow as any).where(eq(gigLeads.id, existing.id));
            } else {
              skipped++;
            }
            continue;
          }
          try {
            const insertRow = {
              externalId: lead.externalId,
              source: lead.source as any,
              sourceLabel: lead.sourceLabel ?? null,
              title: lead.title,
              description: lead.description ?? null,
              eventType: lead.eventType ?? null,
              budget: lead.budget ?? null,
              location: lead.location,
              latitude: lead.latitude ?? null,
              longitude: lead.longitude ?? null,
              eventDate: lead.eventDate != null ? (lead.eventDate instanceof Date ? lead.eventDate : new Date(lead.eventDate as string)) : null,
              contactName: lead.contactName ?? null,
              contactEmail: lead.contactEmail ?? null,
              contactPhone: lead.contactPhone ?? null,
              venueUrl: lead.venueUrl ?? null,
              performerType: (lead.performerType as any) ?? "other",
              intentScore: lead.intentScore ?? null,
              isApproved: false,
              isRejected: false,
              isHidden: false,
              isReserved: false,
            };
            await db.insert(gigLeads).values(insertRow as any);
            inserted++;
          } catch (err) {
            console.error("[saveLeadsToGigLeads] Insert error:", lead.externalId, err);
          }
        }
        return { inserted, skipped };
      }),

    getLiveSearchPresets: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin" || !ctx.user?.id) throw new TRPCError({ code: "FORBIDDEN" });
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const { savedSearches } = await import("../drizzle/schema");
      const rows = await db.select().from(savedSearches).where(eq(savedSearches.userId, ctx.user.id)).orderBy(desc(savedSearches.createdAt));
      return rows.filter((r) => (r.filterJson as any)?.presetType === "liveSearch");
    }),

    saveLiveSearchPreset: protectedProcedure
      .input(z.object({
        name: z.string(),
        customPhrase: z.string(),
        sources: z.array(z.enum(["reddit", "craigslist", "eventbrite"])),
        city: z.string().optional(),
        performerType: z.string().optional(),
        includeKeywords: z.array(z.string()).default([]),
        excludeKeywords: z.array(z.string()).default([]),
        maxResults: z.number().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin" || !ctx.user?.id) throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { savedSearches } = await import("../drizzle/schema");
        await db.insert(savedSearches).values({
          userId: ctx.user.id,
          name: input.name,
          filterJson: { presetType: "liveSearch", ...input },
        });
        return { success: true };
      }),

    deleteLiveSearchPreset: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { savedSearches } = await import("../drizzle/schema");
        await db.delete(savedSearches).where(eq(savedSearches.id, input.id));
        return { success: true };
      }),

    // Trigger re-engagement for inactive users
    triggerReEngagement: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user?.role !== 'admin') throw new Error("Unauthorized");
      
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const { users, leadUnlocks } = await import("../drizzle/schema");
      const { sendReEngagementEmail } = await import("./email");
      
      // Find users who haven't unlocked a lead in 7+ days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const allUsers = await db.select().from(users);
      
      let sent = 0;
      for (const user of allUsers) {
        if (!user.email) continue;
        
        const recentUnlocks = await db.select().from(leadUnlocks)
          .where(and(
            eq(leadUnlocks.userId, user.id),
            sql`${leadUnlocks.unlockedAt} > ${sevenDaysAgo}`
          ))
          .limit(1);
        
        if (recentUnlocks.length === 0) {
          const success = await sendReEngagementEmail(user.email, user.name ?? "", 5);
          if (success) sent++;
        }
      }
      
       return { success: true, message: `Re-engagement sent to ${sent} users`, sent };
    }),
    // Send AI-powered lead match emails to all artists
    sendMatchEmails: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { users, artistProfiles, gigLeads } = await import("../drizzle/schema");
      const { scoreLead } = await import("./scoring");
      const { sendLeadMatchEmail } = await import("./email");
      const leads = await db.select().from(gigLeads).where(eq(gigLeads.isApproved, true)).limit(20);
      const profiles = await db.select({
        userId: artistProfiles.userId,
        genres: artistProfiles.genres,
        location: artistProfiles.location,
        experienceLevel: artistProfiles.experienceLevel,
        email: users.email,
        name: users.name,
      }).from(artistProfiles).innerJoin(users, eq(artistProfiles.userId, users.id));
      let sent = 0;
      for (const profile of profiles) {
        if (!profile.email) continue;
        const artistForScoring = {
          genres: profile.genres as string[] | null,
          location: profile.location,
          experienceLevel: profile.experienceLevel as string | null,
        };
        for (const lead of leads) {
          const breakdown = scoreLead(lead, artistForScoring as Parameters<typeof scoreLead>[1]);
          const score = breakdown.overallScore;
          if (score >= 65) {
            const success = await sendLeadMatchEmail(
              profile.email,
              profile.name ?? "Artist",
              lead,
              score
            );
            if (success) sent++;
          }
        }
      }
      return { success: true, message: `Match emails sent: ${sent}`, sent };
    }),
  }),
  // Music track procedures
  tracks: router({
    // Get current user's tracks
    getMyTracks: protectedProcedure.query(async ({ ctx }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];
      const { musicTracks } = await import("../drizzle/schema");
      return await db.select().from(musicTracks)
        .where(eq(musicTracks.userId, ctx.user.id))
        .orderBy(musicTracks.sortOrder, musicTracks.createdAt);
    }),

    // Get tracks for a specific artist by userId (public)
    getArtistTracks: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) return [];
        const { musicTracks } = await import("../drizzle/schema");
        return await db.select().from(musicTracks)
          .where(eq(musicTracks.userId, input.userId))
          .orderBy(musicTracks.sortOrder, musicTracks.createdAt);
      }),

    // Upload a track — client sends base64 encoded audio
    uploadTrack: protectedProcedure
      .input(z.object({
        title: z.string().min(1).max(255),
        fileBase64: z.string(), // base64 encoded audio file
        mimeType: z.string().default("audio/mpeg"),
        fileSizeBytes: z.number().optional(),
        durationSeconds: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { storagePut } = await import("./storage");
        const { musicTracks } = await import("../drizzle/schema");
        const { getDb } = await import("./db");

        // Enforce 16MB limit
        const MAX_SIZE = 16 * 1024 * 1024;
        const buffer = Buffer.from(input.fileBase64, "base64");
        if (buffer.length > MAX_SIZE) {
          throw new Error("File too large. Maximum size is 16MB.");
        }

        const ext = input.mimeType === "audio/wav" ? "wav" : input.mimeType === "audio/mp4" ? "m4a" : "mp3";
        const fileKey = `tracks/${ctx.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);

        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const existing = await db.select({ id: musicTracks.id }).from(musicTracks)
          .where(eq(musicTracks.userId, ctx.user.id));
        const sortOrder = existing.length;

        await db.insert(musicTracks).values({
          userId: ctx.user.id,
          title: input.title,
          fileKey,
          fileUrl: url,
          mimeType: input.mimeType,
          fileSizeBytes: buffer.length,
          durationSeconds: input.durationSeconds,
          sortOrder,
        });

        return { success: true, url };
      }),

    // Delete a track
    deleteTrack: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { musicTracks } = await import("../drizzle/schema");
        // Verify ownership
        const track = await db.select().from(musicTracks)
          .where(and(eq(musicTracks.id, input.trackId), eq(musicTracks.userId, ctx.user.id)))
          .limit(1);
        if (track.length === 0) throw new Error("Track not found");
        await db.delete(musicTracks).where(eq(musicTracks.id, input.trackId));
        return { success: true };
      }),

    // Rename a track
    renameTrack: protectedProcedure
      .input(z.object({ trackId: z.number(), title: z.string().min(1).max(255) }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { musicTracks } = await import("../drizzle/schema");
        await db.update(musicTracks)
          .set({ title: input.title })
          .where(and(eq(musicTracks.id, input.trackId), eq(musicTracks.userId, ctx.user.id)));
        return { success: true };
      }),

    // Increment play count
    incrementPlay: publicProcedure
      .input(z.object({ trackId: z.number() }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) return { success: true };
        const { musicTracks } = await import("../drizzle/schema");
        await db.update(musicTracks)
          .set({ playCount: sql`${musicTracks.playCount} + 1` })
          .where(eq(musicTracks.id, input.trackId));
        return { success: true };
      }),
  }),

  // Public artist directory
  directory: router({
    // Search artists with filters
    searchArtists: publicProcedure
      .input(z.object({
        query: z.string().optional(),
        genre: z.string().optional(),
        location: z.string().optional(),
        experienceLevel: z.enum(["beginner", "intermediate", "professional", "expert"]).optional(),
        limit: z.number().default(24),
        offset: z.number().default(0),
      }))
      .query(async ({ input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) return { artists: [], total: 0 };
        const { artistProfiles, users, musicTracks } = await import("../drizzle/schema");

        // Get all profiles with user info (exclude admins from public directory)
        const profiles = await db.select({
          id: artistProfiles.id,
          userId: artistProfiles.userId,
          djName: artistProfiles.djName,
          slug: artistProfiles.slug,
          photoUrl: artistProfiles.photoUrl,
          genres: artistProfiles.genres,
          location: artistProfiles.location,
          experienceLevel: artistProfiles.experienceLevel,
          bio: artistProfiles.bio,
          soundcloudUrl: artistProfiles.soundcloudUrl,
          mixcloudUrl: artistProfiles.mixcloudUrl,
          userName: users.name,
          userEmail: users.email,
          avatarUrl: users.avatarUrl,
          userRole: users.role,
        })
        .from(artistProfiles)
        .innerJoin(users, eq(artistProfiles.userId, users.id));
        // Filter in JS (small dataset, avoids complex SQL JSON queries))
        let filtered = profiles.filter((p: typeof profiles[number]) => {
          // Exclude admin accounts from public directory
          if (p.userRole === 'admin') return false;
          // Must have at least a name or DJ name
          if (!p.djName && !p.userName) return false;

          if (input.query) {
            const q = input.query.toLowerCase();
            const nameMatch = (p.djName ?? p.userName ?? "").toLowerCase().includes(q);
            const locationMatch = (p.location ?? "").toLowerCase().includes(q);
            const bioMatch = (p.bio ?? "").toLowerCase().includes(q);
            if (!nameMatch && !locationMatch && !bioMatch) return false;
          }

          if (input.genre) {
            const genres = (p.genres as string[]) ?? [];
            if (!genres.some(g => g.toLowerCase().includes(input.genre!.toLowerCase()))) return false;
          }

          if (input.location) {
            if (!(p.location ?? "").toLowerCase().includes(input.location.toLowerCase())) return false;
          }

          if (input.experienceLevel) {
            if (p.experienceLevel !== input.experienceLevel) return false;
          }

          return true;
        });

        const total = filtered.length;
        const paginated = filtered.slice(input.offset, input.offset + input.limit);

        // Get track counts for each artist
        const trackCounts: Record<number, number> = {};
        if (paginated.length > 0) {
          const userIds = paginated.map(p => p.userId);
          const tracks = await db.select({ userId: musicTracks.userId, cnt: sql<number>`COUNT(*)` })
            .from(musicTracks)
            .where(sql`${musicTracks.userId} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`)
            .groupBy(musicTracks.userId);
          tracks.forEach(t => { trackCounts[t.userId] = t.cnt; });
        }

        return {
          artists: paginated.map(p => ({
            ...p,
            displayName: p.djName || p.userName || "Artist",
            trackCount: trackCounts[p.userId] ?? 0,
            isVerified: !!(p.djName && p.bio && p.photoUrl),
          })),
          total,
        };
      }),

    // Get a single artist by slug
    getArtistBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { artistProfiles, users, musicTracks } = await import("../drizzle/schema");

        const profiles = await db.select({
          id: artistProfiles.id,
          userId: artistProfiles.userId,
          djName: artistProfiles.djName,
          slug: artistProfiles.slug,
          photoUrl: artistProfiles.photoUrl,
          genres: artistProfiles.genres,
          location: artistProfiles.location,
          experienceLevel: artistProfiles.experienceLevel,
          bio: artistProfiles.bio,
          equipment: artistProfiles.equipment,
          minBudget: artistProfiles.minBudget,
          soundcloudUrl: artistProfiles.soundcloudUrl,
          mixcloudUrl: artistProfiles.mixcloudUrl,
          userName: users.name,
          avatarUrl: users.avatarUrl,
        })
        .from(artistProfiles)
        .innerJoin(users, eq(artistProfiles.userId, users.id))
        .where(eq(artistProfiles.slug, input.slug))
        .limit(1);

        if (profiles.length === 0) throw new Error("Artist not found");
        const profile = profiles[0];

        // Get their tracks
        const tracks = await db.select().from(musicTracks)
          .where(eq(musicTracks.userId, profile.userId))
          .orderBy(musicTracks.sortOrder, musicTracks.createdAt);

        return {
          ...profile,
          displayName: profile.djName || profile.userName || "Artist",
          isVerified: !!(profile.djName && profile.bio && profile.photoUrl),
          tracks,
        };
      }),
  }),

  // Booking inquiry procedures
  booking: router({
    // Submit a booking inquiry (public)
    submitInquiry: publicProcedure
      .input(z.object({
        artistUserId: z.number(),
        inquirerName: z.string().min(1),
        inquirerEmail: z.string().email(),
        inquirerPhone: z.string().optional(),
        eventType: z.string().optional(),
        eventDate: z.string().optional(),
        eventLocation: z.string().optional(),
        budget: z.string().optional(),
        message: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { bookingInquiries, users } = await import("../drizzle/schema");

        await db.insert(bookingInquiries).values(input);

        // Notify the artist by email + in-app notification
        const artist = await db.select().from(users).where(eq(users.id, input.artistUserId)).limit(1);
        if (artist.length > 0) {
          // In-app notification
          const { notifications } = await import("../drizzle/schema");
          await db.insert(notifications).values({
            userId: input.artistUserId,
            type: "booking_inquiry",
            title: `New booking inquiry from ${input.inquirerName}`,
            body: `${input.eventType ?? "Event"} on ${input.eventDate ?? "TBD"} — ${input.message?.slice(0, 80) ?? ""}`,
            isRead: false,
          });
          // Email notification
          if (artist[0].email) {
            const { sendBookingInquiryEmail } = await import("./email");
            sendBookingInquiryEmail(
              artist[0].email,
              artist[0].name ?? "Artist",
              input.inquirerName,
              input.inquirerEmail,
              input.eventType ?? "Event",
              input.eventDate ?? "TBD",
              input.message ?? ""
            ).catch(console.error);
          }
        }

        return { success: true };
      }),

    // Get inquiries for the logged-in artist
    getMyInquiries: protectedProcedure.query(async ({ ctx }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];
      const { bookingInquiries } = await import("../drizzle/schema");
      return await db.select().from(bookingInquiries)
        .where(eq(bookingInquiries.artistUserId, ctx.user.id))
        .orderBy(desc(bookingInquiries.createdAt));
    }),

     // Mark inquiry as read
    markRead: protectedProcedure
      .input(z.object({ inquiryId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { bookingInquiries } = await import("../drizzle/schema");
        await db.update(bookingInquiries)
          .set({ status: "read" })
          .where(and(eq(bookingInquiries.id, input.inquiryId), eq(bookingInquiries.artistUserId, ctx.user.id)));
        return { success: true };
      }),
    // Update inquiry status (replied, booked, declined)
    updateStatus: protectedProcedure
      .input(z.object({
        inquiryId: z.number(),
        status: z.enum(["new", "read", "replied", "booked", "declined"]),
        artistNotes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { bookingInquiries } = await import("../drizzle/schema");
        await db.update(bookingInquiries)
          .set({ status: input.status, artistNotes: input.artistNotes })
          .where(and(eq(bookingInquiries.id, input.inquiryId), eq(bookingInquiries.artistUserId, ctx.user.id)));
        return { success: true };
      }),
  }),

  // Subscription procedures
  subscription: router({
    // Get current user's subscription
    getMy: protectedProcedure.query(async ({ ctx }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return null;
      const { subscriptions } = await import("../drizzle/schema");
      const rows = await db.select().from(subscriptions).where(eq(subscriptions.userId, ctx.user.id)).limit(1);
      return rows[0] ?? null;
    }),
    // Start premium subscription ($19/month, 5 unlocks)
    startPremium: protectedProcedure
      .input(z.object({ origin: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { subscriptions } = await import("../drizzle/schema");
        const origin = input.origin ?? "https://gigxo.com";
        // Check if Stripe is configured
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        const now = new Date();
        const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        if (!stripeKey) {
          // Demo mode — create a local subscription record
          const existing = await db.select().from(subscriptions).where(eq(subscriptions.userId, ctx.user.id)).limit(1);
          if (existing.length > 0) {
            await db.update(subscriptions).set({ tier: "premium", status: "active", currentPeriodStart: now, currentPeriodEnd: periodEnd }).where(eq(subscriptions.userId, ctx.user.id));
          } else {
            await db.insert(subscriptions).values({ userId: ctx.user.id, tier: "premium", status: "active", currentPeriodStart: now, currentPeriodEnd: periodEnd });
          }
          return { success: true, demo: true, checkoutUrl: null };
        }
        // Real Stripe checkout — create a Stripe Checkout session for $19/month
        const stripe = (await import("./stripe")).getStripe();
        if (!stripe) throw new Error("Stripe not configured");
        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          payment_method_types: ["card"],
          customer_email: ctx.user.email ?? undefined,
          line_items: [{
            price_data: {
              currency: "usd",
              unit_amount: 1900,
              recurring: { interval: "month" },
              product_data: { name: "Gigxo Premium", description: "5 lead unlocks per month" },
            },
            quantity: 1,
          }],
          success_url: `${origin}/dashboard?subscribed=1`,
          cancel_url: `${origin}/dashboard`,
          metadata: { userId: String(ctx.user.id) },
        });
        return { success: true, demo: false, checkoutUrl: session.url };
      }),
    // Cancel subscription
    cancel: protectedProcedure.mutation(async ({ ctx }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { subscriptions } = await import("../drizzle/schema");
      await db.update(subscriptions).set({ status: "canceled" }).where(eq(subscriptions.userId, ctx.user.id));
      return { success: true };
    }),
  }),

  // ── Kanban pipeline ────────────────────────────────────────────────────
  pipeline: router({
    getBoard: protectedProcedure.query(async ({ ctx }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { bookingInquiries } = await import("../drizzle/schema");
      const rows = await db.select().from(bookingInquiries)
        .where(eq(bookingInquiries.artistUserId, ctx.user.id))
        .orderBy(desc(bookingInquiries.createdAt));
      const board: Record<string, typeof rows> = { inquiry: [], confirmed: [], completed: [], cancelled: [] };
      for (const row of rows) {
        const stage = (row.bookingStage as string) ?? "inquiry";
        if (board[stage]) board[stage].push(row);
        else board["inquiry"].push(row);
      }
      return board;
    }),
    moveCard: protectedProcedure
      .input(z.object({
        inquiryId: z.number(),
        stage: z.enum(["inquiry", "confirmed", "completed", "cancelled"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { bookingInquiries } = await import("../drizzle/schema");
        const [inquiry] = await db.select().from(bookingInquiries)
          .where(and(eq(bookingInquiries.id, input.inquiryId), eq(bookingInquiries.artistUserId, ctx.user.id)));
        if (!inquiry) throw new TRPCError({ code: "NOT_FOUND", message: "Inquiry not found" });
        await db.update(bookingInquiries)
          .set({ bookingStage: input.stage })
          .where(eq(bookingInquiries.id, input.inquiryId));
        return { success: true };
      }),
    updateNotes: protectedProcedure
      .input(z.object({ inquiryId: z.number(), notes: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { bookingInquiries } = await import("../drizzle/schema");
        await db.update(bookingInquiries)
          .set({ artistNotes: input.notes })
          .where(and(eq(bookingInquiries.id, input.inquiryId), eq(bookingInquiries.artistUserId, ctx.user.id)));
        return { success: true };
      }),
  }),

  // ── In-app notifications ────────────────────────────────────────────────
  notifications: router({
    getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return { count: 0 };
      const { notifications } = await import("../drizzle/schema");
      const rows = await db.select().from(notifications)
        .where(and(eq(notifications.userId, ctx.user.id), eq(notifications.isRead, false)));
      return { count: rows.length };
    }),
    getAll: protectedProcedure.query(async ({ ctx }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];
      const { notifications } = await import("../drizzle/schema");
      return db.select().from(notifications)
        .where(eq(notifications.userId, ctx.user.id))
        .orderBy(desc(notifications.createdAt))
        .limit(30);
    }),
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return { success: false };
      const { notifications } = await import("../drizzle/schema");
      await db.update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.userId, ctx.user.id), eq(notifications.isRead, false)));
      return { success: true };
    }),
    markRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) return { success: false };
        const { notifications } = await import("../drizzle/schema");
        await db.update(notifications)
          .set({ isRead: true })
          .where(and(eq(notifications.id, input.id), eq(notifications.userId, ctx.user.id)));
        return { success: true };
      }),
  }),

  // ── Worksheet: Launch Checklist + Growth Tasks ──────────────────────────────
  worksheet: router({
    // Seed default checklist items if empty
    getChecklist: protectedProcedure.query(async () => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];
      const { ownerChecklist } = await import("../drizzle/schema");

      const existing = await db.select().from(ownerChecklist).orderBy(ownerChecklist.sortOrder);
      if (existing.length > 0) return existing;

      // Seed default launch checklist
      const defaults = [
        { itemKey: "stripe_key", label: "Add Stripe Secret Key", description: "Go to Secrets panel → add STRIPE_SECRET_KEY from dashboard.stripe.com/apikeys. Use sk_test_... first, then sk_live_... when ready.", category: "launch", sortOrder: 1 },
        { itemKey: "resend_domain", label: "Verify gigxo.com on Resend", description: "Go to resend.com/domains → Add Domain → enter gigxo.com → add the 3 DNS records to your registrar. Enables all automated emails.", category: "launch", sortOrder: 2 },
        { itemKey: "publish_site", label: "Publish the Site", description: "Click the Publish button in the top-right of the Management UI. Your site goes live instantly on manus.space.", category: "launch", sortOrder: 3 },
        { itemKey: "connect_domain", label: "Connect gigxo.com Domain", description: "Settings → Domains → add your custom domain. Manus handles SSL automatically.", category: "launch", sortOrder: 4 },
        { itemKey: "set_admin_role", label: "Set Your Role to Admin", description: "Database panel → users table → find your row → change role from 'user' to 'admin'. Unlocks the /admin dashboard.", category: "launch", sortOrder: 5 },
        { itemKey: "google_search_console", label: "Submit Sitemap to Google Search Console", description: "Go to search.google.com/search-console → Add Property → enter gigxo.com → Submit sitemap at gigxo.com/sitemap.xml", category: "seo", sortOrder: 6 },
        { itemKey: "seed_leads", label: "Seed 50+ Real Leads", description: "Go to /admin → click Scrape to pull fresh Miami gigs from Eventbrite. Approve them in the Lead Queue.", category: "launch", sortOrder: 7 },
        { itemKey: "test_payment", label: "Test a Real $7 Payment", description: "Sign up as a test artist → browse leads → click Unlock → use card 4242 4242 4242 4242 (test mode) to verify the full payment flow.", category: "launch", sortOrder: 8 },
        { itemKey: "first_artist", label: "Get Your First 5 Artists Signed Up", description: "Share your referral link in Miami DJ Facebook groups. First 100 artists get 50% off — use the scarcity banner as your hook.", category: "growth", sortOrder: 9 },
        { itemKey: "cancel_bubble", label: "Cancel Bubble Membership", description: "Once gigxo.com is live and tested, cancel your Bubble subscription. This platform fully replaces it.", category: "launch", sortOrder: 10 },
      ];

      await db.insert(ownerChecklist).values(defaults.map(d => ({ ...d, isCompleted: false })));
      return await db.select().from(ownerChecklist).orderBy(ownerChecklist.sortOrder);
    }),

    toggleChecklist: protectedProcedure
      .input(z.object({ itemKey: z.string(), isCompleted: z.boolean() }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) return { success: false };
        const { ownerChecklist } = await import("../drizzle/schema");
        await db.update(ownerChecklist)
          .set({ isCompleted: input.isCompleted, completedAt: input.isCompleted ? new Date() : null })
          .where(eq(ownerChecklist.itemKey, input.itemKey));
        return { success: true };
      }),

    getGrowthTasks: protectedProcedure.query(async () => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];
      const { growthTasks } = await import("../drizzle/schema");

      const existing = await db.select().from(growthTasks).orderBy(growthTasks.sortOrder);
      if (existing.length > 0) return existing;

      // Seed default growth tasks
      const defaults = [
        // DAILY
        { title: "Run the Lead Scraper", description: "Click Scrape in the admin dashboard to pull fresh Miami gigs from Eventbrite. Approve the best ones in the Lead Queue.", category: "daily", frequency: "daily", estimatedRevenue: "+$21–$70/day (3–10 unlocks)", isAutomated: false, sortOrder: 1 },
        { title: "Send AI Match Emails", description: "Click 'Send Match Emails' in admin. The AI scores every lead against every artist profile and sends blurred teaser emails to 65%+ matches.", category: "daily", frequency: "daily", estimatedRevenue: "+$14–$35/day (2–5 unlocks)", isAutomated: true, sortOrder: 2 },
        { title: "Approve Pending Leads", description: "Review the Lead Queue in /admin. Approve high-quality leads, reject spam. Aim for 5–10 new approved leads per day.", category: "daily", frequency: "daily", estimatedRevenue: "Keeps pipeline fresh", isAutomated: false, sortOrder: 3 },
        { title: "Check New Booking Inquiries", description: "Review the Inquiries tab in your artist dashboard. Respond to any new booking requests within 24 hours to maintain quality.", category: "daily", frequency: "daily", estimatedRevenue: "Builds trust + retention", isAutomated: false, sortOrder: 4 },
        // WEEKLY
        { title: "Post in Miami DJ Facebook Groups", description: "Share your referral link in groups like 'Miami DJs', 'South Florida Event Professionals', 'Miami Wedding Vendors'. Use the scarcity banner hook: 'First 100 artists get 50% off'.", category: "weekly", frequency: "weekly", estimatedRevenue: "+3–8 new artists/week", isAutomated: false, sortOrder: 5 },
        { title: "Send Weekly Digest Email", description: "Click 'Send Digest' in admin. Sends a curated list of the week's best leads to all artists. Drives re-engagement and unlocks.", category: "weekly", frequency: "weekly", estimatedRevenue: "+$49–$140/week", isAutomated: true, sortOrder: 6 },
        { title: "Send Re-Engagement Email", description: "Click 'Re-Engage' in admin. Sends a win-back email to artists who haven't logged in for 7+ days. Recovers churned users.", category: "weekly", frequency: "weekly", estimatedRevenue: "+$14–$49/week", isAutomated: true, sortOrder: 7 },
        { title: "Review Revenue Dashboard", description: "Check /admin analytics: total revenue, unlocks per day, top artists by spend. Identify what's working and double down.", category: "weekly", frequency: "weekly", estimatedRevenue: "Data-driven growth", isAutomated: false, sortOrder: 8 },
        { title: "Add 10 New Leads Manually", description: "Browse Thumbtack, Yelp, Craigslist gigs, Nextdoor events, or local Facebook groups. Add the best gigs manually via the admin 'Add Lead' form.", category: "weekly", frequency: "weekly", estimatedRevenue: "+$70/week (10 unlocks)", isAutomated: false, sortOrder: 9 },
        // MONTHLY
        { title: "Expand to a New City", description: "Once Miami is profitable, add 50 leads for a new market: Orlando, Tampa, Atlanta, or Houston. Copy the Miami playbook exactly.", category: "monthly", frequency: "monthly", estimatedRevenue: "+$500–$2,000/month per city", isAutomated: false, sortOrder: 10 },
        { title: "A/B Test Lead Pricing", description: "Try $5, $7, and $10 unlock prices with different artist segments. Even a $1 increase on 100 unlocks = $100 more/month.", category: "monthly", frequency: "monthly", estimatedRevenue: "+10–30% revenue", isAutomated: false, sortOrder: 11 },
        { title: "Promote Premium Tier", description: "Email artists who've unlocked 3+ leads about the $19/month plan (5 unlocks). They're already proven buyers — upsell them.", category: "monthly", frequency: "monthly", estimatedRevenue: "+$19/artist/month", isAutomated: false, sortOrder: 12 },
        { title: "Recruit 5 Lead Scouts", description: "Pay freelancers $1–2 per approved lead to browse Thumbtack, Craigslist, Nextdoor, and local event sites. Scales lead volume without your time.", category: "monthly", frequency: "monthly", estimatedRevenue: "10x lead volume", isAutomated: false, sortOrder: 13 },
        { title: "Review and Refresh SEO Content", description: "Check Google Search Console for impressions. Add 2–3 new city/genre pages (e.g. 'Miami Wedding DJ Gigs'). Each page = free organic traffic.", category: "monthly", frequency: "monthly", estimatedRevenue: "Free organic signups", isAutomated: false, sortOrder: 14 },
      ];

      await db.insert(growthTasks).values(defaults.map(d => ({ ...d, status: "pending" })));
      return await db.select().from(growthTasks).orderBy(growthTasks.sortOrder);
    }),

    updateGrowthTask: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["pending", "done", "skipped"]).optional(),
        notes: z.string().optional(),
        lastDoneAt: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) return { success: false };
        const { growthTasks } = await import("../drizzle/schema");
        await db.update(growthTasks)
          .set({
            ...(input.status !== undefined ? { status: input.status } : {}),
            ...(input.notes !== undefined ? { notes: input.notes } : {}),
            ...(input.lastDoneAt ? { lastDoneAt: new Date() } : {}),
          })
          .where(eq(growthTasks.id, input.id));
        return { success: true };
      }),

  }),

  // ── Automation: Drip Emails + Outreach Templates ────────────────────────────
  automation: router({
    // ─── Drip Email: Send Day-3 drip to artists who haven't unlocked yet ─────
    sendDay3Drip: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return { sent: 0 };
      const { users, transactions, gigLeads } = await import("../drizzle/schema");
      const { sendDay3DripEmail } = await import("./email");
      const origin = ctx.req.headers.origin ?? "https://gigxo.com";

      // Artists who signed up 2-4 days ago and have ZERO unlocks
      const threeDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const candidates = await db.select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(and(gte(users.createdAt, threeDaysAgo), sql`${users.createdAt} <= ${twoDaysAgo}`, eq(users.role, "user")));

      // Get a sample approved lead for the preview
      const sampleLeads = await db.select({ id: gigLeads.id, title: gigLeads.title, budget: gigLeads.budget, location: gigLeads.location })
        .from(gigLeads)
        .where(and(eq(gigLeads.isApproved, true), eq(gigLeads.isHidden, false)))
        .orderBy(desc(gigLeads.createdAt))
        .limit(1);
      const sample = sampleLeads[0];
      if (!sample) return { sent: 0, reason: "No approved leads" };

      let sent = 0;
      for (const user of candidates) {
        if (!user.email) continue;
        // Check they have no unlocks
        const unlocks = await db.select({ id: transactions.id }).from(transactions)
          .where(and(eq(transactions.userId, user.id), eq(transactions.status, "completed")))
          .limit(1);
        if (unlocks.length > 0) continue; // Already unlocked, skip
        await sendDay3DripEmail(user.email, user.name ?? "", sample.title, sample.budget, sample.location, origin);
        sent++;
      }
      return { sent };
    }),

    // ─── Drip Email: Send Day-7 referral push to all artists ─────────────────
    sendDay7Drip: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return { sent: 0 };
      const { users } = await import("../drizzle/schema");
      const { sendDay7DripEmail } = await import("./email");
      const origin = ctx.req.headers.origin ?? "https://gigxo.com";

      const sevenDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
      const candidates = await db.select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(and(gte(users.createdAt, sevenDaysAgo), sql`${users.createdAt} <= ${sixDaysAgo}`, eq(users.role, "user")));

      let sent = 0;
      for (const user of candidates) {
        if (!user.email) continue;
        await sendDay7DripEmail(user.email, user.name ?? "", `ref-${user.id}`, origin);
        sent++;
      }
      return { sent };
    }),

    // ─── New Lead Alert: Notify artists whose performer type matches new leads ─
    sendNewLeadAlerts: protectedProcedure
      .input(z.object({ leadIds: z.array(z.number()).optional() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) return { sent: 0 };
        const { users, gigLeads, artistProfiles } = await import("../drizzle/schema");
        const { sendNewLeadAlertEmail } = await import("./email");
        const origin = ctx.req.headers.origin ?? "https://gigxo.com";

        // Get recently approved leads (last 24h or specific IDs)
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const newLeads = await db.select()
          .from(gigLeads)
          .where(and(
            eq(gigLeads.isApproved, true),
            eq(gigLeads.isHidden, false),
            input.leadIds?.length ? sql`${gigLeads.id} IN (${sql.join(input.leadIds.map(id => sql`${id}`), sql`, `)})` : gte(gigLeads.createdAt, since)
          ))
          .limit(50);

        if (newLeads.length === 0) return { sent: 0, reason: "No new leads" };

        // Get all artists with profiles
        const artists = await db.select({ u: users, p: artistProfiles })
          .from(users)
          .innerJoin(artistProfiles, eq(users.id, artistProfiles.userId))
          .where(eq(users.role, "user"));

        let sent = 0;
        for (const { u, p } of artists) {
          if (!u.email) continue;
          // Filter leads that match this artist's performer type or location
          const matchingLeads = newLeads.filter(lead => {
            const typeMatch = !p.genres?.length || lead.performerType === "other" ||
              (p.genres as string[]).some(g => g.toLowerCase().includes(lead.performerType ?? "") || (lead.performerType ?? "").includes(g.toLowerCase()));
            return typeMatch;
          });
          if (matchingLeads.length === 0) continue;
          const topLead = matchingLeads[0];
          await sendNewLeadAlertEmail(
            u.email, u.name ?? "", matchingLeads.length,
            { title: topLead.title, budget: topLead.budget, location: topLead.location, eventType: topLead.eventType },
            origin
          );
          sent++;
        }
        return { sent };
      }),

    // ─── Outreach Templates: Pre-written copy for DJ groups & social ─────────
    getOutreachTemplates: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return [
        {
          id: "fb_dj_group_1",
          channel: "Facebook Group",
          audience: "Miami DJ Groups",
          subject: "Anyone using Gigxo for gig leads?",
          body: "Hey everyone! Just wanted to share a platform I've been using called Gigxo (gigxo.com). They aggregate gig leads for Miami/Fort Lauderdale — weddings, corporate events, clubs, private parties. You pay $7 to unlock the client's contact info and reach out directly. No commission, no bidding wars. First 100 artists get 50% off. Thought some of you might find it useful!",
          cta: "gigxo.com",
          suggestedGroups: ["Miami DJs", "South Florida Event Professionals", "Miami Wedding Vendors", "Fort Lauderdale DJs & Entertainment", "South Florida DJ Network"]
        },
        {
          id: "fb_dj_group_2",
          channel: "Facebook Group",
          audience: "DJ & Music Groups",
          subject: "Stop paying 20% commission — $7 flat gig leads",
          body: "Real talk: I was tired of losing 20% commission on every gig. Found Gigxo — they post leads for Miami/Fort Lauderdale events and you pay $7 flat to get the client's contact info. Reach out directly, negotiate your own rate, keep 100% of the booking. Weddings, corporate events, nightclubs, private parties. Check it out at gigxo.com",
          cta: "gigxo.com",
          suggestedGroups: ["Miami Music Scene", "South Florida Musicians", "Miami Nightlife Professionals", "FL Wedding Entertainment"]
        },
        {
          id: "instagram_story",
          channel: "Instagram Story",
          audience: "DJ / Artist Followers",
          subject: "IG Story swipe-up",
          body: "🎵 Finding gigs just got easier. Gigxo posts event leads in Miami — weddings, clubs, corporate events. Pay $7 to unlock the contact, reach out directly. No middleman, no commission. Link in bio → gigxo.com",
          cta: "gigxo.com",
          suggestedGroups: ["Your IG Story", "DJ Network Stories"]
        },
        {
          id: "tiktok_caption",
          channel: "TikTok",
          audience: "DJ / Artist Audience",
          subject: "TikTok video caption",
          body: "POV: You just found a $2,000 wedding gig for $7 🎵 Gigxo posts real event leads in Miami — you pay $7 to unlock the client's contact info and book directly. No commission, no bidding. Link in bio. #DJLife #MiamiDJ #GigLife #EventDJ #WeddingDJ",
          cta: "gigxo.com",
          suggestedGroups: ["TikTok DJ community", "#DJLife", "#MiamiDJ"]
        },
        {
          id: "dm_template",
          channel: "Direct Message",
          audience: "DJ Friends & Contacts",
          subject: "DM to DJ friends",
          body: "Hey! Quick heads up — there's a platform called Gigxo (gigxo.com) that posts gig leads for Miami/Fort Lauderdale. Weddings, clubs, corporate events. You pay $7 to get the client's contact info and reach out directly. Way better than GigSalad commissions. Thought you might want to check it out!",
          cta: "gigxo.com",
          suggestedGroups: ["DJ contacts", "Musician friends", "Event professional network"]
        },
        {
          id: "nextdoor_community",
          channel: "Nextdoor / Community",
          audience: "Local Community",
          subject: "Local entertainment services",
          body: "Hi neighbors! I'm a Miami-based DJ and just discovered Gigxo, a local platform that connects event hosts with entertainment professionals. If you're planning a wedding, birthday party, corporate event, or any celebration in Miami/Fort Lauderdale, you can post your event on gigxo.com and local DJs, bands, and photographers will reach out to you directly!",
          cta: "gigxo.com",
          suggestedGroups: ["Nextdoor Miami", "Local community boards"]
        },
      ];
    }),
  }),
});
export type AppRouter = typeof appRouter;
