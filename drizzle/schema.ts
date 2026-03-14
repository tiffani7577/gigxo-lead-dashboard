import { decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean, index, uniqueIndex } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier — kept for backward compat but nullable for email/password users */
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }), // null for OAuth users
  emailVerified: boolean("emailVerified").default(false).notNull(),
  emailVerificationToken: varchar("emailVerificationToken", { length: 255 }),
  emailVerificationExpiry: timestamp("emailVerificationExpiry"),
  googleId: varchar("googleId", { length: 128 }).unique(), // Google OAuth ID
  avatarUrl: varchar("avatarUrl", { length: 2048 }), // Profile photo from Google or upload
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  hasUsedFreeTrial: boolean("hasUsedFreeTrial").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Artist profiles table
export const artistProfiles = mysqlTable("artistProfiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),

  // Core identity
  djName: varchar("djName", { length: 128 }), // legacy stage name
  stageName: varchar("stageName", { length: 128 }), // preferred stage name
  slug: varchar("slug", { length: 128 }).unique(), // URL slug e.g. dj-nova

  // Visuals
  photoUrl: text("photoUrl"), // legacy main photo
  heroImageUrl: text("heroImageUrl"),
  avatarUrl: text("avatarUrl"),

  // Content & metadata
  genres: json("genres").$type<string[]>(), // e.g., ["DJ", "Live Band", "Electronic"]
  location: varchar("location", { length: 255 }).notNull().default("Miami, FL"),
  experienceLevel: mysqlEnum("experienceLevel", ["beginner", "intermediate", "professional", "expert"]).default("intermediate").notNull(),
  minBudget: int("minBudget").default(0).notNull(),
  maxDistance: int("maxDistance").default(30).notNull(),
  equipment: json("equipment").$type<string[]>(), // e.g., ["own_equipment", "needs_rental"]
  bio: text("bio"),
  currentResidencies: json("currentResidencies").$type<string[]>(),

  // Social + media
  soundcloudUrl: text("soundcloudUrl"),
  mixcloudUrl: text("mixcloudUrl"),
  youtubeUrl: text("youtubeUrl"),
  instagramUrl: text("instagramUrl"),
  tiktokUrl: text("tiktokUrl"),
  websiteUrl: text("websiteUrl"),

  // Theming / template
  templateId: varchar("templateId", { length: 64 }).default("default").notNull(),
  themePrimary: varchar("themePrimary", { length: 16 }),
  themeAccent: varchar("themeAccent", { length: 16 }),

  // State flags
  isPublished: boolean("isPublished").default(false).notNull(),
  isClaimed: boolean("isClaimed").default(false).notNull(),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdUnique: uniqueIndex("artistProfiles_userId_unique").on(table.userId),
}));

export type ArtistProfile = typeof artistProfiles.$inferSelect;
export type InsertArtistProfile = typeof artistProfiles.$inferInsert;

