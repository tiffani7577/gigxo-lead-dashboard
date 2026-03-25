import { CUSTOM_AUTH_COOKIE } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { eq, and, desc, asc, not, ne, sql, gte, lte, lt, or, isNull, isNotNull, like, inArray } from "drizzle-orm";
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
import { checkoutErrorUserMessage, logStripeCheckoutSessionError } from "./stripe";

function extractCityState(raw: unknown): string {
  const fallback = "Location locked";
  try {
    if (raw == null) return fallback;
    const location = String(raw).trim();
    if (!location) return fallback;

    const parts = location.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      let city = parts[parts.length - 2];
      const state = parts[parts.length - 1];
      // Normalize common "Beach"-style phrases, e.g. "Miami Beach" → "Miami"
      city = city.replace(/\s+Beach\b/i, "");
      const cityState = `${city}, ${state}`.trim();
      if (cityState) return cityState;
    }

    return location.length > 48 ? `${location.slice(0, 48)}…` : location;
  } catch {
    return fallback;
  }
}

function sanitizePreviewText(input: string): string {
  if (!input) return "";
  return input
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[redacted]")
    .replace(/(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){2}\d{4}\b/g, "[redacted]")
    .replace(/https?:\/\/\S+/gi, "[link removed]")
    .replace(/\bwww\.\S+/gi, "[link removed]")
    // Bare social paths (no scheme) were leaking past the rules above, e.g. facebook.com/marketplace/...
    .replace(/\b(?:https?:\/\/)?(?:www\.|m\.)?(?:facebook\.com|fb\.com|fb\.me)\/[^\s]+/gi, "[link removed]")
    .replace(/\b(?:https?:\/\/)?(?:www\.)?instagram\.com\/[^\s]+/gi, "[link removed]")
    .replace(/@[a-z0-9_.]+/gi, "[handle removed]")
    .replace(/\s+/g, " ")
    .trim();
}

function inferIntentLevel(text: string): string {
  const t = text.toLowerCase();
  if (/(actively looking|need asap|urgent|book now|looking for)/i.test(t)) return "Actively looking";
  if (/(recommend|recommendation|exploring options|considering)/i.test(t)) return "Requesting recommendations";
  return "Open to options";
}

function inferRequirements(text: string, performerType?: string | null): string {
  const t = text.toLowerCase();
  const reqs: string[] = [];
  if (/spanish|bilingual|latino|latin/i.test(t)) reqs.push("Bilingual preferred");
  if (/dj|disc jockey/i.test(t)) reqs.push("DJ");
  if (/band|live music/i.test(t)) reqs.push("Band/live music");
  if (/singer|vocal/i.test(t)) reqs.push("Singer");
  if (reqs.length === 0 && performerType) reqs.push(String(performerType).replace(/_/g, " "));
  return reqs.slice(0, 2).join(", ");
}