// Gig leads table
export const gigLeads = mysqlTable("gigLeads", {
  id: int("id").autoincrement().primaryKey(),
  externalId: varchar("externalId", { length: 255 }).notNull().unique(),
  source: mysqlEnum("source", ["gigxo", "eventbrite", "thumbtack", "yelp", "craigslist", "nextdoor", "facebook", "manual", "gigsalad", "thebash", "weddingwire", "theknot", "inbound", "reddit", "dbpr", "sunbiz"]).notNull(),
  leadType: mysqlEnum("leadType", ["scraped_signal", "client_submitted", "venue_intelligence", "referral", "manual_outreach", "event_demand", "artist_signup", "outreach", "trash", "other"]).default("scraped_signal"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  eventType: varchar("eventType", { length: 100 }),
  budget: int("budget"), // In cents (e.g., 50000 = $500)
  location: varchar("location", { length: 255 }).notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  eventDate: timestamp("eventDate"),
  contactName: varchar("contactName", { length: 255 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactPhone: varchar("contactPhone", { length: 20 }),
  venueUrl: varchar("venueUrl", { length: 2048 }),
  performerType: mysqlEnum("performerType", ["dj", "solo_act", "small_band", "large_band", "singer", "instrumentalist", "immersive_experience", "hybrid_electronic", "photo_video", "photo_booth", "makeup_artist", "emcee", "princess_character", "photographer", "videographer", "audio_engineer", "other"]).default("other"),

  // High-level lead category to keep future segmentation flexible
  leadCategory: mysqlEnum("leadCategory", ["general", "wedding", "corporate", "private_party", "club", "other", "venue_intelligence", "yacht", "unknown"]).default("general"),
  // Lightweight operator pipeline state (separate from approval flags)
  status: varchar("status", { length: 50 }),
  notes: text("notes"),
  followUpAt: timestamp("followUpAt"),
  isApproved: boolean("isApproved").default(false).notNull(),
  isRejected: boolean("isRejected").default(false).notNull(),
  rejectionReason: text("rejectionReason"),
  isHidden: boolean("isHidden").default(false).notNull(), // Admin can toggle off without deleting
  isReserved: boolean("isReserved").default(false).notNull(), // Owner-only, never shown to artists
  unlockPriceCents: int("unlockPriceCents"), // Override price in cents; null = auto-calculated from budget
  contentHash: varchar("contentHash", { length: 64 }), // SHA-256 hash of title+location+month for dedup

  // ── Intelligence Engine Fields ────────────────────────────────────────────
  /** Buyer type: bride, event_planner, venue_manager, corporate, festival, nightclub, university, private */
  buyerType: mysqlEnum("buyerType", ["bride", "event_planner", "venue_manager", "corporate", "festival", "nightclub", "university", "private", "unknown"]).default("unknown"),
  /** Source domain label e.g. "Reddit r/weddingplanning", "Craigslist Miami" */
  sourceLabel: varchar("sourceLabel", { length: 255 }),
  /** Source trust score 0.0–1.0 */
  sourceTrust: decimal("sourceTrust", { precision: 4, scale: 3 }),
  /** Contact quality score 0–100 */
  contactScore: int("contactScore"),
  /** Freshness multiplier 0.0–1.0 applied at display time */
  freshnessScore: decimal("freshnessScore", { precision: 4, scale: 3 }),
  /** AI intent score 0–100 from LLM classification */
  intentScore: int("intentScore"),
  /** Final composite score 0–100 after all multipliers */
  finalScore: int("finalScore"),
  /** Win probability 0.0–1.0 */
  winProbability: decimal("winProbability", { precision: 4, scale: 3 }),
  /** Competition level: low, medium, high */
  competitionLevel: mysqlEnum("competitionLevel", ["low", "medium", "high"]),
  /** Suggested rate range e.g. "$1,200–$1,800" */
  suggestedRate: varchar("suggestedRate", { length: 128 }),
  /** Pitch style hint e.g. "romantic wedding energy" */
  pitchStyle: varchar("pitchStyle", { length: 255 }),
  /** Lead temperature: hot, warm, cold */
  leadTemperature: mysqlEnum("leadTemperature", ["hot", "warm", "cold"]),
  /** Prestige score 0–100 */
  prestigeScore: int("prestigeScore"),
  /** Urgency score 0–100 */
  urgencyScore: int("urgencyScore"),
  /** Budget confidence: low, medium, high */
  budgetConfidence: mysqlEnum("budgetConfidence", ["low", "medium", "high"]),
  /** Evidence snippets for transparency */
  intentEvidence: text("intentEvidence"),
  contactEvidence: text("contactEvidence"),
  eventEvidence: text("eventEvidence"),
  sourceEvidence: text("sourceEvidence"),
  /** Which event window was active when this lead was scraped */
  eventWindowId: int("eventWindowId"),
  /** The keyword that surfaced this lead */
  scrapeKeyword: varchar("scrapeKeyword", { length: 255 }),
  /** Venue type inferred: rooftop, hotel_ballroom, nightclub, outdoor, private_residence, corporate_office, etc. */
  venueType: varchar("venueType", { length: 100 }),
  /** Estimated guest count */
  estimatedGuestCount: int("estimatedGuestCount"),
  /** When operator last used outreach helper (mailto) for this lead */
  contactedAt: timestamp("contactedAt"),

  // ── Venue Intelligence CRM ─────────────────────────────────────────────────
  venueStatus: mysqlEnum("venueStatus", ["NEW", "CONTACTED", "FOLLOW_UP", "MEETING", "CLIENT", "IGNORED"]).default("NEW"),
  lastContactedAt: timestamp("lastContactedAt"),
  contactOwner: varchar("contactOwner", { length: 255 }),
  website: varchar("website", { length: 2048 }),
  instagram: varchar("instagram", { length: 255 }),
  venuePhone: varchar("venuePhone", { length: 32 }),
  venueEmail: varchar("venueEmail", { length: 320 }),

  // ── Monetization Layer (Phase 1) ──────────────────────────────────────────
  leadMonetizationType: mysqlEnum("leadMonetizationType", [
    "artist_unlock",
    "venue_outreach",
    "venue_subscription",
    "direct_client_pipeline",
  ]),
  outreachStatus: mysqlEnum("outreachStatus", [
    "not_sent",
    "queued",
    "sent",
    "replied",
    "interested",
    "not_interested",
    "bounced",
  ])
    .default("not_sent")
    .notNull(),
  outreachAttemptCount: int("outreachAttemptCount").default(0).notNull(),
  outreachLastSentAt: timestamp("outreachLastSentAt"),
  outreachNextFollowUpAt: timestamp("outreachNextFollowUpAt"),
  venueClientStatus: mysqlEnum("venueClientStatus", [
    "prospect",
    "contacted",
    "qualified",
    "active_client",
    "archived",
  ]),
  subscriptionVisibility: boolean("subscriptionVisibility").default(false).notNull(),
  regionTag: mysqlEnum("regionTag", ["miami", "fort_lauderdale", "boca", "west_palm", "south_florida"]),
  /** Admin kill-switch for marketplace unlock flow (default true for backward compat). */
  artistUnlockEnabled: boolean("artistUnlockEnabled").default(true).notNull(),
  /** Admin: restrict unlock to premium subscribers only (default false). */
  premiumOnly: boolean("premiumOnly").default(false).notNull(),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  sourceIdx: index("gigLeads_source_idx").on(table.source),
  externalIdIdx: index("gigLeads_externalId_idx").on(table.externalId),
  isApprovedIdx: index("gigLeads_isApproved_idx").on(table.isApproved),
}));

export type GigLead = typeof gigLeads.$inferSelect;
export type InsertGigLead = typeof gigLeads.$inferInsert;

// Outreach log (admin-controlled, one-click/batch)
export const outreachLog = mysqlTable("outreachLog", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  templateId: varchar("templateId", { length: 64 }),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  subject: varchar("subject", { length: 512 }).notNull(),
  bodyPreview: text("bodyPreview"),
  status: mysqlEnum("status", ["sent", "failed", "bounced"]).notNull(),
  errorMessage: text("errorMessage"),
  scheduledFollowUpAt: timestamp("scheduledFollowUpAt"),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  leadIdIdx: index("outreachLog_leadId_idx").on(table.leadId),
  sentAtIdx: index("outreachLog_sentAt_idx").on(table.sentAt),
}));

export type OutreachLog = typeof outreachLog.$inferSelect;
export type InsertOutreachLog = typeof outreachLog.$inferInsert;

// Artist outreach (admin artist acquisition / growth tracking — separate from lead discovery)
export const artistOutreach = mysqlTable(
  "artistOutreach",
  {
    id: int("id").autoincrement().primaryKey(),
    artistName: varchar("artistName", { length: 255 }).notNull(),
    instagramHandle: varchar("instagramHandle", { length: 255 }),
    city: varchar("city", { length: 255 }),
    genre: varchar("genre", { length: 128 }),
    contactMethod: varchar("contactMethod", { length: 64 }),
    source: varchar("source", { length: 128 }),
    followerRange: varchar("followerRange", { length: 64 }),
    notes: text("notes"),
    contactedAt: timestamp("contactedAt"),
    joinedAt: timestamp("joinedAt"),
    lastContactedAt: timestamp("lastContactedAt"),
    status: mysqlEnum("status", ["new", "contacted", "replied", "joined", "active_buyer", "inactive"]).default("new").notNull(),
    userId: int("userId"), // link to users.id when they sign up — for leads unlocked / revenue
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    statusIdx: index("artistOutreach_status_idx").on(table.status),
    userIdIdx: index("artistOutreach_userId_idx").on(table.userId),
  })
);