function formatMonthYear(eventDate: unknown): string {
  const d = eventDate ? new Date(String(eventDate)) : null;
  if (!d || Number.isNaN(d.getTime())) return "Date TBD";
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function buildPublicPreviewDescription(params: {
  fullDescription: string;
  eventType?: string | null;
  location?: string | null;
  eventDate?: unknown;
  performerType?: string | null;
}): string {
  const sanitized = sanitizePreviewText(params.fullDescription);
  if (!sanitized) return "";
  const cityState = extractCityState(params.location ?? "");
  const monthYear = formatMonthYear(params.eventDate);
  const eventType = (params.eventType ?? "Event").trim() || "Event";
  const requirements = inferRequirements(sanitized, params.performerType);
  const intent = inferIntentLevel(sanitized);
  const bits = [
    `${eventType} in ${cityState} (${monthYear}).`,
    requirements ? `Requirements: ${requirements}.` : "",
    `Intent: ${intent}.`,
  ].filter(Boolean);
  const summary = bits.join(" ");
  return summary.length > 220 ? `${summary.slice(0, 217)}...` : summary;
}

/** True when the lead's primary contact path is a Facebook / IG profile (no email/phone) or venueUrl is Facebook. */
function computeHasFacebookProfileLink(lead: {
  contactEmail?: unknown;
  contactPhone?: unknown;
  venueUrl?: unknown;
  description?: unknown;
  fullDescription?: unknown;
  publicPreviewDescription?: unknown;
}): boolean {
  const noDirect = !String(lead.contactEmail ?? "").trim() && !String(lead.contactPhone ?? "").trim();
  if (!noDirect) return false;
  const vu = String(lead.venueUrl ?? "");
  if (vu && /facebook\.com/i.test(vu)) return true;
  const blob = [
    lead.fullDescription,
    lead.description,
    lead.publicPreviewDescription,
  ]
    .map((x) => String(x ?? ""))
    .join("\n");
  if (/\b(?:https?:\/\/)?(?:www\.|m\.)?(?:facebook\.com|fb\.com|fb\.me)\//i.test(blob)) return true;
  if (/\b(?:https?:\/\/)?(?:www\.)?instagram\.com\//i.test(blob)) return true;
  return false;
}

function getSafePublicPreview(params: {
  publicPreviewDescription?: unknown;
  fullDescription?: unknown;
  legacyDescription?: unknown;
  eventType?: unknown;
  location?: unknown;
  eventDate?: unknown;
  performerType?: unknown;
}): string {
  const explicit = sanitizePreviewText(String(params.publicPreviewDescription ?? "").trim());
  if (explicit) return explicit;
  const full = String(params.fullDescription ?? params.legacyDescription ?? "").trim();
  const generated = buildPublicPreviewDescription({
    fullDescription: full,
    eventType: String(params.eventType ?? ""),
    location: String(params.location ?? ""),
    eventDate: params.eventDate,
    performerType: String(params.performerType ?? ""),
  });
  if (generated) return generated;
  const fallback = sanitizePreviewText(full);
  return fallback ? fallback.slice(0, 150) : "";
}

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
    // Public client intake: /book-dj and SEO pages
    submitClientLead: publicProcedure
      .input(z.object({
        name: z.string().min(1),
        email: z.string().email().optional(),
        eventDate: z.string().optional(),
        eventTime: z.string().optional(),
        location: z.string().min(1),
        eventType: z.string().min(1).optional(),
        budget: z.number().min(0).optional(),
        budgetRange: z.string().optional(),
        notes: z.string().optional(),
        sourceSlug: z.string().optional(),
        calculatorContext: z.any().optional(),
        estimateEmail: z.string().email().optional(),
        estimatePhone: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { gigLeads } = await import("../drizzle/schema");
        const { LEAD_TIER_PRICE_CENTS, normalizeLeadPriceCents } = await import("../shared/leadPricing");

        const TRUSTED_SEO_SOURCES: Record<
          string,
          { defaultLeadTier: keyof typeof LEAD_TIER_PRICE_CENTS; defaultPerformerType: string }
        > = {
          "yacht-dj-fort-lauderdale": { defaultLeadTier: "premium", defaultPerformerType: "dj" },
          "private-yacht-party-dj-fort-lauderdale": { defaultLeadTier: "standard", defaultPerformerType: "dj" },
          "luxury-yacht-entertainment-fort-lauderdale": { defaultLeadTier: "premium", defaultPerformerType: "dj" },
          "last-minute-yacht-dj-fort-lauderdale": { defaultLeadTier: "premium", defaultPerformerType: "dj" },
          "corporate-yacht-event-dj-fort-lauderdale": { defaultLeadTier: "premium", defaultPerformerType: "dj" },
          "yacht-bachelorette-party-dj-fort-lauderdale": { defaultLeadTier: "standard", defaultPerformerType: "dj" },
          "yacht-live-music-fort-lauderdale": { defaultLeadTier: "standard", defaultPerformerType: "dj" },
          "yacht-dj-miami": { defaultLeadTier: "standard", defaultPerformerType: "dj" },
          "hire-yacht-dj-fort-lauderdale": { defaultLeadTier: "standard", defaultPerformerType: "dj" },
          "17th-street-yacht-dj-fort-lauderdale": { defaultLeadTier: "premium", defaultPerformerType: "dj" },
        };

        // Prefer explicit numeric budget; fall back to budgetRange if provided
        let budgetCents: number | null = null;
        if (input.budget != null) {
          budgetCents = Math.round(input.budget * 100);
        } else if (input.budgetRange) {
          // Rough midpoint mapping for ranges
          if (input.budgetRange === "500-1000") budgetCents = 75000;
          else if (input.budgetRange === "1000-1500") budgetCents = 125000;
          else if (input.budgetRange === "1500-2500") budgetCents = 200000;
          else if (input.budgetRange === "2500-plus") budgetCents = 250000;
        }

        const effectiveEventType = input.eventType ?? "client_yacht_inquiry";
        const leadTitle = `${effectiveEventType} - ${input.location}`;

        const effectiveEmail = input.email ?? input.estimateEmail ?? "";

        const descriptionParts = [
          `Client name: ${input.name}`,
          effectiveEmail ? `Client email: ${effectiveEmail}` : null,
          input.eventTime ? `Event time: ${input.eventTime}` : null,
          input.budgetRange ? `Budget range: ${input.budgetRange}` : null,
          input.sourceSlug ? `Source: ${input.sourceSlug}` : null,
          input.estimatePhone ? `Phone (from calculator): ${input.estimatePhone}` : null,
          input.calculatorContext ? `Calculator context: ${JSON.stringify(input.calculatorContext)}` : null,
          input.notes ? `Notes: ${input.notes}` : null,
        ].filter(Boolean);

        const insertResult = await db.insert(gigLeads).values({
          externalId: `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          source: "gigxo",
          leadType: "client_submitted",
          title: leadTitle,
          description: descriptionParts.join("\n"),
          eventType: effectiveEventType,
          budget: budgetCents ?? null,
          location: input.location,
          eventDate: input.eventDate ? new Date(input.eventDate) : null,
          contactName: input.name,
          contactEmail: effectiveEmail || null,
          contactPhone: input.estimatePhone ?? null,
          venueUrl: null,
          performerType: "dj",
          leadCategory: "general",
          // Mark as high-intent so it floats up in future scoring
          intentScore: 90,
          leadTemperature: "hot",
        } as any);

        const insertedIdRaw = (insertResult as any).insertId;
        const insertedId = typeof insertedIdRaw === "number" ? insertedIdRaw : NaN;

        // Derive effective slug from explicit input or description "Source: ..." line
        let effectiveSlug: string | undefined = input.sourceSlug;
        if (!effectiveSlug) {
          const desc = descriptionParts.join("\n");
          const sourceLine = desc
            .split("\n")
            .find((line) => line.trim().startsWith("Source: "));
          if (sourceLine) {
            const extracted = sourceLine.replace("Source:", "").trim();
            if (extracted) {
              effectiveSlug = extracted;
            }
          }
        }

        if (effectiveSlug && TRUSTED_SEO_SOURCES[effectiveSlug] && Number.isFinite(insertedId)) {
          const config = TRUSTED_SEO_SOURCES[effectiveSlug];
          const tier = config.defaultLeadTier;
          const basePrice = LEAD_TIER_PRICE_CENTS[tier];
          const normalizedPrice = normalizeLeadPriceCents(basePrice);

          await db
            .update(gigLeads)
            .set({
              isApproved: true,
              leadType: "client_submitted",
              leadMonetizationType: "artist_unlock",
              artistUnlockEnabled: true,
              leadTier: tier,
              unlockPriceCents: normalizedPrice,
              performerType: config.defaultPerformerType,
            } as any)
            .where((gigLeads as any).id.eq(insertedId));

          console.log(
            `[seo-auto-publish] leadId=${insertedId} slug=${effectiveSlug} tier=${tier} price=${normalizedPrice}`,
          );
        }

        return { success: true };
      }),
  }),
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),

    /** One-time onboarding: set userType (performer | client | venue).
     *  Temporarily disabled until userType migration is deployed.
     */
    setUserType: protectedProcedure
      .input(z.object({ userType: z.enum(["performer", "client", "venue"]) }))
      .mutation(async () => {
        return { ok: false };
      }),
  
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

        const sessionUserId = ctx.user.id;
        
        const existing = await db.select().from(artistProfiles)
          .where(eq(artistProfiles.userId, sessionUserId)).limit(1);
        
        if (existing.length === 0) {
          await db.insert(artistProfiles).values({
            userId: sessionUserId,
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
            showInDirectory: false,
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
          await db.update(artistProfiles).set(updateData).where(eq(artistProfiles.userId, sessionUserId));
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
        minBudget: z.number().min(0).optional(),
        maxDistance: z.number().min(0).max(200).optional(),
        profileImageUrl: z.string().url().optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getDb, getOrCreateArtistProfile } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { artistProfiles } = await import("../drizzle/schema");

        // Ensure profile exists (auto-create with defaults if missing)
        const profile = await getOrCreateArtistProfile(ctx.user.id);
        if (!profile) throw new Error("Failed to load or create artist profile");
        if (profile.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only update your own artist profile.",
          });
        }

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
        if (input.minBudget !== undefined) updateData.minBudget = input.minBudget;
        if (input.maxDistance !== undefined) updateData.maxDistance = input.maxDistance;
        if (input.profileImageUrl !== undefined) updateData.profileImageUrl = input.profileImageUrl;

        if (Object.keys(updateData).length > 0) {
          await db.update(artistProfiles).set(updateData).where(eq(artistProfiles.userId, ctx.user.id));
        }

        const updated = await db.select().from(artistProfiles).where(eq(artistProfiles.userId, ctx.user.id)).limit(1);
        return updated.length > 0 ? updated[0] : null;
      }),

    uploadProfileImage: protectedProcedure
      .input(z.object({
        fileBase64: z.string(),
        mimeType: z.string().default("image/jpeg"),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("./db");
        const { artistProfiles } = await import("../drizzle/schema");
        const { ENV } = await import("./_core/env");

        const MAX_SIZE = 5 * 1024 * 1024; // 5MB (Forge path)
        const buffer = Buffer.from(input.fileBase64, "base64");
        if (buffer.length > MAX_SIZE) throw new Error("Image too large. Max 5MB.");

        const forgeConfigured =
          !!ENV.forgeApiUrl?.trim() && !!ENV.forgeApiKey?.trim();

        let url: string;
        if (forgeConfigured) {
          const { storagePut } = await import("./storage");
          const ext = (input.mimeType === "image/png" ? "png" : input.mimeType === "image/webp" ? "webp" : "jpg");
          const fileKey = `profile-images/${ctx.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const result = await storagePut(fileKey, buffer, input.mimeType);
          url = result.url;
        } else {
          const MAX_DATA_URL_BYTES = 5 * 1024 * 1024; // 5MB for direct storage fallback
          const base64Length = input.fileBase64.length;
          if (base64Length > MAX_DATA_URL_BYTES) {
            throw new Error("Image too large for direct storage. Please use an image under 5MB.");
          }
          url = `data:${input.mimeType};base64,${input.fileBase64}`;
        }

        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const [ownedProfile] = await db
          .select({ userId: artistProfiles.userId })
          .from(artistProfiles)
          .where(eq(artistProfiles.userId, ctx.user.id))
          .limit(1);
        if (!ownedProfile || ownedProfile.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only update your own artist profile.",
          });
        }
        await db.update(artistProfiles).set({ profileImageUrl: url, photoUrl: url, avatarUrl: url }).where(eq(artistProfiles.userId, ctx.user.id));

        return { url };
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
        
        // Get all approved leads that are not hidden, not reserved, not expired, and artist-visible (exclude admin-only venue_intelligence / manual_outreach)
        // DBPR and venue_intelligence must never appear in the artist marketplace
        // Monetization: only show leads where artistUnlockEnabled is not false (default true)
        const now = new Date();
        const artistVisibleLead = and(
          not(eq(gigLeads.source, "dbpr")),
          or(isNull(gigLeads.leadCategory), not(eq(gigLeads.leadCategory, "venue_intelligence"))),
          or(isNull(gigLeads.leadType), not(inArray(gigLeads.leadType, ["venue_intelligence", "manual_outreach"])))
        );
        const leads = await db.select({
          id: gigLeads.id,
          externalId: gigLeads.externalId,
          source: gigLeads.source,
          sourceLabel: gigLeads.sourceLabel,
          leadType: gigLeads.leadType,
          leadCategory: gigLeads.leadCategory,
          title: gigLeads.title,
          description: gigLeads.description,
          publicPreviewDescription: (gigLeads as any).publicPreviewDescription,
          fullDescription: (gigLeads as any).fullDescription,
          eventType: gigLeads.eventType,
          budget: gigLeads.budget,
          location: gigLeads.location,
          eventDate: gigLeads.eventDate,
          contactName: gigLeads.contactName,
          contactEmail: gigLeads.contactEmail,
          contactPhone: gigLeads.contactPhone,
          venueUrl: gigLeads.venueUrl,
          performerType: gigLeads.performerType,
          leadTier: (gigLeads as any).leadTier,
          unlockPriceCents: gigLeads.unlockPriceCents,
          intentScore: gigLeads.intentScore,
          finalScore: gigLeads.finalScore,
          winProbability: (gigLeads as any).winProbability,
          competitionLevel: (gigLeads as any).competitionLevel,
          buyerType: (gigLeads as any).buyerType,
          suggestedRate: (gigLeads as any).suggestedRate,
          pitchStyle: (gigLeads as any).pitchStyle,
          intentEvidence: (gigLeads as any).intentEvidence,
          contactEvidence: (gigLeads as any).contactEvidence,
          eventEvidence: (gigLeads as any).eventEvidence,
          leadTemperature: (gigLeads as any).leadTemperature,
          status: gigLeads.status,
          createdAt: gigLeads.createdAt,
        }).from(gigLeads)
          .where(and(
            eq(gigLeads.isApproved, true),
            eq(gigLeads.isHidden, false),
            eq(gigLeads.isReserved, false),
            or(isNull((gigLeads as any).artistUnlockEnabled), eq((gigLeads as any).artistUnlockEnabled, true)),
            artistVisibleLead,
            // Only show leads where eventDate is in the future OR eventDate is not set
            or(isNull(gigLeads.eventDate), gte(gigLeads.eventDate, now))
          ))
          .orderBy(desc(sql`COALESCE(${gigLeads.finalScore}, ${gigLeads.intentScore})`), desc(gigLeads.createdAt))
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
          filtered = filtered.filter(l => (l.location ?? "").toLowerCase().includes(cityLower));
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
        
        // Return leads with contact blurred unless unlocked (reduce lead leakage)
        const LOCKED_LOCATION = "Location locked";
        return filtered.map(lead => {
          const isUnlocked = unlockedLeadIds.has(lead.id);
          const safeTitle = (lead.title ?? "") as string;
          const safeLocation = (lead.location ?? "") as string;
          const safeFullDescription = ((lead as any).fullDescription ?? lead.description ?? "") as string;
          const safePreviewDescription = getSafePublicPreview({
            publicPreviewDescription: (lead as any).publicPreviewDescription,
            fullDescription: (lead as any).fullDescription,
            legacyDescription: lead.description,
            eventType: lead.eventType,
            location: lead.location,
            eventDate: lead.eventDate,
            performerType: lead.performerType,
          });
          return {
            ...lead,
            title: safeTitle,
            location: isUnlocked ? safeLocation : extractCityState(safeLocation),
            description: isUnlocked ? safeFullDescription : safePreviewDescription,
            fullDescription: isUnlocked ? safeFullDescription : null,
            publicPreviewDescription: safePreviewDescription,
            venueUrl: isUnlocked ? lead.venueUrl : null,
            isUnlocked,
            contactName: isUnlocked ? lead.contactName : null,
            contactEmail: isUnlocked ? lead.contactEmail : null,
            contactPhone: isUnlocked ? lead.contactPhone : null,
            hasContactEmail: !!lead.contactEmail,
            hasContactPhone: !!lead.contactPhone,
            hasFacebookProfileLink: computeHasFacebookProfileLink(lead),
            viewCount: (viewCounts[lead.id] ?? 0) + ((lead.id * 17 + 43) % 67) + 12,
            unlockCount: unlockCounts[lead.id] ?? 0,
          };
        });
      }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const { getLeadById, hasUnlockedLead } = await import("./db");
        const lead = await getLeadById(input.id);
        
        if (!lead) throw new Error("Lead not found");
        if ((lead as any).leadType === "venue_intelligence" || (lead as any).leadType === "manual_outreach" || (lead as any).leadCategory === "venue_intelligence") {
          throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
        }
        
        const unlocked = await hasUnlockedLead(ctx.user.id, input.id);
        // Mask contact and deep details when locked (reduce lead leakage)
        const LOCKED_LOCATION = "Location locked";
        const safeTitle = ((lead as any).title ?? "") as string;
        const safeLocation = ((lead as any).location ?? "") as string;
        const safeFullDescription = (((lead as any).fullDescription ?? (lead as any).description) ?? "") as string;
        const safePreviewDescription = getSafePublicPreview({
          publicPreviewDescription: (lead as any).publicPreviewDescription,
          fullDescription: (lead as any).fullDescription,
          legacyDescription: (lead as any).description,
          eventType: (lead as any).eventType,
          location: (lead as any).location,
          eventDate: (lead as any).eventDate,
          performerType: (lead as any).performerType,
        });
        return {
          ...lead,
          title: safeTitle,
          location: unlocked ? safeLocation : extractCityState(safeLocation),
          description: unlocked ? safeFullDescription : safePreviewDescription,
          fullDescription: unlocked ? safeFullDescription : null,
          publicPreviewDescription: safePreviewDescription,
          venueUrl: unlocked ? lead.venueUrl : null,
          isUnlocked: unlocked,
          contactName: unlocked ? lead.contactName : null,
          contactEmail: unlocked ? lead.contactEmail : null,
          contactPhone: unlocked ? lead.contactPhone : null,
          hasContactEmail: !!lead.contactEmail,
          hasContactPhone: !!lead.contactPhone,
          hasFacebookProfileLink: computeHasFacebookProfileLink(lead),
        };
      }),
      
    getStats: protectedProcedure.query(async ({ ctx }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const { gigLeads, leadUnlocks } = await import("../drizzle/schema");
      
      const artistVisibleLead = and(
        or(isNull(gigLeads.leadType), not(inArray(gigLeads.leadType, ["venue_intelligence", "manual_outreach"]))),
        or(isNull(gigLeads.leadCategory), not(eq(gigLeads.leadCategory, "venue_intelligence")))
      );
      const [totalLeads] = await db.select({ count: sql<number>`COUNT(*)` }).from(gigLeads)
        .where(and(eq(gigLeads.isApproved, true), artistVisibleLead));
      
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

        const { logBookingResult } = await import("./leadConversionLog");
        logBookingResult({ leadId: input.leadId, outcome: input.outcome, booking_result: input.outcome });

        return { success: true };
      }),

    updateLeadStatus: protectedProcedure
      .input(z.object({
        leadId: z.number(),
        status: z.enum(["new", "contacted", "followed_up", "booked"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { gigLeads, leadUnlocks } = await import("../drizzle/schema");

        // Must have unlocked this lead first
        const [unlock] = await db.select().from(leadUnlocks)
          .where(and(eq(leadUnlocks.userId, ctx.user.id), eq(leadUnlocks.leadId, input.leadId)))
          .limit(1);
        if (!unlock) throw new TRPCError({ code: "FORBIDDEN", message: "You must unlock this lead before updating status." });

        await db.update(gigLeads)
          .set({ status: input.status })
          .where(eq(gigLeads.id, input.leadId));

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

      // Pull top approved, visible, non-reserved, artist-visible leads with a budget (exclude venue_intelligence / manual_outreach)
      const artistVisibleLead = and(
        or(isNull(gigLeads.leadType), not(inArray(gigLeads.leadType, ["venue_intelligence", "manual_outreach"]))),
        or(isNull(gigLeads.leadCategory), not(eq(gigLeads.leadCategory, "venue_intelligence")))
      );
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
          artistVisibleLead,
          isNotNull(gigLeads.budget),
          or(isNull(gigLeads.eventDate), gte(gigLeads.eventDate, new Date())),
        ))
        .orderBy(desc(gigLeads.budget))
        .limit(3);

      return rows.map((r) => ({
        ...r,
        description: sanitizePreviewText(String(r.description ?? "")),
        // Never expose contact info on public endpoint
        contactName: null,
        contactEmail: null,
        contactPhone: null,
      }));
    }),

    /** Public summary for SEO pages: count and teasers by location/service (no contact, masked identity). */
    getPublicSummary: publicProcedure
      .input(z.object({ location: z.string().optional(), serviceHint: z.string().optional() }))
      .query(async ({ input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) return { count: 0, teasers: [] };
        const { gigLeads } = await import("../drizzle/schema");
        const { desc, and, eq, isNotNull, gte, or, isNull, not, inArray, like } = await import("drizzle-orm");
        const now = new Date();
        const artistVisibleLead = and(
          or(isNull(gigLeads.leadType), not(inArray(gigLeads.leadType, ["venue_intelligence", "manual_outreach"]))),
          or(isNull(gigLeads.leadCategory), not(eq(gigLeads.leadCategory, "venue_intelligence")))
        );
        const conditions = [
          eq(gigLeads.isApproved, true),
          eq(gigLeads.isHidden, false),
          eq(gigLeads.isReserved, false),
          artistVisibleLead,
          or(isNull(gigLeads.eventDate), gte(gigLeads.eventDate, now)),
        ];
        if (input.location?.trim()) {
          conditions.push(like(gigLeads.location, `%${input.location.trim()}%`));
        }
        if (input.serviceHint?.toLowerCase() === "dj") {
          conditions.push(eq(gigLeads.performerType, "dj"));
        } else if (input.serviceHint?.toLowerCase() === "band") {
          conditions.push(inArray(gigLeads.performerType, ["small_band", "large_band"]));
        }
        const where = and(...conditions);
        const [countRow] = await db.select({ count: sql<number>`COUNT(*)` }).from(gigLeads).where(where);
        const count = Number(countRow?.count ?? 0);
        const rows = await db.select({
          title: gigLeads.title,
          budget: gigLeads.budget,
          eventType: gigLeads.eventType,
        }).from(gigLeads).where(where).orderBy(desc(gigLeads.createdAt)).limit(3);
        const teasers = rows.map(r => ({
          title: "Event lead",
          budgetDisplay: r.budget ? `$${Math.round(r.budget / 100)}` : "—",
          eventType: r.eventType ?? "Event",
        }));
        return { count, teasers };
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
        if ((lead as any).leadType === "venue_intelligence" || (lead as any).leadType === "manual_outreach" || (lead as any).leadCategory === "venue_intelligence") {
          throw new Error("Lead not available");
        }
        if ((lead as any).artistUnlockEnabled === false) throw new Error("Lead not available");
        
        // Dynamic, normalized price based on tier/budget/override
        const DYNAMIC_PRICE = getLeadUnlockPriceCents(
          (lead as any).budget,
          (lead as any).unlockPriceCents,
          (lead as any).leadTier,
        );
        
        // Check if already unlocked
        const alreadyUnlocked = await hasUnlockedLead(ctx.user.id, input.leadId);
        if (alreadyUnlocked) {
          console.log(
            `[payments.createPaymentIntent] already-unlocked userId=${ctx.user.id} leadId=${input.leadId}`,
          );
          throw new Error("Lead already unlocked");
        }
        
        // Ensure Pro subscribers have their 15 monthly credits for current period
        const { getDb } = await import("./db");
        const db = await getDb();
        if (db) {
          const { ensureProMonthlyCredits } = await import("./proCredits");
          await ensureProMonthlyCredits(ctx.user.id, db);
        }
        
        // Check for available credits (referral, promo, pro_monthly)
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

        console.log(
          `[payments.createPaymentIntent] userId=${ctx.user.id} leadId=${input.leadId} priceCents=${DYNAMIC_PRICE} creditApplied=${creditApplied} finalAmount=${finalAmount}`,
        );
        
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
        if ((lead as any).leadType === "venue_intelligence" || (lead as any).leadType === "manual_outreach" || (lead as any).leadCategory === "venue_intelligence") {
          throw new Error("Lead not available");
        }
        
        // Check if already unlocked
        const alreadyUnlocked = await hasUnlockedLead(ctx.user.id, input.leadId);
        if (alreadyUnlocked) {
          console.log(
            `[payments.confirmPayment] already-unlocked userId=${ctx.user.id} leadId=${input.leadId}`,
          );
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
        
        const { getLeadUnlockPriceCents } = await import("../shared/leadPricing");
        const { getLeadById: getLead2 } = await import("./db");
        const lead2 = await getLead2(input.leadId);
        const actualAmount = getLeadUnlockPriceCents(
          (lead2 as any)?.budget,
          (lead2 as any)?.unlockPriceCents,
          (lead2 as any)?.leadTier,
        );
        
        // Verify payment — skip if fully covered by credits
        if (!input.isFree) {
          if (!input.paymentIntentId) throw new Error("Payment intent required");
          const paymentValid = await verifyPaymentIntent(input.paymentIntentId);
          if (!paymentValid) throw new Error("Payment not verified");
        }
        
        // Apply credits: mirror createPaymentIntent behavior and consume at most one unused credit row
        const { getDb } = await import("./db");
        const db = await getDb();
        if (db) {
          const { userCredits } = await import("../drizzle/schema");
          const credits = await db.select().from(userCredits)
            .where(and(eq(userCredits.userId, ctx.user.id), eq(userCredits.isUsed, false)))
            .orderBy(userCredits.createdAt)
            .limit(1);
          if (credits.length > 0) {
            await db.update(userCredits)
              .set({ isUsed: true })
              .where(eq(userCredits.id, credits[0].id));
          }
        }
        
        // Record the unlock
        await recordLeadUnlock(ctx.user.id, input.leadId);
        const { logLeadUnlocked } = await import("./leadConversionLog");
        logLeadUnlocked({
          leadId: input.leadId,
          lead_source: (lead as any).source,
          intent_score: (lead as any).intentScore ?? null,
          unlock_rate: 1,
        });

        console.log(
          `[payments.confirmPayment] unlocked userId=${ctx.user.id} leadId=${input.leadId} amountCents=${actualAmount} isFree=${!!input.isFree}`,
        );
        
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
        if ((lead as any).leadType === "venue_intelligence" || (lead as any).leadType === "manual_outreach" || (lead as any).leadCategory === "venue_intelligence") {
          throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
        }
        
        return {
          contactName: lead.contactName,
          contactEmail: lead.contactEmail,
          contactPhone: lead.contactPhone,
          venueUrl: lead.venueUrl,
          description: (lead as any).fullDescription ?? lead.description,
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
        if (!pack) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid credit pack." });
        }

        const StripeSdk = (await import("stripe")).default;
        const key = process.env.STRIPE_SECRET_KEY?.trim();
        if (!key) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe secret key is not configured" });
        }
        const stripeClient = new StripeSdk(key, { apiVersion: "2026-02-25.clover" });

        const origin = ctx.req.headers.origin ?? "https://www.gigxo.com";
        try {
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

          if (!session?.url) {
            console.error("[payments.purchaseCreditPack] Stripe returned no session.url", { sessionId: session?.id, packId: pack.id });
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Checkout did not return a redirect URL. Please try again." });
          }
          return { checkoutUrl: session.url };
        } catch (err) {
          if (err instanceof TRPCError) throw err;
          logStripeCheckoutSessionError("payments.purchaseCreditPack", err);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: checkoutErrorUserMessage(err, "Could not start checkout. Please try again."),
            cause: err,
          });
        }
      }),

    /** Admin: one random approved marketplace-style lead for outreach script snippets */
    getRandomMarketplaceLead: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const { gigLeads } = await import("../drizzle/schema");
      const lead = await db
        .select({
          id: gigLeads.id,
          title: gigLeads.title,
          eventType: gigLeads.eventType,
          location: gigLeads.location,
          budget: gigLeads.budget,
          eventDate: gigLeads.eventDate,
        })
        .from(gigLeads)
        .where(
          and(
            eq(gigLeads.isApproved, true),
            eq(gigLeads.isRejected, false),
            eq(gigLeads.isHidden, false),
            eq(gigLeads.artistUnlockEnabled, true),
          )
        )
        .orderBy(sql`RAND()`)
        .limit(1);
      return lead[0] ?? null;
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
    getAVRequests: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { gigLeads } = await import("../drizzle/schema");
      return await db
        .select()
        .from(gigLeads)
        .where(eq(gigLeads.source, "av_staffing" as any))
        .orderBy(desc(gigLeads.createdAt));
    }),

    getAVWorkers: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { avWorkers } = await import("../drizzle/schema");
      return await db
        .select()
        .from(avWorkers)
        .orderBy(desc(avWorkers.createdAt));
    }),

    updateAVRequestStatus: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["new", "in_progress", "fulfilled"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new Error("Unauthorized");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { gigLeads } = await import("../drizzle/schema");
        const [existing] = await db
          .select({ id: gigLeads.id, notes: gigLeads.notes })
          .from(gigLeads)
          .where(eq(gigLeads.id, input.id))
          .limit(1);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Request not found" });
        const current = existing.notes ?? "";
        const cleaned = current
          .split("\n")
          .filter((line) => !line.startsWith("avStatus="))
          .join("\n");
        const notes = `${cleaned}${cleaned ? "\n" : ""}avStatus=${input.status}`;
        await db.update(gigLeads).set({ notes }).where(eq(gigLeads.id, input.id));
        return { success: true };
      }),

    getPendingLeads: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== 'admin') throw new Error("Unauthorized");
      
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const { gigLeads } = await import("../drizzle/schema");
      // Auto-reject stale low-score leads: pending > 72h and intentScore < 50
      const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);
      const toAutoReject = await db
        .select({ id: gigLeads.id, title: gigLeads.title })
        .from(gigLeads)
        .where(and(
          eq(gigLeads.isApproved, false),
          eq(gigLeads.isRejected, false),
          lt(gigLeads.createdAt, seventyTwoHoursAgo),
          or(lt(gigLeads.intentScore, 50), isNull(gigLeads.intentScore))
        ));
      for (const row of toAutoReject) {
        await db.update(gigLeads).set({ isRejected: true }).where(eq(gigLeads.id, row.id));
        console.log("[auto-reject] Rejected stale low-score lead:", row.title ?? "(no title)");
      }
      // Priority queue: intent_score >= 70 first, then by score, then by created
      return await db.select().from(gigLeads)
        .where(and(eq(gigLeads.isApproved, false), eq(gigLeads.isRejected, false)))
        .orderBy(
          desc(sql`CASE WHEN ${gigLeads.intentScore} >= 70 THEN 1 ELSE 0 END`),
          desc(gigLeads.intentScore),
          desc(gigLeads.createdAt)
        );
    }),
    
    getAllLeads: protectedProcedure
      .input(z.object({
        status: z.enum(["all", "approved", "pending", "rejected", "hidden"]).default("all"),
        limit: z.number().default(100),
        performerType: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        if (ctx.user?.role !== 'admin') throw new Error("Unauthorized");
        
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const { gigLeads } = await import("../drizzle/schema");

        /** Explicit columns for admin list only — avoids SELECT * breaking on schema/DB drift. */
        const adminGigLeadListColumns = {
          id: gigLeads.id,
          title: gigLeads.title,
          description: gigLeads.description,
          rawText: gigLeads.rawText,
          publicPreviewDescription: gigLeads.publicPreviewDescription,
          eventType: gigLeads.eventType,
          budget: gigLeads.budget,
          location: gigLeads.location,
          eventDate: gigLeads.eventDate,
          contactName: gigLeads.contactName,
          contactEmail: gigLeads.contactEmail,
          contactPhone: gigLeads.contactPhone,
          venueUrl: gigLeads.venueUrl,
          performerType: gigLeads.performerType,
          leadType: gigLeads.leadType,
          leadCategory: gigLeads.leadCategory,
          leadTier: gigLeads.leadTier,
          status: gigLeads.status,
          notes: gigLeads.notes,
          followUpAt: gigLeads.followUpAt,
          isApproved: gigLeads.isApproved,
          isRejected: gigLeads.isRejected,
          source: gigLeads.source,
          sourceLabel: gigLeads.sourceLabel,
          intentScore: gigLeads.intentScore,
          unlockPriceCents: gigLeads.unlockPriceCents,
          isReserved: gigLeads.isReserved,
          isHidden: gigLeads.isHidden,
          createdAt: gigLeads.createdAt,
        } as const;
        
        const buildWhere = (statusCondition: any) => {
          if (input.performerType) {
            const ptVal = input.performerType as typeof gigLeads.performerType._.data;
          return statusCondition
              ? and(statusCondition, eq(gigLeads.performerType, ptVal))
              : eq(gigLeads.performerType, ptVal);
          }
          return statusCondition;
        };

        const runListQuery = async (statusCondition: any) => {
          const whereClause = buildWhere(statusCondition);
          return db
            .select(adminGigLeadListColumns)
            .from(gigLeads)
            .where(whereClause ?? sql`1=1`)
            .orderBy(desc(gigLeads.createdAt))
            .limit(input.limit);
        };

        try {
          if (input.status === "approved") {
            return await runListQuery(and(eq(gigLeads.isApproved, true), eq(gigLeads.isHidden, false)));
          }
          if (input.status === "pending") {
            return await runListQuery(and(eq(gigLeads.isApproved, false), eq(gigLeads.isRejected, false)));
          }
          if (input.status === "rejected") {
            return await runListQuery(eq(gigLeads.isRejected, true));
          }
          if (input.status === "hidden") {
            return await runListQuery(eq(gigLeads.isHidden, true));
          }
          return await runListQuery(null);
        } catch (err) {
          console.error("[admin.getAllLeads] query failed:", {
            status: input.status,
            limit: input.limit,
            performerType: input.performerType,
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          });
          if (err instanceof TRPCError) throw err;
          const message = err instanceof Error ? err.message : "Failed to load leads";
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message, cause: err });
        }
      }),
    
    approveLead: protectedProcedure
      .input(z.object({ leadId: z.union([z.number(), z.string()]).pipe(z.coerce.number()) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== 'admin') throw new Error("Unauthorized");
        
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const { gigLeads } = await import("../drizzle/schema");
        const { getLeadTypePatchOnApprove } = await import("./marketplaceLeadType");
        const [row] = await db
          .select({
            leadType: gigLeads.leadType,
            leadCategory: gigLeads.leadCategory,
            source: gigLeads.source,
            externalId: gigLeads.externalId,
            description: gigLeads.description,
          })
          .from(gigLeads)
          .where(eq(gigLeads.id, input.leadId))
          .limit(1);
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });

        const typePatch = getLeadTypePatchOnApprove({
          leadType: row.leadType,
          leadCategory: row.leadCategory,
          source: row.source,
          externalId: row.externalId,
          description: row.description,
        });

        await db
          .update(gigLeads)
          .set({ isApproved: true, isRejected: false, ...typePatch })
          .where(eq(gigLeads.id, input.leadId));
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

    /** Route a pending lead: Artist Lead, Venue Intel, Client Request, or Reject. Replaces simple approve/reject. */
    routeLead: protectedProcedure
      .input(z.object({
        leadId: z.union([z.number(), z.string()]).pipe(z.coerce.number()),
        action: z.enum(["artist_lead", "venue_intel", "client_request", "reject"]),
        reason: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new Error("Unauthorized");
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { gigLeads } = await import("../drizzle/schema");
        if (input.action === "reject") {
          await db.update(gigLeads).set({
            isRejected: true,
            isApproved: false,
            rejectionReason: input.reason ?? "Does not meet quality standards",
          }).where(eq(gigLeads.id, input.leadId));
          return { success: true };
        }
        const updates: Record<string, unknown> = {
          isApproved: true,
          isRejected: false,
          rejectionReason: null,
        };
        if (input.action === "artist_lead") {
          updates.leadType = "scraped_signal";
          updates.leadCategory = null;
          updates.artistUnlockEnabled = true;
          updates.leadMonetizationType = "artist_unlock";
        } else if (input.action === "venue_intel") {
          updates.leadType = "venue_intelligence";
          updates.leadCategory = "venue_intelligence";
          updates.artistUnlockEnabled = false;
          updates.leadMonetizationType = "venue_outreach";
        } else if (input.action === "client_request") {
          updates.leadType = "client_submitted";
          updates.leadCategory = null;
          updates.artistUnlockEnabled = true;
          updates.leadMonetizationType = "artist_unlock";
        }
        await db.update(gigLeads).set(updates as any).where(eq(gigLeads.id, input.leadId));
        return { success: true };
      }),

    /** Next venue-intel lead in outreach queue (not_sent, has contactEmail). DBPR / Sunbiz / Google Maps — see scraper-pipeline venue routing. */
    getNextOutreachVenue: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Unauthorized" });
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const { gigLeads } = await import("../drizzle/schema");
      const outreachIntelSources = ["dbpr", "sunbiz", "google_maps"] as const;
      const where = and(
        inArray(gigLeads.source, [...outreachIntelSources]),
        eq(gigLeads.isApproved, true),
        eq(gigLeads.outreachStatus, "not_sent"),
        isNotNull(gigLeads.contactEmail),
        ne(gigLeads.contactEmail, ""),
        or(eq(gigLeads.leadType, "manual_outreach"), eq(gigLeads.leadType, "venue_intelligence"))
      );
      const [countRow] = await db.select({ c: sql<number>`COUNT(*)` }).from(gigLeads).where(where);
      const remainingCount = Number(countRow?.c ?? 0);
      const rows = await db
        .select({
          id: gigLeads.id,
          title: gigLeads.title,
          location: gigLeads.location,
          contactEmail: gigLeads.contactEmail,
          contactPhone: gigLeads.contactPhone,
          venueUrl: gigLeads.venueUrl,
          description: gigLeads.description,
          createdAt: gigLeads.createdAt,
          externalId: gigLeads.externalId,
          contactName: gigLeads.contactName,
        })
        .from(gigLeads)
        .where(where)
        .orderBy(asc(gigLeads.createdAt))
        .limit(1);
      const row = rows[0] ?? null;
      if (!row) return { venue: null, remainingCount: 0 };
      const { renderVenueTemplate } = await import("./outreachVenueTemplate");
      const { subject, body } = renderVenueTemplate(row);
      const venue = { ...row, subject, body };
      return { venue, remainingCount };
    }),

    /** Send outreach email, update lead, log, return next venue. */
    sendOutreachAndAdvance: protectedProcedure
      .input(z.object({
        leadId: z.number(),
        subject: z.string(),
        body: z.string(),
        senderEmail: z.string().default("Gigxo <teryn@gigxo.com>"),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Unauthorized" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { gigLeads, outreachLog } = await import("../drizzle/schema");
        const { sendOutreachEmail } = await import("./email");

        const [lead] = await db.select().from(gigLeads).where(eq(gigLeads.id, input.leadId)).limit(1);
        if (!lead?.contactEmail?.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "Lead has no contact email" });

        const result = await sendOutreachEmail(lead.contactEmail.trim(), input.subject, input.body, input.senderEmail);

        await db.update(gigLeads).set({
          outreachStatus: "sent",
          outreachLastSentAt: new Date(),
          outreachAttemptCount: (lead.outreachAttemptCount ?? 0) + 1,
        }).where(eq(gigLeads.id, input.leadId));

        await db.insert(outreachLog).values({
          leadId: input.leadId,
          recipientEmail: lead.contactEmail.trim(),
          subject: input.subject,
          bodyPreview: input.body.slice(0, 500),
          status: result.success ? "sent" : "failed",
          errorMessage: result.error ?? null,
        });

        if (!result.success) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error ?? "Send failed" });

        const outreachIntelSources = ["dbpr", "sunbiz", "google_maps"] as const;
        const where = and(
          inArray(gigLeads.source, [...outreachIntelSources]),
          eq(gigLeads.isApproved, true),
          eq(gigLeads.outreachStatus, "not_sent"),
          isNotNull(gigLeads.contactEmail),
          ne(gigLeads.contactEmail, ""),
          or(eq(gigLeads.leadType, "manual_outreach"), eq(gigLeads.leadType, "venue_intelligence"))
        );
        const nextRows = await db.select({
          id: gigLeads.id,
          title: gigLeads.title,
          location: gigLeads.location,
          contactEmail: gigLeads.contactEmail,
          contactPhone: gigLeads.contactPhone,
          venueUrl: gigLeads.venueUrl,
          description: gigLeads.description,
          createdAt: gigLeads.createdAt,
          externalId: gigLeads.externalId,
          contactName: gigLeads.contactName,
        }).from(gigLeads).where(where).orderBy(asc(gigLeads.createdAt)).limit(1);
        const nextRow = nextRows[0] ?? null;
        let nextVenue: typeof nextRow & { subject?: string; body?: string } | null = nextRow;
        if (nextRow) {
          const { renderVenueTemplate } = await import("./outreachVenueTemplate");
          const { subject, body } = renderVenueTemplate(nextRow);
          nextVenue = { ...nextRow, subject, body };
        }
        return { success: true, nextVenue };
      }),

    /** Skip this venue (set outreachStatus to not_interested), return next venue. */
    skipOutreachVenue: protectedProcedure
      .input(z.object({ leadId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Unauthorized" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { gigLeads } = await import("../drizzle/schema");
        await db.update(gigLeads).set({ outreachStatus: "not_interested" }).where(eq(gigLeads.id, input.leadId));
        const outreachIntelSources = ["dbpr", "sunbiz", "google_maps"] as const;
        const where = and(
          inArray(gigLeads.source, [...outreachIntelSources]),
          eq(gigLeads.isApproved, true),
          eq(gigLeads.outreachStatus, "not_sent"),
          isNotNull(gigLeads.contactEmail),
          ne(gigLeads.contactEmail, ""),
          or(eq(gigLeads.leadType, "manual_outreach"), eq(gigLeads.leadType, "venue_intelligence"))
        );
        const nextRows = await db.select({
          id: gigLeads.id,
          title: gigLeads.title,
          location: gigLeads.location,
          contactEmail: gigLeads.contactEmail,
          contactPhone: gigLeads.contactPhone,
          venueUrl: gigLeads.venueUrl,
          description: gigLeads.description,
          createdAt: gigLeads.createdAt,
          externalId: gigLeads.externalId,
          contactName: gigLeads.contactName,
        }).from(gigLeads).where(where).orderBy(asc(gigLeads.createdAt)).limit(1);
        const nextRow = nextRows[0] ?? null;
        if (!nextRow) return { nextVenue: null };
        const { renderVenueTemplate } = await import("./outreachVenueTemplate");
        const { subject, body } = renderVenueTemplate(nextRow);
        return { nextVenue: { ...nextRow, subject, body } };
      }),

    /** Remove contact email from venue and return next venue. */
    clearVenueEmailAndAdvance: protectedProcedure
      .input(z.object({ leadId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Unauthorized" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { gigLeads } = await import("../drizzle/schema");
        await db.update(gigLeads).set({ contactEmail: null }).where(eq(gigLeads.id, input.leadId));
        const outreachIntelSources = ["dbpr", "sunbiz", "google_maps"] as const;
        const where = and(
          inArray(gigLeads.source, [...outreachIntelSources]),
          eq(gigLeads.isApproved, true),
          eq(gigLeads.outreachStatus, "not_sent"),
          isNotNull(gigLeads.contactEmail),
          ne(gigLeads.contactEmail, ""),
          or(eq(gigLeads.leadType, "manual_outreach"), eq(gigLeads.leadType, "venue_intelligence"))
        );
        const nextRows = await db.select({
          id: gigLeads.id,
          title: gigLeads.title,
          location: gigLeads.location,
          contactEmail: gigLeads.contactEmail,
          contactPhone: gigLeads.contactPhone,
          venueUrl: gigLeads.venueUrl,
          description: gigLeads.description,
          createdAt: gigLeads.createdAt,
          externalId: gigLeads.externalId,
          contactName: gigLeads.contactName,
        }).from(gigLeads).where(where).orderBy(asc(gigLeads.createdAt)).limit(1);
        const nextRow = nextRows[0] ?? null;
        if (!nextRow) return { nextVenue: null };
        const { renderVenueTemplate } = await import("./outreachVenueTemplate");
        const { subject, body } = renderVenueTemplate(nextRow);
        return { nextVenue: { ...nextRow, subject, body } };
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
      .input(z.object({
        leadId: z.number(),
        priceDollars: z.number().min(1).max(999).optional(),
        clearOverride: z.boolean().optional(),
      }).refine((data) => data.clearOverride === true || (typeof data.priceDollars === "number" && data.priceDollars >= 1), {
        message: "Provide priceDollars (1–999) or clearOverride: true",
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== 'admin') throw new Error("Unauthorized");
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { gigLeads } = await import("../drizzle/schema");
        if (input.clearOverride === true) {
          await db.update(gigLeads).set({ unlockPriceCents: null }).where(eq(gigLeads.id, input.leadId));
        } else {
          await db.update(gigLeads).set({ unlockPriceCents: Math.round((input.priceDollars ?? 7) * 100) }).where(eq(gigLeads.id, input.leadId));
        }
        return { success: true };
      }),

    /** Temporary admin-only: clean invalid unlockPriceCents (set to NULL so tier pricing applies). */
    cleanupLeadPrices: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Unauthorized" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const result = await db.execute(
          sql`UPDATE gigLeads SET unlockPriceCents = NULL WHERE unlockPriceCents IS NOT NULL AND unlockPriceCents NOT IN (300, 700, 1500)`,
        );
        const rowsAffected =
          (Array.isArray(result) && result[0] && typeof (result[0] as any).affectedRows === "number"
            ? (result[0] as any).affectedRows
            : (result as any)?.affectedRows) ?? 0;
        return { success: true, rowsAffected: Number(rowsAffected) };
      }),

    updateLead: protectedProcedure
      .input(z.object({
        leadId: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        publicPreviewDescription: z.string().optional(),
        fullDescription: z.string().optional(),
        location: z.string().optional(),
        eventType: z.string().optional(),
        budget: z.number().optional(),
        eventDate: z.string().optional(),
        contactName: z.string().optional(),
        contactEmail: z.string().optional(),
        contactPhone: z.string().optional(),
        contactedAt: z.string().datetime().optional(),
        leadType: z.string().optional(),
        leadCategory: z.string().optional(),
        status: z.string().optional(),
        notes: z.string().optional(),
        followUpAt: z.string().datetime().optional(),
        leadMonetizationType: z.enum(["artist_unlock", "venue_outreach", "venue_subscription", "direct_client_pipeline"]).optional(),
        outreachStatus: z.enum(["not_sent", "queued", "sent", "replied", "interested", "not_interested", "bounced"]).optional(),
        venueClientStatus: z.enum(["prospect", "contacted", "qualified", "active_client", "archived"]).optional(),
        subscriptionVisibility: z.boolean().optional(),
        regionTag: z.enum(["miami", "fort_lauderdale", "boca", "west_palm", "south_florida", "nationwide"]).optional(),
        artistUnlockEnabled: z.boolean().optional(),
        premiumOnly: z.boolean().optional(),
        outreachNextFollowUpAt: z.date().optional(),
        leadTier: z.enum(["starter_friendly", "standard", "premium"]).nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== 'admin') throw new Error("Unauthorized");
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { gigLeads } = await import("../drizzle/schema");
        
        const updateData: any = {};
        if (input.leadTier !== undefined) updateData.leadTier = input.leadTier;
        if (input.title !== undefined) updateData.title = input.title;
        if (input.description !== undefined) {
          updateData.description = input.description;
          if (input.fullDescription === undefined) updateData.fullDescription = input.description;
        }
        if (input.publicPreviewDescription !== undefined) updateData.publicPreviewDescription = input.publicPreviewDescription || null;
        if (input.fullDescription !== undefined) {
          updateData.fullDescription = input.fullDescription || null;
          if (input.description === undefined) updateData.description = input.fullDescription || null;
        }
        if (input.location !== undefined) updateData.location = input.location;
        if (input.eventType !== undefined) updateData.eventType = input.eventType;
        if (input.budget !== undefined) updateData.budget = Math.round(input.budget * 100);
        if (input.eventDate !== undefined) updateData.eventDate = input.eventDate ? new Date(input.eventDate) : null;
        if (input.contactName !== undefined) updateData.contactName = input.contactName;
        if (input.contactEmail !== undefined) updateData.contactEmail = input.contactEmail;
        if (input.contactPhone !== undefined) updateData.contactPhone = input.contactPhone;
        if (input.contactedAt !== undefined) updateData.contactedAt = input.contactedAt ? new Date(input.contactedAt) : null;
        if (input.leadType !== undefined) updateData.leadType = input.leadType as any;
        if (input.leadCategory !== undefined) updateData.leadCategory = input.leadCategory as any;
        if (input.status !== undefined) updateData.status = input.status || null;
        if (input.notes !== undefined) updateData.notes = input.notes || null;
        if (input.followUpAt !== undefined) updateData.followUpAt = input.followUpAt ? new Date(input.followUpAt) : null;
        if (input.leadMonetizationType !== undefined) updateData.leadMonetizationType = input.leadMonetizationType;
        if (input.outreachStatus !== undefined) updateData.outreachStatus = input.outreachStatus;
        if (input.venueClientStatus !== undefined) updateData.venueClientStatus = input.venueClientStatus;
        if (input.subscriptionVisibility !== undefined) updateData.subscriptionVisibility = input.subscriptionVisibility;
        if (input.regionTag !== undefined) updateData.regionTag = input.regionTag;
        if (input.artistUnlockEnabled !== undefined) updateData.artistUnlockEnabled = input.artistUnlockEnabled;
        if (input.premiumOnly !== undefined) updateData.premiumOnly = input.premiumOnly;
        if (input.outreachNextFollowUpAt !== undefined) updateData.outreachNextFollowUpAt = input.outreachNextFollowUpAt;
        
        await db.update(gigLeads).set(updateData).where(eq(gigLeads.id, input.leadId));
        return { success: true };
      }),


    addManualLead: protectedProcedure
      .input(z.object({
        title: z.string(),
        description: z.string().optional(),
        publicPreviewDescription: z.string().optional(),
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
          fullDescription: input.description,
          publicPreviewDescription: input.publicPreviewDescription || buildPublicPreviewDescription({
            fullDescription: input.description ?? "",
            eventType: input.eventType,
            location: input.location,
            eventDate: input.eventDate,
            performerType: "dj",
          }),
          eventType: input.eventType,
          budget: budgetCents,
          location: input.location,
          eventDate: input.eventDate ? new Date(input.eventDate) : undefined,
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          externalId: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          source: "manual",
          leadType: "client_submitted",
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

    /** List artist profiles for admin control of /artists directory visibility */
    listDirectoryArtistProfiles: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(500).default(250) }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { artistProfiles, users } = await import("../drizzle/schema");
        const lim = input?.limit ?? 250;
        const rows = await db
          .select({
            id: artistProfiles.id,
            userId: artistProfiles.userId,
            slug: artistProfiles.slug,
            djName: artistProfiles.djName,
            location: artistProfiles.location,
            showInDirectory: artistProfiles.showInDirectory,
            directoryFeaturedRank: artistProfiles.directoryFeaturedRank,
            userName: users.name,
            userEmail: users.email,
            userRole: users.role,
          })
          .from(artistProfiles)
          .innerJoin(users, eq(artistProfiles.userId, users.id))
          .where(ne(users.role, "admin"))
          .orderBy(desc(artistProfiles.updatedAt))
          .limit(lim);
        const isSeed = (email: string | null) => (email ?? "").toLowerCase().endsWith("@gigxo.local");
        return rows
          .filter((r) => !isSeed(r.userEmail))
          .map(({ userEmail: _e, userRole: _r, ...rest }) => ({
            ...rest,
            displayName: rest.djName || rest.userName || "Artist",
          }));
      }),

    setArtistShowInDirectory: protectedProcedure
      .input(z.object({ profileId: z.number(), showInDirectory: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { artistProfiles } = await import("../drizzle/schema");
        await db
          .update(artistProfiles)
          .set({ showInDirectory: input.showInDirectory, updatedAt: new Date() })
          .where(eq(artistProfiles.id, input.profileId));
        return { success: true as const };
      }),

    setArtistDirectoryFeaturedRank: protectedProcedure
      .input(
        z.object({
          profileId: z.number(),
          directoryFeaturedRank: z.number().int().min(1).max(999).nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { artistProfiles } = await import("../drizzle/schema");
        await db
          .update(artistProfiles)
          .set({
            directoryFeaturedRank: input.directoryFeaturedRank ?? null,
            updatedAt: new Date(),
          })
          .where(eq(artistProfiles.id, input.profileId));
        return { success: true as const };
      }),

    /** Unified admin command center: business metrics for overview page */
    getAdminOverview: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") throw new Error("Unauthorized");
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { users, gigLeads, transactions, leadUnlocks, subscriptions } = await import("../drizzle/schema");
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);
      const [userAgg] = await db.select({
        total: sql<number>`COUNT(*)`,
        verified: sql<number>`SUM(CASE WHEN ${users.emailVerified} = 1 THEN 1 ELSE 0 END)`,
        signupsToday: sql<number>`SUM(CASE WHEN ${users.createdAt} >= ${startOfToday} THEN 1 ELSE 0 END)`,
        signupsWeek: sql<number>`SUM(CASE WHEN ${users.createdAt} >= ${startOfWeek} THEN 1 ELSE 0 END)`,
      }).from(users);
      const [unlockAgg] = await db.select({
        withUnlocks: sql<number>`COUNT(DISTINCT ${leadUnlocks.userId})`,
      }).from(leadUnlocks);
      const [leadAgg] = await db.select({
        total: sql<number>`COUNT(*)`,
        approved: sql<number>`SUM(CASE WHEN ${gigLeads.isApproved} = 1 THEN 1 ELSE 0 END)`,
        pending: sql<number>`SUM(CASE WHEN ${gigLeads.isApproved} = 0 AND ${gigLeads.isRejected} = 0 THEN 1 ELSE 0 END)`,
      }).from(gigLeads);
      const [revAgg] = await db.select({
        totalCents: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.status} = 'completed' THEN ${transactions.amount} ELSE 0 END), 0)`,
        txCount: sql<number>`COUNT(*)`,
      }).from(transactions);
      const userCount = Number(userAgg?.total ?? 0);
      const revenueCents = Number(revAgg?.totalCents ?? 0);
      const [proCount] = await db.select({
        count: sql<number>`COUNT(DISTINCT ${subscriptions.userId})`,
      }).from(subscriptions).where(and(eq(subscriptions.tier, "premium"), eq(subscriptions.status, "active")));
      return {
        users: {
          total: userCount,
          verified: Number(userAgg?.verified ?? 0),
          withUnlocks: Number(unlockAgg?.withUnlocks ?? 0),
          signupsToday: Number(userAgg?.signupsToday ?? 0),
          signupsWeek: Number(userAgg?.signupsWeek ?? 0),
        },
        revenue: {
          totalDollars: revenueCents / 100,
          avgPerUser: userCount > 0 ? revenueCents / 100 / userCount : 0,
        },
        leads: {
          total: Number(leadAgg?.total ?? 0),
          approved: Number(leadAgg?.approved ?? 0),
          pending: Number(leadAgg?.pending ?? 0),
        },
        proSubscribers: Number(proCount?.count ?? 0),
      };
    }),

    /** Recent signups for admin overview: filter 7d | 30d | all */
    getRecentSignups: protectedProcedure
      .input(z.object({ filter: z.enum(["7d", "30d", "all"]).default("7d") }))
      .query(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new Error("Unauthorized");
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { users, artistProfiles, leadUnlocks, transactions, subscriptions } = await import("../drizzle/schema");
        let since: Date | null = null;
        if (input.filter === "7d") since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        else if (input.filter === "30d") since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const list = since
          ? await db.select({
              id: users.id,
              email: users.email,
              name: users.name,
              createdAt: users.createdAt,
              emailVerified: users.emailVerified,
              city: artistProfiles.location,
              phone: sql<string | null>`NULL`,
            }).from(users)
              .leftJoin(artistProfiles, eq(artistProfiles.userId, users.id))
              .where(gte(users.createdAt, since))
              .orderBy(desc(users.createdAt))
          : await db.select({
              id: users.id,
              email: users.email,
              name: users.name,
              createdAt: users.createdAt,
              emailVerified: users.emailVerified,
              city: artistProfiles.location,
              phone: sql<string | null>`NULL`,
            }).from(users)
              .leftJoin(artistProfiles, eq(artistProfiles.userId, users.id))
              .orderBy(desc(users.createdAt));
        const userIds = list.map((u) => u.id);
        const unlockMap: Record<number, number> = {};
        if (userIds.length > 0) {
          const unlockRows = await db.select({
            userId: leadUnlocks.userId,
            count: sql<number>`COUNT(*)`,
          }).from(leadUnlocks).where(inArray(leadUnlocks.userId, userIds)).groupBy(leadUnlocks.userId);
          unlockRows.forEach((r: any) => { unlockMap[r.userId] = Number(r.count); });
        }
        const spentMap: Record<number, number> = {};
        if (userIds.length > 0) {
          const spentRows = await db.select({
            userId: transactions.userId,
            total: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.status} = 'completed' THEN ${transactions.amount} ELSE 0 END), 0)`,
          }).from(transactions).where(inArray(transactions.userId, userIds)).groupBy(transactions.userId);
          spentRows.forEach((r: any) => { spentMap[r.userId] = Number(r.total ?? 0) / 100; });
        }
        const subRows = await db.select({ userId: subscriptions.userId, tier: subscriptions.tier, status: subscriptions.status })
          .from(subscriptions).where(inArray(subscriptions.userId, userIds));
        const subMap: Record<number, string> = {};
        subRows.forEach((r) => { subMap[r.userId] = r.status === "active" && r.tier === "premium" ? "Pro" : r.tier === "premium" ? "Premium (inactive)" : "Free"; });
        return list.map((u) => ({
          id: u.id,
          email: u.email ?? "",
          name: u.name ?? "",
          joinedAt: u.createdAt,
          phone: u.phone ?? null,
          city: u.city ?? null,
          emailVerified: !!u.emailVerified,
          leadsUnlocked: unlockMap[u.id] ?? 0,
          totalSpentDollars: spentMap[u.id] ?? 0,
          subscriptionStatus: subMap[u.id] ?? "Free",
        }));
      }),

    /** Lead quality snapshot: by source, approved vs pending, contact info, avg intent */
    getLeadQualitySnapshot: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") throw new Error("Unauthorized");
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { gigLeads } = await import("../drizzle/schema");
      const bySource = await db.select({
        source: gigLeads.source,
        count: sql<number>`COUNT(*)`,
      }).from(gigLeads).groupBy(gigLeads.source);
      const [counts] = await db.select({
        approved: sql<number>`SUM(CASE WHEN ${gigLeads.isApproved} = 1 THEN 1 ELSE 0 END)`,
        pending: sql<number>`SUM(CASE WHEN ${gigLeads.isApproved} = 0 AND ${gigLeads.isRejected} = 0 THEN 1 ELSE 0 END)`,
        withContact: sql<number>`SUM(CASE WHEN (${gigLeads.contactEmail} IS NOT NULL AND ${gigLeads.contactEmail} != '') OR (${gigLeads.contactPhone} IS NOT NULL AND ${gigLeads.contactPhone} != '') THEN 1 ELSE 0 END)`,
        total: sql<number>`COUNT(*)`,
        avgIntent: sql<number>`AVG(${gigLeads.intentScore})`,
      }).from(gigLeads);
      return {
        bySource: bySource.map((r) => ({ source: String(r.source), count: Number(r.count) })),
        approved: Number(counts?.approved ?? 0),
        pending: Number(counts?.pending ?? 0),
        withContact: Number(counts?.withContact ?? 0),
        withoutContact: Number(counts?.total ?? 0) - Number(counts?.withContact ?? 0),
        avgIntentScore: counts?.avgIntent != null ? Math.round(Number(counts.avgIntent)) : null,
      };
    }),

    /** Venue intelligence status for admin overview */
    getVenueIntelligenceStatus: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") throw new Error("Unauthorized");
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { gigLeads, outreachLog } = await import("../drizzle/schema");
      const venueCondition = eq(gigLeads.leadType, "venue_intelligence");
      const [totalRow] = await db.select({ count: sql<number>`COUNT(*)` }).from(gigLeads).where(venueCondition);
      const total = Number(totalRow?.count ?? 0);
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - 7);
      const venueIds = await db.select({ id: gigLeads.id }).from(gigLeads).where(venueCondition);
      const ids = venueIds.map((r) => r.id);
      let outreachToday = 0;
      let outreachWeek = 0;
      if (ids.length > 0) {
        const [todayRow] = await db.select({ count: sql<number>`COUNT(*)` }).from(outreachLog).where(and(inArray(outreachLog.leadId, ids), gte(outreachLog.sentAt, startOfToday)));
        const [weekRow] = await db.select({ count: sql<number>`COUNT(*)` }).from(outreachLog).where(and(inArray(outreachLog.leadId, ids), gte(outreachLog.sentAt, startOfWeek)));
        outreachToday = Number(todayRow?.count ?? 0);
        outreachWeek = Number(weekRow?.count ?? 0);
      }
      const [contactRows] = await db.select({
        withEmail: sql<number>`SUM(CASE WHEN (${gigLeads.venueEmail} IS NOT NULL AND ${gigLeads.venueEmail} != '') OR (${gigLeads.contactEmail} IS NOT NULL AND ${gigLeads.contactEmail} != '') THEN 1 ELSE 0 END)`,
        total: sql<number>`COUNT(*)`,
      }).from(gigLeads).where(venueCondition);
      const withEmail = Number(contactRows?.withEmail ?? 0);
      const totalVenue = Number(contactRows?.total ?? 0);
      const replyList = await db.select({
        id: gigLeads.id,
        title: gigLeads.title,
        location: gigLeads.location,
        outreachStatus: gigLeads.outreachStatus,
        outreachLastSentAt: gigLeads.outreachLastSentAt,
      }).from(gigLeads).where(and(venueCondition, inArray(gigLeads.outreachStatus, ["replied", "interested"] as const))).orderBy(desc(gigLeads.outreachLastSentAt)).limit(10);
      return {
        totalDbprVenues: total,
        outreachSentToday: outreachToday,
        outreachSentThisWeek: outreachWeek,
        withContactEmail: withEmail,
        missingContactInfo: totalVenue - withEmail,
        recentReplies: replyList.map((r) => ({
          id: r.id,
          title: r.title,
          location: r.location,
          outreachStatus: r.outreachStatus,
          lastSentAt: r.outreachLastSentAt ?? null,
        })),
      };
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
        try {
          if (ctx.user?.role !== 'admin') throw new Error("Unauthorized");
          const { runScraperPipeline } = await import("./scraper-collectors/scraper-pipeline");
          const { gigLeads } = await import("../drizzle/schema");
          const { getDb } = await import("./db");
          
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          
          // Pass city and performerType from input to scraper pipeline
          const { stats, leads, sourceCounts, apifyCostUsd } = await runScraperPipeline(input?.marketId, input?.focusPerformerType);

        // DBPR leads only enter via admin.runDbprPipeline; skip them here
        const leadsToInsert = leads.filter((l) => l.source !== "dbpr");
        
        let inserted = 0;
        let skipped = 0;
        
        for (const lead of leadsToInsert) {
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
                fullDescription: lead.description,
                publicPreviewDescription: buildPublicPreviewDescription({
                  fullDescription: lead.description ?? "",
                  eventType: lead.eventType,
                  location: lead.location,
                  eventDate: lead.eventDate,
                  performerType: lead.performerType,
                }),
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
            const needsEnrichment = (lead as any).needsEnrichment === true;
            const leadTier = (lead as any).leadTier ?? undefined;
            const { getLeadUnlockPriceCents } = await import("../shared/leadPricing");
            const unlockPriceCents = getLeadUnlockPriceCents(lead.budget, null, leadTier);
            const insertData: any = {
              externalId:    lead.externalId,
              source:        lead.source as any,
              sourceLabel:   lead.sourceLabel ?? null,
              title:         lead.title,
              description:   lead.description,
              rawText:       lead.rawText ?? null,
              fullDescription: lead.description,
              publicPreviewDescription: buildPublicPreviewDescription({
                fullDescription: lead.description ?? "",
                eventType: lead.eventType,
                location: lead.location,
                eventDate: lead.eventDate,
                performerType: lead.performerType,
              }),
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
              leadTier:      leadTier ?? null,
              unlockPriceCents,
              isApproved:    lead.isApproved ?? false,
              isRejected:    false,
              isHidden:      false,
              isReserved:    false,
              notes:         needsEnrichment ? "needs_enrichment" : undefined,
              status:        (lead as any).status ?? undefined,
              regionTag:     (lead as any).regionTag ?? undefined,
            };
            await db.insert(gigLeads).values(insertData);
            inserted++;
            const { logLeadDiscovered } = await import("./leadConversionLog");
            logLeadDiscovered({ lead_source: lead.source, intent_score: lead.intentScore ?? null });
            // Fire-and-forget contact enrichment for new DBPR leads (Google Places), only if high-value venue — unchanged
            if (lead.externalId.startsWith("dbpr-")) {
              const [insertedRow] = await db.select({ id: gigLeads.id }).from(gigLeads).where(eq(gigLeads.externalId, lead.externalId)).limit(1);
              if (insertedRow?.id) {
                const leadId = insertedRow.id;
                const title = lead.title ?? "";
                const location = lead.location ?? "";
                const { shouldEnrichVenue } = await import("./scraper-collectors/contact-enrichment");
                if ((lead as any).status === "manual_review" || !shouldEnrichVenue(lead.title, lead.description, lead.location)) {
                  console.log("[contact-enrichment] Skipped enrichment - non-venue type:", title);
                } else {
                  setImmediate(() => {
                    import("./scraper-collectors/contact-enrichment").then((m) => m.enrichVenueContact(leadId, title, location)).catch(() => {});
                  });
                }
              }
            }
            // Google Maps venue intelligence: same enrichment as DBPR (Google Places + optional website email scrape)
            else if (lead.source === "google_maps") {
              const [insertedRow] = await db.select({ id: gigLeads.id }).from(gigLeads).where(eq(gigLeads.externalId, lead.externalId)).limit(1);
              if (insertedRow?.id) {
                const title = lead.title ?? "";
                const location = lead.location ?? "";
                const { shouldEnrichVenue } = await import("./scraper-collectors/contact-enrichment");
                if ((lead as any).status === "manual_review" || !shouldEnrichVenue(lead.title, lead.description, lead.location)) {
                  console.log("[contact-enrichment] Skipped enrichment - non-venue type:", title);
                } else {
                  setImmediate(() => {
                    import("./scraper-collectors/contact-enrichment").then((m) => m.enrichVenueContact(insertedRow.id, title, location)).catch(() => {});
                  });
                }
              }
            }
            // Tier 2: trigger website email scraper when venueUrl is a real website and shouldEnrichVenue passes
            else if (needsEnrichment && lead.venueUrl?.trim()) {
              const { isRealWebsiteUrl } = await import("./scraper-collectors/scraper-pipeline");
              const venueSrc = (lead as any)._venueUrlSource;
              if (isRealWebsiteUrl(lead.venueUrl, venueSrc)) {
                const [insertedRow] = await db.select({ id: gigLeads.id }).from(gigLeads).where(eq(gigLeads.externalId, lead.externalId)).limit(1);
                if (insertedRow?.id) {
                  const { shouldEnrichVenue } = await import("./scraper-collectors/contact-enrichment");
                  if ((lead as any).status !== "manual_review" && shouldEnrichVenue(lead.title, lead.description, lead.location)) {
                    setImmediate(() => {
                      import("./scraper-collectors/contact-enrichment").then((m) => m.enrichVenueContact(insertedRow.id, lead.title ?? "", lead.location ?? "")).catch(() => {});
                    });
                  }
                }
              }
            }
            // Any lead (non-DBPR) with a real website URL: fire enrichment after insert (Google Places + email scraper)
            if (!lead.externalId.startsWith("dbpr-") && lead.venueUrl?.trim()) {
              const enrichedDomains = ["reddit.com", "facebook.com", "twitter.com", "linkedin.com", "apify.com", "google.com", "duckduckgo.com"];
              const urlLower = lead.venueUrl.toLowerCase();
              const isRealWebsite = !enrichedDomains.some((d) => urlLower.includes(d));
              if (isRealWebsite) {
                const [insertedRow] = await db.select({ id: gigLeads.id }).from(gigLeads).where(eq(gigLeads.externalId, lead.externalId)).limit(1);
                if (insertedRow?.id) {
                  const rawTitle = (lead.title ?? "").trim();
                  const businessName = rawTitle.replace(/\s*[–-]\s*[^–-]+$/, "").trim() || rawTitle;
                  const city = (lead.location ?? "").trim();
                  const { shouldEnrichVenue } = await import("./scraper-collectors/contact-enrichment");
                  if ((lead as any).status !== "manual_review" && shouldEnrichVenue(lead.title, lead.description, lead.location)) {
                    setImmediate(() => {
                      import("./scraper-collectors/contact-enrichment").then((m) => m.enrichVenueContact(insertedRow.id, businessName, city)).catch(() => {});
                    });
                  }
                }
              }
            }
          } catch (err) {
            console.error("[runScraper] Insert error:", lead.externalId, err);
          }
        }
        
        console.log(`[runScraper] Inserted ${inserted} leads, skipped ${skipped} duplicates`);

        const { scraperRuns } = await import("../drizzle/schema");
        const costPerLead =
          inserted > 0 && apifyCostUsd != null && typeof apifyCostUsd === "number"
            ? apifyCostUsd / inserted
            : null;
        await db.insert(scraperRuns).values({
          collected: stats.collected,
          negativeRejected: stats.negativeRejected,
          intentRejected: stats.intentRejected,
          accepted: stats.classified,
          inserted,
          skipped,
          sourceCounts: sourceCounts ?? undefined,
          apifyCostUsd: apifyCostUsd != null ? String(apifyCostUsd) : null,
          leadsInserted: inserted,
          costPerLead: costPerLead != null ? String(costPerLead) : null,
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
        } catch (err) {
          console.error("[runScraper] Full stack trace:", err instanceof Error ? err.stack : String(err));
          throw err;
        }
      }),

    // Run only the DBPR collector and insert venue intelligence leads (isApproved = true)
    runDbprPipeline: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") throw new Error("Unauthorized");
      const { collectFromDbpr } = await import("./scraper-collectors/dbpr-collector");
      const { rawLeadDocToLead } = await import("./scraper-collectors/scraper-pipeline");
      const { gigLeads } = await import("../drizzle/schema");
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const docs = await collectFromDbpr();
      const baseIntentScore = 50;
      const leads = docs.map((doc) => rawLeadDocToLead(doc, baseIntentScore)).filter((l) => l.source === "dbpr");
      let inserted = 0;
      let updated = 0;
      for (const lead of leads) {
        const [existing] = await db.select({ id: gigLeads.id }).from(gigLeads).where(eq(gigLeads.externalId, lead.externalId)).limit(1);
        const preview = buildPublicPreviewDescription({
          fullDescription: lead.description ?? "",
          eventType: lead.eventType,
          location: lead.location,
          eventDate: lead.eventDate,
          performerType: lead.performerType,
        });
        try {
          if (existing) {
            const updateData: Record<string, unknown> = {
              source: lead.source as any,
              sourceLabel: lead.sourceLabel ?? null,
              title: lead.title,
              description: lead.description,
              rawText: lead.rawText ?? null,
              fullDescription: lead.description,
              publicPreviewDescription: preview,
              eventType: lead.eventType,
              budget: lead.budget,
              location: lead.location,
              latitude: lead.latitude ? parseFloat(lead.latitude.toString()) : null,
              longitude: lead.longitude ? parseFloat(lead.longitude.toString()) : null,
              eventDate: lead.eventDate,
              performerType: lead.performerType as any,
              intentScore: lead.intentScore ?? null,
              leadType: (lead as any).leadType ?? undefined,
              leadCategory: (lead as any).leadCategory ?? undefined,
              status: (lead as any).status ?? undefined,
            };
            if (String(lead.contactName ?? "").trim()) updateData.contactName = lead.contactName;
            if (String(lead.contactEmail ?? "").trim()) updateData.contactEmail = lead.contactEmail;
            if (String(lead.contactPhone ?? "").trim()) updateData.contactPhone = lead.contactPhone;
            if (String(lead.venueUrl ?? "").trim()) updateData.venueUrl = lead.venueUrl;
            await db.update(gigLeads).set(updateData as any).where(eq(gigLeads.id, existing.id));
            updated++;
            continue;
          }
          const insertData: any = {
            externalId:    lead.externalId,
            source:        lead.source as any,
            sourceLabel:   lead.sourceLabel ?? null,
            title:         lead.title,
            description:   lead.description,
            rawText:       lead.rawText ?? null,
            fullDescription: lead.description,
            publicPreviewDescription: preview,
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
            status:        (lead as any).status ?? undefined,
            isApproved:    true,
            isRejected:    false,
            isHidden:      false,
            isReserved:    false,
          };
          await db.insert(gigLeads).values(insertData);
          inserted++;
          const { logLeadDiscovered } = await import("./leadConversionLog");
          logLeadDiscovered({ lead_source: lead.source, intent_score: lead.intentScore ?? null });
          const [insertedRow] = await db.select({ id: gigLeads.id }).from(gigLeads).where(eq(gigLeads.externalId, lead.externalId)).limit(1);
          if (insertedRow?.id) {
            const leadId = insertedRow.id;
            const title = lead.title ?? "";
            const location = lead.location ?? "";
            const { shouldEnrichVenue } = await import("./scraper-collectors/contact-enrichment");
            if ((lead as any).status !== "manual_review" && shouldEnrichVenue(lead.title, lead.description, lead.location)) {
              setImmediate(() => {
                import("./scraper-collectors/contact-enrichment").then((m) => m.enrichVenueContact(leadId, title, location)).catch(() => {});
              });
            }
          }
        } catch (err) {
          console.error("[runDbprPipeline] Upsert error:", lead.externalId, err);
        }
      }
      console.log(`[runDbprPipeline] collected ${leads.length} from feed, inserted ${inserted}, updated ${updated}`);
      return { inserted, updated, collected: leads.length };
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
        leadMonetizationType: z.enum(["artist_unlock", "venue_outreach", "venue_subscription", "direct_client_pipeline"]).optional(),
        outreachStatus: z.enum(["not_sent", "queued", "sent", "replied", "interested", "not_interested", "bounced"]).optional(),
        venueClientStatus: z.enum(["prospect", "contacted", "qualified", "active_client", "archived"]).optional(),
        subscriptionVisibility: z.boolean().optional(),
        regionTag: z.enum(["miami", "fort_lauderdale", "boca", "west_palm", "south_florida", "nationwide"]).optional(),
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
        if (typeof input.minIntentScore === "number" && Number.isFinite(input.minIntentScore)) conditions.push(gte(gigLeads.intentScore, input.minIntentScore));
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
        if (input.leadMonetizationType) conditions.push(eq((gigLeads as any).leadMonetizationType, input.leadMonetizationType));
        if (input.outreachStatus) conditions.push(eq((gigLeads as any).outreachStatus, input.outreachStatus));
        if (input.venueClientStatus) conditions.push(eq((gigLeads as any).venueClientStatus, input.venueClientStatus));
        if (input.subscriptionVisibility !== undefined) conditions.push(eq((gigLeads as any).subscriptionVisibility, input.subscriptionVisibility));
        if (input.regionTag) conditions.push(eq((gigLeads as any).regionTag, input.regionTag));
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
          contactedAt: gigLeads.contactedAt,
          status: gigLeads.status,
          notes: gigLeads.notes,
          followUpAt: gigLeads.followUpAt,
          leadMonetizationType: (gigLeads as any).leadMonetizationType,
          outreachStatus: (gigLeads as any).outreachStatus,
          outreachAttemptCount: (gigLeads as any).outreachAttemptCount,
          outreachLastSentAt: (gigLeads as any).outreachLastSentAt,
          venueClientStatus: (gigLeads as any).venueClientStatus,
          subscriptionVisibility: (gigLeads as any).subscriptionVisibility,
          regionTag: (gigLeads as any).regionTag,
          artistUnlockEnabled: (gigLeads as any).artistUnlockEnabled,
          premiumOnly: (gigLeads as any).premiumOnly,
          venueEmail: gigLeads.venueEmail,
          venuePhone: gigLeads.venuePhone,
          externalId: gigLeads.externalId,
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

    // ── Venue Intelligence CRM (admin-only) ─────────────────────────────────────
    getVenueIntelligenceLeads: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
        venueStatus: z.enum(["NEW", "CONTACTED", "FOLLOW_UP", "MEETING", "CLIENT", "IGNORED"]).optional(),
        city: z.string().optional(),
        licenseType: z.string().optional(),
        searchText: z.string().optional(),
        leadMonetizationType: z.enum(["artist_unlock", "venue_outreach", "venue_subscription", "direct_client_pipeline"]).optional(),
        outreachStatus: z.enum(["not_sent", "queued", "sent", "replied", "interested", "not_interested", "bounced"]).optional(),
        venueClientStatus: z.enum(["prospect", "contacted", "qualified", "active_client", "archived"]).optional(),
        subscriptionVisibility: z.boolean().optional(),
        regionTag: z.enum(["miami", "fort_lauderdale", "boca", "west_palm", "south_florida", "nationwide"]).optional(),
      }))
      .query(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { gigLeads } = await import("../drizzle/schema");
        const conditions: any[] = [eq(gigLeads.leadType, "venue_intelligence")];
        if (input.venueStatus) conditions.push(eq(gigLeads.venueStatus, input.venueStatus as any));
        if (input.city?.trim()) conditions.push(like(gigLeads.location, `%${input.city.trim()}%`));
        if (input.licenseType?.trim()) conditions.push(like(gigLeads.externalId, `dbpr-${input.licenseType.trim()}-%`));
        if (input.searchText?.trim()) {
          const term = `%${input.searchText.trim()}%`;
          conditions.push(or(like(gigLeads.title, term), like(gigLeads.location, term))!);
        }
        if (input.leadMonetizationType) conditions.push(eq(gigLeads.leadMonetizationType, input.leadMonetizationType as any));
        if (input.outreachStatus) conditions.push(eq(gigLeads.outreachStatus, input.outreachStatus as any));
        if (input.venueClientStatus) conditions.push(eq(gigLeads.venueClientStatus, input.venueClientStatus as any));
        if (input.subscriptionVisibility !== undefined) conditions.push(eq(gigLeads.subscriptionVisibility, input.subscriptionVisibility));
        if (input.regionTag) conditions.push(eq(gigLeads.regionTag, input.regionTag as any));
        const where = and(...conditions);
        const [totalRow] = await db.select({ count: sql<number>`COUNT(*)` }).from(gigLeads).where(where);
        const total = Number(totalRow?.count ?? 0);
        const items = await db.select({
          id: gigLeads.id,
          externalId: gigLeads.externalId,
          title: gigLeads.title,
          location: gigLeads.location,
          description: gigLeads.description,
          source: gigLeads.source,
          intentScore: gigLeads.intentScore,
          venueStatus: gigLeads.venueStatus,
          lastContactedAt: gigLeads.lastContactedAt,
          contactName: gigLeads.contactName,
          contactEmail: gigLeads.contactEmail,
          contactPhone: gigLeads.contactPhone,
          venueEmail: gigLeads.venueEmail,
          venuePhone: gigLeads.venuePhone,
          venueUrl: gigLeads.venueUrl,
          notes: gigLeads.notes,
          sourceLabel: gigLeads.sourceLabel,
          leadMonetizationType: gigLeads.leadMonetizationType,
          outreachStatus: gigLeads.outreachStatus,
          outreachAttemptCount: gigLeads.outreachAttemptCount,
          outreachLastSentAt: gigLeads.outreachLastSentAt,
          outreachNextFollowUpAt: gigLeads.outreachNextFollowUpAt,
          venueClientStatus: gigLeads.venueClientStatus,
          subscriptionVisibility: gigLeads.subscriptionVisibility,
          regionTag: gigLeads.regionTag,
          artistUnlockEnabled: gigLeads.artistUnlockEnabled,
          premiumOnly: gigLeads.premiumOnly,
        })
          .from(gigLeads)
          .where(where)
          .orderBy(desc(gigLeads.createdAt))
          .limit(input.limit)
          .offset(input.offset);
        return { items, total };
      }),

    updateVenueStatus: protectedProcedure
      .input(z.object({
        leadId: z.number(),
        venueStatus: z.enum(["NEW", "CONTACTED", "FOLLOW_UP", "MEETING", "CLIENT", "IGNORED"]),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { gigLeads } = await import("../drizzle/schema");
        const set: any = { venueStatus: input.venueStatus };
        if (input.venueStatus === "CONTACTED" || input.venueStatus === "FOLLOW_UP") {
          set.lastContactedAt = new Date();
        }
        await db.update(gigLeads).set(set).where(eq(gigLeads.id, input.leadId));
        return { success: true };
      }),

    updateVenueNotes: protectedProcedure
      .input(z.object({ leadId: z.number(), notes: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { gigLeads } = await import("../drizzle/schema");
        await db.update(gigLeads).set({ notes: input.notes }).where(eq(gigLeads.id, input.leadId));
        return { success: true };
      }),

    setLeadMonetization: protectedProcedure
      .input(z.object({
        leadId: z.number(),
        leadMonetizationType: z.enum(["artist_unlock", "venue_outreach", "venue_subscription", "direct_client_pipeline"]).optional(),
        outreachStatus: z.enum(["not_sent", "queued", "sent", "replied", "interested", "not_interested", "bounced"]).optional(),
        venueClientStatus: z.enum(["prospect", "contacted", "qualified", "active_client", "archived"]).optional(),
        subscriptionVisibility: z.boolean().optional(),
        regionTag: z.enum(["miami", "fort_lauderdale", "boca", "west_palm", "south_florida", "nationwide"]).optional(),
        artistUnlockEnabled: z.boolean().optional(),
        premiumOnly: z.boolean().optional(),
        outreachNextFollowUpAt: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { gigLeads } = await import("../drizzle/schema");
        const { leadId, ...rest } = input;
        const set: Record<string, unknown> = {};
        if (rest.leadMonetizationType !== undefined) set.leadMonetizationType = rest.leadMonetizationType;
        if (rest.outreachStatus !== undefined) set.outreachStatus = rest.outreachStatus;
        if (rest.venueClientStatus !== undefined) set.venueClientStatus = rest.venueClientStatus;
        if (rest.subscriptionVisibility !== undefined) set.subscriptionVisibility = rest.subscriptionVisibility;
        if (rest.regionTag !== undefined) set.regionTag = rest.regionTag;
        if (rest.artistUnlockEnabled !== undefined) set.artistUnlockEnabled = rest.artistUnlockEnabled;
        if (rest.premiumOnly !== undefined) set.premiumOnly = rest.premiumOnly;
        if (rest.outreachNextFollowUpAt !== undefined) set.outreachNextFollowUpAt = rest.outreachNextFollowUpAt;
        if (Object.keys(set).length === 0) return { success: true };
        await db.update(gigLeads).set(set as any).where(eq(gigLeads.id, leadId));
        return { success: true };
      }),

    setMonetizationBulk: protectedProcedure
      .input(z.object({
        leadIds: z.array(z.number()).min(1).max(500),
        leadMonetizationType: z.enum(["artist_unlock", "venue_outreach", "venue_subscription", "direct_client_pipeline"]).optional(),
        outreachStatus: z.enum(["not_sent", "queued", "sent", "replied", "interested", "not_interested", "bounced"]).optional(),
        venueClientStatus: z.enum(["prospect", "contacted", "qualified", "active_client", "archived"]).optional(),
        subscriptionVisibility: z.boolean().optional(),
        regionTag: z.enum(["miami", "fort_lauderdale", "boca", "west_palm", "south_florida", "nationwide"]).optional(),
        artistUnlockEnabled: z.boolean().optional(),
        premiumOnly: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { gigLeads } = await import("../drizzle/schema");
        const { leadIds, ...rest } = input;
        const set: Record<string, unknown> = {};
        if (rest.leadMonetizationType !== undefined) set.leadMonetizationType = rest.leadMonetizationType;
        if (rest.outreachStatus !== undefined) set.outreachStatus = rest.outreachStatus;
        if (rest.venueClientStatus !== undefined) set.venueClientStatus = rest.venueClientStatus;
        if (rest.subscriptionVisibility !== undefined) set.subscriptionVisibility = rest.subscriptionVisibility;
        if (rest.regionTag !== undefined) set.regionTag = rest.regionTag;
        if (rest.artistUnlockEnabled !== undefined) set.artistUnlockEnabled = rest.artistUnlockEnabled;
        if (rest.premiumOnly !== undefined) set.premiumOnly = rest.premiumOnly;
        if (Object.keys(set).length === 0) return { updated: 0 };
        await db.update(gigLeads).set(set as any).where(inArray(gigLeads.id, leadIds));
        return { updated: leadIds.length };
      }),

    getOutreachTemplates: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { OUTREACH_TEMPLATES } = await import("./outreachTemplates");
      return OUTREACH_TEMPLATES;
    }),

    sendOutreach: protectedProcedure
      .input(z.object({ leadId: z.number(), templateId: z.enum(["venue_intro", "follow_up", "performer_supply", "venue_outreach", "performer_outreach"]) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { gigLeads, outreachLog } = await import("../drizzle/schema");
        const { getOutreachTemplate, renderOutreachTemplate } = await import("./outreachTemplates");
        const { sendOutreachEmail } = await import("./email");
        const [lead] = await db.select().from(gigLeads).where(eq(gigLeads.id, input.leadId)).limit(1);
        if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
        const email = (lead.venueEmail ?? lead.contactEmail)?.trim() || null;
        if (!email) return { success: false, noOutreachableEmail: true, message: "No outreachable email" };
        const template = getOutreachTemplate(input.templateId);
        if (!template) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid template" });
        const { subject, body } = renderOutreachTemplate(
          template,
          lead.title ?? "Venue",
          lead.location ?? "",
          { ownerName: lead.contactName ?? undefined, platformLink: process.env.APP_URL ?? "https://gigxo.com", link: process.env.APP_URL ? `${process.env.APP_URL}/dashboard` : "https://gigxo.com/dashboard" }
        );
        const result = await sendOutreachEmail(email, subject, body);
        const logStatus = result.success ? "sent" : "failed";
        await db.insert(outreachLog).values({
          leadId: input.leadId,
          templateId: input.templateId,
          recipientEmail: email,
          subject,
          bodyPreview: body.slice(0, 500),
          status: logStatus,
          errorMessage: result.error ?? null,
          sentAt: new Date(),
        });
        if (result.success) {
          const count = (lead.outreachAttemptCount ?? 0) + 1;
          await db.update(gigLeads).set({
            outreachAttemptCount: count,
            outreachLastSentAt: new Date(),
            outreachStatus: "sent",
          }).where(eq(gigLeads.id, input.leadId));
        }
        return { success: result.success, noOutreachableEmail: false, message: result.success ? "Sent" : (result.error ?? "Send failed") };
      }),

    sendOutreachBulk: protectedProcedure
      .input(z.object({
        leadIds: z.array(z.number()).min(1).max(100),
        templateId: z.enum(["venue_intro", "follow_up", "performer_supply", "venue_outreach", "performer_outreach"]),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { gigLeads, outreachLog } = await import("../drizzle/schema");
        const { getOutreachTemplate, renderOutreachTemplate } = await import("./outreachTemplates");
        const { sendOutreachEmail } = await import("./email");
        const template = getOutreachTemplate(input.templateId);
        if (!template) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid template" });
        const leads = await db.select().from(gigLeads).where(inArray(gigLeads.id, input.leadIds));
        const results: { leadId: number; success: boolean; noOutreachableEmail?: boolean; error?: string }[] = [];
        for (const lead of leads) {
          const email = (lead.venueEmail ?? lead.contactEmail)?.trim() || null;
          if (!email) {
            results.push({ leadId: lead.id, success: false, noOutreachableEmail: true });
            continue;
          }
          const { subject, body } = renderOutreachTemplate(
            template,
            lead.title ?? "Venue",
            lead.location ?? "",
            { ownerName: lead.contactName ?? undefined, platformLink: process.env.APP_URL ?? "https://gigxo.com", link: process.env.APP_URL ? `${process.env.APP_URL}/dashboard` : "https://gigxo.com/dashboard" }
          );
          const result = await sendOutreachEmail(email, subject, body);
          const logStatus = result.success ? "sent" : "failed";
          await db.insert(outreachLog).values({
            leadId: lead.id,
            templateId: input.templateId,
            recipientEmail: email,
            subject,
            bodyPreview: body.slice(0, 500),
            status: logStatus,
            errorMessage: result.error ?? null,
            sentAt: new Date(),
          });
          if (result.success) {
            const count = (lead.outreachAttemptCount ?? 0) + 1;
            await db.update(gigLeads).set({
              outreachAttemptCount: count,
              outreachLastSentAt: new Date(),
              outreachStatus: "sent",
            }).where(eq(gigLeads.id, lead.id));
          }
          results.push({ leadId: lead.id, success: result.success, noOutreachableEmail: false, error: result.error });
        }
        return { results };
      }),

    getOutreachLog: protectedProcedure
      .input(z.object({ leadId: z.number(), limit: z.number().min(1).max(50).default(20) }))
      .query(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { outreachLog } = await import("../drizzle/schema");
        return db.select().from(outreachLog).where(eq(outreachLog.leadId, input.leadId)).orderBy(desc(outreachLog.sentAt)).limit(input.limit);
      }),

    scheduleFollowUp: protectedProcedure
      .input(z.object({ leadId: z.number(), scheduledFollowUpAt: z.date() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { gigLeads } = await import("../drizzle/schema");
        await db.update(gigLeads).set({ outreachNextFollowUpAt: input.scheduledFollowUpAt }).where(eq(gigLeads.id, input.leadId));
        return { success: true };
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

    // ── Artist Growth / Outreach (admin: track DJ/artist acquisition, no lead discovery changes) ──
    getArtistOutreachList: protectedProcedure
      .input(z.object({
        city: z.string().optional(),
        genre: z.string().optional(),
        status: z.enum(["new", "contacted", "replied", "joined", "active_buyer", "inactive"]).optional(),
        contactMethod: z.string().optional(),
        activeBuyerOnly: z.boolean().optional(),
        hasInstagram: z.boolean().optional(),
        followerRange: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(500).default(100),
      }))
      .query(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { artistOutreach, leadUnlocks, transactions } = await import("../drizzle/schema");
        const conditions = [];
        if (input.city) conditions.push(eq(artistOutreach.city, input.city));
        if (input.genre) conditions.push(eq(artistOutreach.genre, input.genre));
        if (input.status) conditions.push(eq(artistOutreach.status, input.status));
        if (input.contactMethod) conditions.push(eq(artistOutreach.contactMethod, input.contactMethod));
        if (input.activeBuyerOnly === true) conditions.push(eq(artistOutreach.status, "active_buyer"));
        if (input.hasInstagram === true) conditions.push(sql`${artistOutreach.instagramHandle} IS NOT NULL AND ${artistOutreach.instagramHandle} != ''`);
        if (input.followerRange) conditions.push(eq(artistOutreach.followerRange, input.followerRange));
        if (input.search?.trim()) {
          const term = `%${input.search.trim()}%`;
          conditions.push(or(
            like(artistOutreach.artistName, term),
            like(artistOutreach.instagramHandle, term)
          ) as any);
        }
        const whereClause = conditions.length ? and(...conditions) : undefined;
        const rows = await db.select().from(artistOutreach)
          .where(whereClause)
          .orderBy(desc(artistOutreach.lastContactedAt), desc(artistOutreach.createdAt))
          .limit(input.limit);
        const userIds = [...new Set(rows.map((r) => r.userId).filter((id): id is number => id != null))];
        let unlocksByUser: Record<number, number> = {};
        let revenueByUser: Record<number, number> = {};
        if (userIds.length > 0) {
          const unlockCounts = await db.select({
            userId: leadUnlocks.userId,
            count: sql<number>`COUNT(*)`,
          }).from(leadUnlocks).where(inArray(leadUnlocks.userId, userIds)).groupBy(leadUnlocks.userId);
          unlockCounts.forEach((r) => { unlocksByUser[r.userId] = r.count; });
          const revenueRows = await db.select({
            userId: transactions.userId,
            total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
          }).from(transactions).where(
            and(inArray(transactions.userId, userIds), eq(transactions.status, "completed"), eq(transactions.transactionType, "lead_unlock"))
          ).groupBy(transactions.userId);
          revenueRows.forEach((r) => { revenueByUser[r.userId] = r.total; });
        }
        return rows.map((r) => ({
          ...r,
          leadsUnlocked: r.userId != null ? (unlocksByUser[r.userId] ?? 0) : 0,
          revenueGenerated: r.userId != null ? (revenueByUser[r.userId] ?? 0) / 100 : 0,
        }));
      }),

    getArtistOutreachStats: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const { artistOutreach, transactions } = await import("../drizzle/schema");
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const [contactedToday] = await db.select({
        count: sql<number>`COUNT(*)`,
      }).from(artistOutreach).where(
        gte(sql`COALESCE(${artistOutreach.lastContactedAt}, ${artistOutreach.contactedAt})`, todayStart)
      );
      const [activeBuyers] = await db.select({ count: sql<number>`COUNT(*)` }).from(artistOutreach).where(eq(artistOutreach.status, "active_buyer"));
      const [joinedCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(artistOutreach).where(
        or(eq(artistOutreach.status, "joined"), eq(artistOutreach.status, "active_buyer"))
      );
      const linkedUserIds = await db.select({ userId: artistOutreach.userId }).from(artistOutreach).where(sql`${artistOutreach.userId} IS NOT NULL`);
      const ids = linkedUserIds.map((r) => r.userId).filter((id): id is number => id != null);
      let totalRevenue = 0;
      if (ids.length > 0) {
        const [rev] = await db.select({
          total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
        }).from(transactions).where(
          and(inArray(transactions.userId, ids), eq(transactions.status, "completed"), eq(transactions.transactionType, "lead_unlock"))
        );
        totalRevenue = (rev?.total ?? 0) / 100;
      }
      return {
        artistsContactedToday: contactedToday?.count ?? 0,
        newSignups: joinedCount?.count ?? 0,
        activeBuyers: activeBuyers?.count ?? 0,
        revenueGenerated: totalRevenue,
      };
    }),

    createArtistOutreach: protectedProcedure
      .input(z.object({
        artistName: z.string().min(1),
        instagramHandle: z.string().optional(),
        city: z.string().optional(),
        genre: z.string().optional(),
        contactMethod: z.string().optional(),
        source: z.string().optional(),
        followerRange: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { artistOutreach } = await import("../drizzle/schema");
        await db.insert(artistOutreach).values({
          artistName: input.artistName,
          instagramHandle: input.instagramHandle ?? null,
          city: input.city ?? null,
          genre: input.genre ?? null,
          contactMethod: input.contactMethod ?? null,
          source: input.source ?? null,
          followerRange: input.followerRange ?? null,
          notes: input.notes ?? null,
          status: "new",
        });
        const [row] = await db.select({ id: artistOutreach.id }).from(artistOutreach).orderBy(desc(artistOutreach.id)).limit(1);
        return { id: row?.id };
      }),

    updateArtistOutreachStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["new", "contacted", "replied", "joined", "active_buyer", "inactive"]),
        userId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { artistOutreach } = await import("../drizzle/schema");
        const now = new Date();
        const updates: Record<string, unknown> = { status: input.status, updatedAt: now };
        if (input.status === "contacted" || input.status === "replied") {
          updates.lastContactedAt = now;
          if (input.status === "contacted") updates.contactedAt = (await db.select({ contactedAt: artistOutreach.contactedAt }).from(artistOutreach).where(eq(artistOutreach.id, input.id)).limit(1))[0]?.contactedAt ?? now;
        }
        if (input.status === "joined" || input.status === "active_buyer") updates.joinedAt = (await db.select({ joinedAt: artistOutreach.joinedAt }).from(artistOutreach).where(eq(artistOutreach.id, input.id)).limit(1))[0]?.joinedAt ?? now;
        if (input.userId != null) updates.userId = input.userId;
        await db.update(artistOutreach).set(updates as any).where(eq(artistOutreach.id, input.id));
        return { success: true };
      }),

    updateArtistOutreach: protectedProcedure
      .input(z.object({
        id: z.number(),
        artistName: z.string().min(1).optional(),
        instagramHandle: z.string().optional(),
        city: z.string().optional(),
        genre: z.string().optional(),
        contactMethod: z.string().optional(),
        source: z.string().optional(),
        followerRange: z.string().optional(),
        notes: z.string().optional(),
        userId: z.number().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { artistOutreach } = await import("../drizzle/schema");
        const { id, ...rest } = input;
        const set: Record<string, unknown> = {};
        if (rest.artistName !== undefined) set.artistName = rest.artistName;
        if (rest.instagramHandle !== undefined) set.instagramHandle = rest.instagramHandle;
        if (rest.city !== undefined) set.city = rest.city;
        if (rest.genre !== undefined) set.genre = rest.genre;
        if (rest.contactMethod !== undefined) set.contactMethod = rest.contactMethod;
        if (rest.source !== undefined) set.source = rest.source;
        if (rest.followerRange !== undefined) set.followerRange = rest.followerRange;
        if (rest.notes !== undefined) set.notes = rest.notes;
        if (rest.userId !== undefined) set.userId = rest.userId;
        if (Object.keys(set).length === 0) return { success: true };
        await db.update(artistOutreach).set(set as any).where(eq(artistOutreach.id, id));
        return { success: true };
      }),

    // ── Outreach & lead intelligence (Teryn persona, manual send only) ─────────────
    getOutreachLeads: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(500).default(200) }))
      .query(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { leads } = await import("../drizzle/schema");
        return db.select().from(leads).orderBy(desc(leads.score), desc(leads.createdAt)).limit(input.limit);
      }),

    getOutreachLeadById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { leads } = await import("../drizzle/schema");
        const [row] = await db.select().from(leads).where(eq(leads.id, input.id)).limit(1);
        return row ?? null;
      }),

    createOutreachLead: protectedProcedure
      .input(z.object({
        leadType: z.enum(["venue_new", "venue_existing", "performer"]),
        name: z.string().optional(),
        businessName: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        instagram: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        source: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { leads } = await import("../drizzle/schema");
        const { computeLeadScore } = await import("./services/leadScoring");
        const score = computeLeadScore({
          leadType: input.leadType,
          source: input.source,
          city: input.city,
          state: input.state,
          instagram: input.instagram,
        });
        await db.insert(leads).values({
          leadType: input.leadType,
          name: input.name ?? null,
          businessName: input.businessName ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          instagram: input.instagram ?? null,
          city: input.city ?? null,
          state: input.state ?? null,
          score,
          source: input.source ?? null,
        });
        const [row] = await db.select({ id: leads.id }).from(leads).orderBy(desc(leads.id)).limit(1);
        return { id: row?.id };
      }),

    getLeadOutreachTemplates: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const { templates } = await import("../drizzle/schema");
      return db.select().from(templates).orderBy(desc(templates.createdAt));
    }),

    createLeadOutreachTemplate: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        targetType: z.enum(["venue_new", "venue_existing", "performer"]),
        subjectTemplate: z.string().min(1),
        bodyTemplate: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { templates } = await import("../drizzle/schema");
        await db.insert(templates).values(input);
        const [row] = await db.select({ id: templates.id }).from(templates).orderBy(desc(templates.id)).limit(1);
        return { id: row?.id };
      }),

    updateLeadOutreachTemplate: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        targetType: z.enum(["venue_new", "venue_existing", "performer"]).optional(),
        subjectTemplate: z.string().min(1).optional(),
        bodyTemplate: z.string().min(1).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { templates } = await import("../drizzle/schema");
        const { id, ...rest } = input;
        await db.update(templates).set(rest).where(eq(templates.id, id));
        return { success: true };
      }),

    getMicrosoftInboxStatus: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { getStoredConnection } = await import("./services/microsoftAuth");
      const conn = await getStoredConnection();
      return { connected: !!conn, connectedEmail: conn?.connectedEmail ?? null };
    }),

    previewOutreachEmail: protectedProcedure
      .input(z.object({ leadId: z.number(), templateId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { leads, templates } = await import("../drizzle/schema");
        const [lead] = await db.select().from(leads).where(eq(leads.id, input.leadId)).limit(1);
        const [template] = await db.select().from(templates).where(eq(templates.id, input.templateId)).limit(1);
        if (!lead || !template) throw new TRPCError({ code: "NOT_FOUND", message: "Lead or template not found" });
        const { renderTemplate } = await import("./services/templateRenderer");
        const { subject, body } = renderTemplate(
          { subjectTemplate: template.subjectTemplate, bodyTemplate: template.bodyTemplate },
          { name: lead.name, businessName: lead.businessName, city: lead.city }
        );
        return { subject, body, lead, template };
      }),

    getOutreachMessages: protectedProcedure
      .input(z.object({ limit: z.number().default(50) }))
      .query(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { outreachMessages } = await import("../drizzle/schema");
        return db.select().from(outreachMessages).orderBy(desc(outreachMessages.sentAt)).limit(input.limit);
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
          showInDirectory: artistProfiles.showInDirectory,
          directoryFeaturedRank: artistProfiles.directoryFeaturedRank,
          userName: users.name,
          userEmail: users.email,
          avatarUrl: users.avatarUrl,
          userRole: users.role,
        })
        .from(artistProfiles)
        .innerJoin(users, eq(artistProfiles.userId, users.id));
        const showInDir = (v: unknown) => v === true || v === 1;
        // Filter in JS (small dataset, avoids complex SQL JSON queries))
        let filtered = profiles.filter((p: typeof profiles[number]) => {
          if (!showInDir(p.showInDirectory)) return false;
          if ((p.userEmail ?? "").toLowerCase().endsWith("@gigxo.local")) return false;
          // Exclude only truly empty profiles lacking all key identity/content fields
          if (!p.djName && !p.userName && !p.avatarUrl && !p.bio) return false;

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

        filtered.sort((a, b) => {
          const aN = a.directoryFeaturedRank != null ? Number(a.directoryFeaturedRank) : NaN;
          const bN = b.directoryFeaturedRank != null ? Number(b.directoryFeaturedRank) : NaN;
          const aFeat = Number.isFinite(aN);
          const bFeat = Number.isFinite(bN);
          if (aFeat && !bFeat) return -1;
          if (!aFeat && bFeat) return 1;
          if (aFeat && bFeat && aN !== bN) return aN - bN;
          const nameA = ((a as (typeof profiles)[number]).djName ?? a.userName ?? "").toLowerCase();
          const nameB = ((b as (typeof profiles)[number]).djName ?? b.userName ?? "").toLowerCase();
          return nameA.localeCompare(nameB);
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
          artists: paginated.map(p => {
            const { userEmail: _e, userRole: _r, showInDirectory: _sid, directoryFeaturedRank: _fr, ...rest } = p;
            return {
              ...rest,
              displayName: p.djName || p.userName || "Artist",
              trackCount: trackCounts[p.userId] ?? 0,
              isVerified: !!(p.djName && p.bio && p.photoUrl),
            };
          }),
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
          userEmail: users.email,
        })
        .from(artistProfiles)
        .innerJoin(users, eq(artistProfiles.userId, users.id))
        .where(eq(artistProfiles.slug, input.slug))
        .limit(1);

        if (profiles.length === 0) throw new Error("Artist not found");
        const profile = profiles[0];
        // Exclude seeded/sample performers from public profile pages (same rule as searchArtists)
        if ((profile.userEmail ?? "").toLowerCase().endsWith("@gigxo.local")) throw new Error("Artist not found");

        // Get their tracks
        const tracks = await db.select().from(musicTracks)
          .where(eq(musicTracks.userId, profile.userId))
          .orderBy(musicTracks.sortOrder, musicTracks.createdAt);

        const { userEmail: _email, ...profilePublic } = profile;
        return {
          ...profilePublic,
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
    // Start premium subscription ($49/month, 15 unlocks / billing period, any tier)
    startPremium: protectedProcedure
      .input(z.object({ origin: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { subscriptions } = await import("../drizzle/schema");
        const origin = input.origin ?? process.env.APP_URL?.trim() ?? "https://gigxo.com";
        // Check if Stripe is configured (trim so whitespace-only env doesn't skip demo incorrectly)
        const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
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
        // Real Stripe checkout — $49/month Pro (15 lead unlocks / period, any tier)
        const stripe = (await import("./stripe")).getStripe();
        if (!stripe) {
          console.error("[subscription.startPremium] STRIPE_SECRET_KEY set but getStripe() returned null");
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe is not configured correctly on the server." });
        }
        try {
          const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            payment_method_types: ["card"],
            customer_email: ctx.user.email ?? undefined,
            client_reference_id: ctx.user.id.toString(),
            line_items: [{
              price_data: {
                currency: "usd",
                unit_amount: 4900,
                recurring: { interval: "month" },
                product_data: { name: "Gigxo Pro", description: "5 lead unlocks per month + South Florida Venue Intelligence access" },
              },
              quantity: 1,
            }],
            success_url: `${origin}/dashboard?subscribed=1`,
            cancel_url: `${origin}/dashboard`,
            // Webhook reads user_id or client_reference_id (must match stripeWebhook.ts)
            metadata: { user_id: String(ctx.user.id), userId: String(ctx.user.id) },
          });
          if (!session?.url) {
            console.error("[subscription.startPremium] Stripe returned no session.url", { sessionId: session?.id, userId: ctx.user.id });
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Checkout did not return a redirect URL. Please try again." });
          }
          return { success: true, demo: false, checkoutUrl: session.url };
        } catch (err) {
          if (err instanceof TRPCError) throw err;
          logStripeCheckoutSessionError("subscription.startPremium", err);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: checkoutErrorUserMessage(err, "Could not start checkout. Please try again."),
            cause: err,
          });
        }
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

  // ── South Florida Venue Intelligence (subscription product) ─────────────
  venueIntel: router({
    getSubscriptionEligibility: protectedProcedure.query(async ({ ctx }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return { eligible: false, tier: null };
      const { subscriptions } = await import("../drizzle/schema");
      const rows = await db.select().from(subscriptions).where(eq(subscriptions.userId, ctx.user.id)).limit(1);
      const sub = rows[0] ?? null;
      const now = new Date();
      const active = sub?.tier === "premium" && sub?.status === "active" && sub?.currentPeriodEnd && new Date(sub.currentPeriodEnd) > now;
      return { eligible: !!active, tier: sub?.tier ?? null };
    }),
    getVenues: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        regionTag: z.enum(["miami", "fort_lauderdale", "boca", "west_palm", "south_florida", "nationwide"]).optional(),
        venueClientStatus: z.enum(["prospect", "contacted", "qualified", "active_client", "archived"]).optional(),
        outreachStatus: z.enum(["not_sent", "queued", "sent", "replied", "interested", "not_interested", "bounced"]).optional(),
        minIntentScore: z.number().min(0).max(100).optional(),
        searchText: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { subscriptions, gigLeads } = await import("../drizzle/schema");
        const rows = await db.select().from(subscriptions).where(eq(subscriptions.userId, ctx.user.id)).limit(1);
        const sub = rows[0] ?? null;
        const now = new Date();
        const eligible = sub?.tier === "premium" && sub?.status === "active" && sub?.currentPeriodEnd && new Date(sub.currentPeriodEnd) > now;
        if (!eligible) throw new TRPCError({ code: "FORBIDDEN", message: "Active premium subscription required for South Florida Venue Intelligence" });
        const conditions: any[] = [eq(gigLeads.leadType, "venue_intelligence"), eq(gigLeads.subscriptionVisibility, true)];
        if (input.regionTag) conditions.push(eq(gigLeads.regionTag, input.regionTag as any));
        if (input.venueClientStatus) conditions.push(eq(gigLeads.venueClientStatus, input.venueClientStatus as any));
        if (input.outreachStatus) conditions.push(eq(gigLeads.outreachStatus, input.outreachStatus as any));
        if (typeof input.minIntentScore === "number" && Number.isFinite(input.minIntentScore)) conditions.push(gte(gigLeads.intentScore, input.minIntentScore));
        if (input.searchText?.trim()) {
          const term = `%${input.searchText.trim()}%`;
          conditions.push(or(like(gigLeads.title, term), like(gigLeads.location, term))!);
        }
        const where = and(...conditions);
        const [totalRow] = await db.select({ count: sql<number>`COUNT(*)` }).from(gigLeads).where(where);
        const total = Number(totalRow?.count ?? 0);
        const items = await db.select({
          id: gigLeads.id,
          title: gigLeads.title,
          location: gigLeads.location,
          sourceLabel: gigLeads.sourceLabel,
          leadMonetizationType: gigLeads.leadMonetizationType,
          intentScore: gigLeads.intentScore,
          regionTag: gigLeads.regionTag,
          venueClientStatus: gigLeads.venueClientStatus,
          outreachStatus: gigLeads.outreachStatus,
          lastContactedAt: gigLeads.lastContactedAt,
          venueStatus: gigLeads.venueStatus,
          contactPhone: gigLeads.contactPhone,
        })
          .from(gigLeads)
          .where(where)
          .orderBy(desc(gigLeads.createdAt))
          .limit(input.limit)
          .offset(input.offset);
        return { items, total };
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

    // ─── New SEO Lead Alerts: Notify DJs about fresh auto-published SEO leads ──
    sendNewSeoLeadAlerts: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) return { success: false, leadsAlerted: 0, emailsQueued: 0 };
        const { users, gigLeads, artistProfiles } = await import("../drizzle/schema");
        const { sendNewLeadAlertEmail } = await import("./email");
        const origin = ctx.req.headers.origin ?? "https://gigxo.com";

        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

        // Recent auto-published SEO client leads (standard or premium)
        const recentSeoLeads = await db
          .select()
          .from(gigLeads)
          .where(and(
            eq(gigLeads.source, "gigxo"),
            eq(gigLeads.leadType as any, "client_submitted"),
            eq(gigLeads.isApproved, true),
            eq(gigLeads.artistUnlockEnabled as any, true),
            eq(gigLeads.leadMonetizationType as any, "artist_unlock"),
            sql`${gigLeads.leadTier} IN ('standard','premium')`,
            gte(gigLeads.createdAt, thirtyMinutesAgo),
            eq(gigLeads.isHidden, false),
          ))
          .limit(50);

        if (recentSeoLeads.length === 0) {
          return { success: true, leadsAlerted: 0, emailsQueued: 0 };
        }

        // Lightweight payload preparation with derived sourceSlug when present
        const leadsWithMeta = recentSeoLeads.map((lead: any) => {
          let sourceSlug: string | undefined = (lead as any).sourceSlug;
          const desc: string = typeof lead.description === "string" ? lead.description : "";
          if (!sourceSlug && desc.includes("Source: ")) {
            const sourceLine = desc
              .split("\n")
              .find((line) => line.trim().startsWith("Source: "));
            if (sourceLine) {
              const extracted = sourceLine.replace("Source:", "").trim();
              if (extracted) sourceSlug = extracted;
            }
          }
          return {
            leadId: lead.id,
            title: lead.title,
            location: lead.location,
            leadTier: (lead as any).leadTier as string | null,
            unlockPriceCents: (lead as any).unlockPriceCents as number | null,
            description: desc,
            sourceSlug,
            raw: lead,
          };
        });

        // Load DJs with artist profiles; prefer South Florida by simple location filter
        const artists = await db
          .select({ u: users, p: artistProfiles })
          .from(users)
          .innerJoin(artistProfiles, eq(users.id, artistProfiles.userId))
          .where(eq(users.role, "user"));

        let emailsQueued = 0;
        let leadsAlerted = leadsWithMeta.length;

        for (const { u, p } of artists) {
          if (!u.email) continue;

          const locationText = `${p.location || ""} ${u.location || ""}`.toLowerCase();
          const isSouthFlorida =
            locationText.includes("miami") ||
            locationText.includes("fort lauderdale") ||
            locationText.includes("broward") ||
            locationText.includes("miami-dade") ||
            locationText.includes("south florida");

          // Only target DJs (performerType/genres containing "dj") and South Florida artists
          const genres = ((p.genres as string[]) ?? []).map((g) => g.toLowerCase());
          const isDj =
            genres.some((g) => g.includes("dj")) ||
            (p.primaryTag && (p.primaryTag as string).toLowerCase().includes("dj"));

          if (!isDj || !isSouthFlorida) continue;

          for (const lead of leadsWithMeta) {
            if (!lead) continue;

            const priceDollars =
              lead.unlockPriceCents && lead.unlockPriceCents > 0
                ? lead.unlockPriceCents / 100
                : lead.leadTier === "premium"
                ? 15
                : 7;

            const subject =
              lead.leadTier === "premium"
                ? `New premium yacht DJ lead in ${lead.location} — $${priceDollars} to unlock`
                : `New yacht DJ lead in ${lead.location} — $${priceDollars} to unlock`;

            const summaryLine = (lead.description || "").split("\n")[0] || lead.title;

            await sendNewLeadAlertEmail(
              u.email,
              u.name ?? "",
              1,
              {
                title: lead.title,
                budget: lead.raw.budget,
                location: lead.location,
                eventType: lead.raw.eventType,
              },
              origin,
              {
                subjectOverride: subject,
                extraLines: [
                  `Tier: ${lead.leadTier ?? "standard"} · Unlock price: $${priceDollars}`,
                  summaryLine,
                ],
              } as any,
            );
            emailsQueued++;
          }
        }

        return {
          success: true,
          leadsAlerted,
          emailsQueued,
        };
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