export type ArtistOutreach = typeof artistOutreach.$inferSelect;
export type InsertArtistOutreach = typeof artistOutreach.$inferInsert;

// Lead scores table (AI-generated scores for matching)
export const leadScores = mysqlTable("leadScores", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  artistId: int("artistId").notNull(),
  overallScore: int("overallScore").notNull(), // 0-100
  payScore: int("payScore").notNull(),
  locationScore: int("locationScore").notNull(),
  genreScore: int("genreScore").notNull(),
  reputationScore: int("reputationScore").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  leadIdIdx: index("leadScores_leadId_idx").on(table.leadId),
  artistIdIdx: index("leadScores_artistId_idx").on(table.artistId),
  overallScoreIdx: index("leadScores_overallScore_idx").on(table.overallScore),
}));

export type LeadScore = typeof leadScores.$inferSelect;
export type InsertLeadScore = typeof leadScores.$inferInsert;

// Transactions table (for pay-to-unlock)
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  leadId: int("leadId").notNull(),
  amount: int("amount").notNull(), // In cents
  transactionType: mysqlEnum("transactionType", ["lead_unlock", "subscription"]).notNull(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  status: mysqlEnum("status", ["pending", "completed", "failed", "refunded"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("transactions_userId_idx").on(table.userId),
  leadIdIdx: index("transactions_leadId_idx").on(table.leadId),
  statusIdx: index("transactions_status_idx").on(table.status),
}));

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

// Subscriptions table
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }).unique(),
  tier: mysqlEnum("tier", ["free", "premium"]).default("free").notNull(),
  status: mysqlEnum("status", ["active", "canceled", "past_due"]).default("active").notNull(),
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("subscriptions_userId_idx").on(table.userId),
}));

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

// Lead unlocks tracking
export const leadUnlocks = mysqlTable("leadUnlocks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  leadId: int("leadId").notNull(),
  unlockedAt: timestamp("unlockedAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("leadUnlocks_userId_idx").on(table.userId),
  leadIdIdx: index("leadUnlocks_leadId_idx").on(table.leadId),
}));

export type LeadUnlock = typeof leadUnlocks.$inferSelect;
export type InsertLeadUnlock = typeof leadUnlocks.$inferInsert;

// Referrals table
export const referrals = mysqlTable("referrals", {
  id: int("id").autoincrement().primaryKey(),
  referrerId: int("referrerId").notNull(), // user who referred
  referredId: int("referredId").notNull(), // user who signed up
  referralCode: varchar("referralCode", { length: 64 }).notNull(),
  creditAmount: int("creditAmount").default(700).notNull(), // $7 in cents
  creditApplied: boolean("creditApplied").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  referrerIdx: index("referrals_referrerId_idx").on(table.referrerId),
  referredIdx: index("referrals_referredId_idx").on(table.referredId),
}));

export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = typeof referrals.$inferInsert;

// Lead view counts (social proof)
export const leadViews = mysqlTable("leadViews", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  userId: int("userId").notNull(),
  viewedAt: timestamp("viewedAt").defaultNow().notNull(),
}, (table) => ({
  leadIdIdx: index("leadViews_leadId_idx").on(table.leadId),
}));

export type LeadView = typeof leadViews.$inferSelect;
export type InsertLeadView = typeof leadViews.$inferInsert;

// User credits (from referrals)
export const userCredits = mysqlTable("userCredits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  amount: int("amount").notNull(), // In cents
  source: mysqlEnum("source", ["referral", "promo", "refund"]).notNull(),
  referralId: int("referralId"),
  isUsed: boolean("isUsed").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("userCredits_userId_idx").on(table.userId),
}));

export type UserCredit = typeof userCredits.$inferSelect;
export type InsertUserCredit = typeof userCredits.$inferInsert;

// Music tracks uploaded by artists
export const musicTracks = mysqlTable("musicTracks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(), // S3 key
  fileUrl: varchar("fileUrl", { length: 2048 }).notNull(), // CDN URL
  durationSeconds: int("durationSeconds"), // track length in seconds
  fileSizeBytes: int("fileSizeBytes"),
  mimeType: varchar("mimeType", { length: 64 }).default("audio/mpeg").notNull(),
  playCount: int("playCount").default(0).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("musicTracks_userId_idx").on(table.userId),
}));

export type MusicTrack = typeof musicTracks.$inferSelect;
export type InsertMusicTrack = typeof musicTracks.$inferInsert;

// Booking inquiries from public artist profile pages
export const bookingInquiries = mysqlTable("bookingInquiries", {
  id: int("id").autoincrement().primaryKey(),
  artistUserId: int("artistUserId").notNull(), // which artist is being booked
  inquirerName: varchar("inquirerName", { length: 255 }).notNull(),
  inquirerEmail: varchar("inquirerEmail", { length: 320 }).notNull(),
  inquirerPhone: varchar("inquirerPhone", { length: 20 }),
  eventType: varchar("eventType", { length: 100 }),
  eventDate: varchar("eventDate", { length: 64 }),
  eventLocation: varchar("eventLocation", { length: 255 }),
  budget: varchar("budget", { length: 64 }),
  message: text("message"),
  status: mysqlEnum("status", ["new", "read", "replied", "booked", "declined"]).default("new").notNull(),
  artistNotes: text("artistNotes"),
  bookingStage: mysqlEnum("bookingStage", ["inquiry", "confirmed", "completed", "cancelled"]).default("inquiry").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  artistUserIdIdx: index("bookingInquiries_artistUserId_idx").on(table.artistUserId),
}));

export type BookingInquiry = typeof bookingInquiries.$inferSelect;
export type InsertBookingInquiry = typeof bookingInquiries.$inferInsert;

// Password reset tokens
export const passwordResetTokens = mysqlTable("passwordResetTokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  tokenIdx: index("passwordResetTokens_token_idx").on(table.token),
  userIdIdx: index("passwordResetTokens_userId_idx").on(table.userId),
}));

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferSelect;

// In-app notifications
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: varchar("type", { length: 64 }).default("info").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body"),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("notifications_userId_idx").on(table.userId),
  isReadIdx: index("notifications_isRead_idx").on(table.isRead),
}));

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// Owner launch checklist (persistent checkbox state)
export const ownerChecklist = mysqlTable("owner_checklist", {
  id: int("id").autoincrement().primaryKey(),
  itemKey: varchar("item_key", { length: 100 }).notNull().unique(),
  label: varchar("label", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }).default("launch").notNull(),
  isCompleted: boolean("is_completed").default(false).notNull(),
  completedAt: timestamp("completed_at"),
  sortOrder: int("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type OwnerChecklistItem = typeof ownerChecklist.$inferSelect;

// Growth tasks / monetization worksheet
export const growthTasks = mysqlTable("growth_tasks", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }).default("daily").notNull(),
  frequency: varchar("frequency", { length: 50 }).default("daily").notNull(),
  estimatedRevenue: varchar("estimated_revenue", { length: 100 }),
  status: varchar("status", { length: 30 }).default("pending").notNull(),
  notes: text("notes"),
  lastDoneAt: timestamp("last_done_at"),
  sortOrder: int("sort_order").default(0).notNull(),
  isAutomated: boolean("is_automated").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type GrowthTask = typeof growthTasks.$inferSelect;

// Venues (Venue Pro plan)
export const venues = mysqlTable("venues", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  contactName: varchar("contactName", { length: 255 }).notNull(),
  contactEmail: varchar("contactEmail", { length: 320 }).notNull().unique(),
  contactPhone: varchar("contactPhone", { length: 20 }),
  venueType: varchar("venueType", { length: 100 }), // e.g. "Wedding Venue", "Club", "Corporate"
  location: varchar("location", { length: 255 }).default("Miami, FL").notNull(),
  website: varchar("website", { length: 2048 }),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  planStatus: mysqlEnum("planStatus", ["trial", "active", "canceled"]).default("trial").notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  sessionToken: varchar("sessionToken", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  emailIdx: index("venues_email_idx").on(table.contactEmail),
}));

export type Venue = typeof venues.$inferSelect;
export type InsertVenue = typeof venues.$inferInsert;

// Venue gig postings
export const venueGigs = mysqlTable("venueGigs", {
  id: int("id").autoincrement().primaryKey(),
  venueId: int("venueId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  eventType: varchar("eventType", { length: 100 }).notNull(),
  eventDate: timestamp("eventDate"),
  budget: int("budget"), // in cents
  location: varchar("location", { length: 255 }).notNull(),
  description: text("description"),
  genresNeeded: json("genresNeeded").$type<string[]>(),
  status: mysqlEnum("status", ["open", "filled", "cancelled"]).default("open").notNull(),
  isApproved: boolean("isApproved").default(false).notNull(), // admin approves before showing to artists
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  venueIdIdx: index("venueGigs_venueId_idx").on(table.venueId),
  statusIdx: index("venueGigs_status_idx").on(table.status),
}));

export type VenueGig = typeof venueGigs.$inferSelect;
export type InsertVenueGig = typeof venueGigs.$inferInsert;

// AI pitch drafts (AI Booking Agent add-on)
export const aiPitchDrafts = mysqlTable("aiPitchDrafts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  leadId: int("leadId").notNull(),
  pitchText: text("pitchText").notNull(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  isPaid: boolean("isPaid").default(false).notNull(),
  isFree: boolean("isFree").default(false).notNull(), // first pitch is free
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("aiPitchDrafts_userId_idx").on(table.userId),
  leadIdIdx: index("aiPitchDrafts_leadId_idx").on(table.leadId),
}));

export type AiPitchDraft = typeof aiPitchDrafts.$inferSelect;
export type InsertAiPitchDraft = typeof aiPitchDrafts.$inferInsert;

// Daily AI industry news articles
export const newsArticles = mysqlTable("newsArticles", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 512 }).notNull(),
  summary: text("summary").notNull(),
  url: varchar("url", { length: 2048 }),
  source: varchar("source", { length: 255 }),
  category: varchar("category", { length: 64 }).default("music").notNull(), // music, gig-economy, tech, local
  imageUrl: varchar("imageUrl", { length: 2048 }),
  publishedAt: timestamp("publishedAt"),
  digestDate: varchar("digestDate", { length: 10 }).notNull(), // YYYY-MM-DD
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  digestDateIdx: index("newsArticles_digestDate_idx").on(table.digestDate),
  categoryIdx: index("newsArticles_category_idx").on(table.category),
}));

export type NewsArticle = typeof newsArticles.$inferSelect;
export type InsertNewsArticle = typeof newsArticles.$inferInsert;

// Drip email log — tracks which automated drip was sent to which user to prevent duplicates
export const dripEmailLog = mysqlTable("dripEmailLog", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  dripType: mysqlEnum("dripType", ["day3", "day7", "lead_alert", "reengagement"]).notNull(),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
}, (table) => ({
  userDripIdx: index("dripEmailLog_userId_dripType_idx").on(table.userId, table.dripType),
}));
export type DripEmailLog = typeof dripEmailLog.$inferSelect;
export type InsertDripEmailLog = typeof dripEmailLog.$inferInsert;

/**
 * event_window — Internal lead boost engine.
 * Each row represents a major event window for a city/region.
 * The scraper reads this table to:
 *   1. Inject the search_keyword_pack into collectors for that market
 *   2. Multiply the lead intent score by lead_boost_multiplier
 *   3. Surface dynamic filter chips in the artist browse page
 */
export const eventWindows = mysqlTable("event_window", {
  id: int("id").autoincrement().primaryKey(),
  city: varchar("city", { length: 128 }).notNull(), // e.g. "Miami, FL"
  region: varchar("region", { length: 128 }).notNull(), // e.g. "South Florida"
  marketId: varchar("market_id", { length: 64 }).notNull(), // e.g. "miami" — matches scraper market keys
  eventName: varchar("event_name", { length: 255 }).notNull(), // e.g. "Miami Music Week"
  filterLabel: varchar("filter_label", { length: 128 }).notNull(), // Short chip label: "Ultra Miami"
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  /** How many days before startDate the filter chip becomes visible to artists */
  leadDays: int("lead_days").default(90).notNull(),
  /** Multiplier applied to intent score for leads scraped during this window (e.g. 1.4 = 40% boost) */
  leadBoostMultiplier: decimal("lead_boost_multiplier", { precision: 4, scale: 2 }).default("1.00").notNull(),
  /** JSON array of search keywords injected into scraper collectors for this event */
  searchKeywordPack: json("search_keyword_pack").$type<string[]>().notNull(),
  /** Performer types most relevant to this event */
  relevantPerformerTypes: json("relevant_performer_types").$type<string[]>().notNull(),
  /** Whether this window is currently active (admin can override) */
  activeStatus: boolean("active_status").default(true).notNull(),
  /** Year this instance applies to */
  eventYear: int("event_year").notNull(),
  /** Optional notes visible only in admin */
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  marketIdx: index("event_window_market_id_idx").on(table.marketId),
  startDateIdx: index("event_window_start_date_idx").on(table.startDate),
  activeIdx: index("event_window_active_status_idx").on(table.activeStatus),
}));

export type EventWindow = typeof eventWindows.$inferSelect;
export type InsertEventWindow = typeof eventWindows.$inferInsert;

/**
 * leadFeedback — Artist feedback loop after unlocking a lead.
 * Powers the AI scoring model over time.
 */
export const leadFeedback = mysqlTable("leadFeedback", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  leadId: int("leadId").notNull(),
  outcome: mysqlEnum("outcome", ["booked", "no_response", "lost", "price_too_high", "not_relevant"]).notNull(),
  notes: text("notes"),
  rateCharged: int("rateCharged"), // in cents, if booked
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("leadFeedback_userId_idx").on(table.userId),
  leadIdIdx: index("leadFeedback_leadId_idx").on(table.leadId),
}));

export type LeadFeedback = typeof leadFeedback.$inferSelect;
export type InsertLeadFeedback = typeof leadFeedback.$inferInsert;

// ── Scraper Configuration ────────────────────────────────────────────────────
/**
 * scraperSubreddits — Manage which subreddits to scrape
 * Allows admin to add/remove subreddits without code changes
 */
export const scraperSubreddits = mysqlTable("scraperSubreddits", {
  id: int("id").autoincrement().primaryKey(),
  subreddit: varchar("subreddit", { length: 128 }).notNull().unique(),
  cityHint: varchar("cityHint", { length: 255 }), // e.g., "Miami, FL" for r/Miami
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ScraperSubreddit = typeof scraperSubreddits.$inferSelect;
export type InsertScraperSubreddit = typeof scraperSubreddits.$inferInsert;

/**
 * scraperKeywords — Manage keywords to filter for buyer intent
 * Allows admin to add/remove keywords without code changes
 */
export const scraperKeywords = mysqlTable("scraperKeywords", {
  id: int("id").autoincrement().primaryKey(),
  keyword: varchar("keyword", { length: 128 }).notNull().unique(),
  type: mysqlEnum("type", ["seeking", "entertainment"]).notNull(), // "seeking" = "looking for", "entertainment" = "dj", "band", etc
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ScraperKeyword = typeof scraperKeywords.$inferSelect;
export type InsertScraperKeyword = typeof scraperKeywords.$inferInsert;

// ── Admin Leads Explorer & Scraper Run History ────────────────────────────────
/** Log each scraper run for admin run history */
export const scraperRuns = mysqlTable("scraperRuns", {
  id: int("id").autoincrement().primaryKey(),
  collected: int("collected").notNull(),
  negativeRejected: int("negativeRejected").notNull(),
  intentRejected: int("intentRejected").notNull(),
  accepted: int("accepted").notNull(),
  inserted: int("inserted").notNull(),
  skipped: int("skipped").notNull(),
  sourceCounts: json("sourceCounts").$type<Record<string, number>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  createdAtIdx: index("scraperRuns_createdAt_idx").on(table.createdAt),
}));

export type ScraperRun = typeof scraperRuns.$inferSelect;
export type InsertScraperRun = typeof scraperRuns.$inferInsert;

/** Saved filter/search combinations for admin leads explorer */
export const savedSearches = mysqlTable("savedSearches", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  filterJson: json("filterJson").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("savedSearches_userId_idx").on(table.userId),
}));

export type SavedSearch = typeof savedSearches.$inferSelect;
export type InsertSavedSearch = typeof savedSearches.$inferInsert;

/** Phrase sets (include or exclude) for admin phrase management */
export const explorerPhraseSets = mysqlTable("explorerPhraseSets", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  type: mysqlEnum("type", ["include", "exclude"]).notNull(),
  phrases: json("phrases").$type<string[]>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ExplorerPhraseSet = typeof explorerPhraseSets.$inferSelect;
export type InsertExplorerPhraseSet = typeof explorerPhraseSets.$inferInsert;

/** Source toggles for scraper (Reddit, Eventbrite, Craigslist, Facebook placeholder) */
export const explorerSourceToggles = mysqlTable("explorerSourceToggles", {
  id: int("id").autoincrement().primaryKey(),
  sourceKey: varchar("sourceKey", { length: 32 }).notNull().unique(),
  enabled: boolean("enabled").default(true).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ExplorerSourceToggle = typeof explorerSourceToggles.$inferSelect;
export type InsertExplorerSourceToggle = typeof explorerSourceToggles.$inferInsert;

// ─── Outreach & lead intelligence (Teryn persona, manual send only) ─────────────────

/** Outreach leads (venues / performers) for email outreach — separate from gigLeads */
export const leads = mysqlTable(
  "leads",
  {
    id: int("id").autoincrement().primaryKey(),
    leadType: mysqlEnum("leadType", ["venue_new", "venue_existing", "performer"]).notNull(),
    name: varchar("name", { length: 255 }),
    businessName: varchar("businessName", { length: 255 }),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 32 }),
    instagram: varchar("instagram", { length: 255 }),
    city: varchar("city", { length: 128 }),
    state: varchar("state", { length: 64 }),
    score: int("score").default(0).notNull(),
    status: mysqlEnum("status", ["new", "contacted", "replied", "booked"]).default("new").notNull(),
    source: varchar("source", { length: 128 }),
    lastContacted: timestamp("lastContacted"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index("leads_status_idx").on(table.status),
    leadTypeIdx: index("leads_leadType_idx").on(table.leadType),
    scoreIdx: index("leads_score_idx").on(table.score),
  })
);

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

/** Email templates for outreach (variables: {{name}}, {{venue}}, {{city}}) */
export const templates = mysqlTable("templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  targetType: mysqlEnum("targetType", ["venue_new", "venue_existing", "performer"]).notNull(),
  subjectTemplate: text("subjectTemplate").notNull(),
  bodyTemplate: text("bodyTemplate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Template = typeof templates.$inferSelect;
export type InsertTemplate = typeof templates.$inferInsert;

/** Sent outreach emails (logged when admin clicks Send) */
export const outreachMessages = mysqlTable(
  "outreachMessages",
  {
    id: int("id").autoincrement().primaryKey(),
    leadId: int("leadId").notNull(),
    subject: varchar("subject", { length: 512 }).notNull(),
    body: text("body").notNull(),
    templateId: int("templateId"),
    senderName: varchar("senderName", { length: 128 }),
    senderEmail: varchar("senderEmail", { length: 320 }).notNull(),
    provider: varchar("provider", { length: 32 }).default("microsoft").notNull(),
    messageId: varchar("messageId", { length: 255 }),
    sentAt: timestamp("sentAt").defaultNow().notNull(),
    status: varchar("status", { length: 32 }).default("sent").notNull(),
  },
  (table) => ({
    leadIdIdx: index("outreachMessages_leadId_idx").on(table.leadId),
    sentAtIdx: index("outreachMessages_sentAt_idx").on(table.sentAt),
  })
);

export type OutreachMessage = typeof outreachMessages.$inferSelect;
export type InsertOutreachMessage = typeof outreachMessages.$inferInsert;

/** Microsoft inbox connection for sending as teryn@gigxo.com */
export const microsoftInboxConnection = mysqlTable("microsoftInboxConnection", {
  id: int("id").autoincrement().primaryKey(),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken"),
  expiresAt: timestamp("expiresAt").notNull(),
  connectedEmail: varchar("connectedEmail", { length: 320 }).notNull(),
  provider: varchar("provider", { length: 32 }).default("microsoft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MicrosoftInboxConnection = typeof microsoftInboxConnection.$inferSelect;
export type InsertMicrosoftInboxConnection = typeof microsoftInboxConnection.$inferInsert;
