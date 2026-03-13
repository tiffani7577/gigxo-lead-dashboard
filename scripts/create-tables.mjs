import "dotenv/config";
import pg from "pg";

// Allow self-signed / Supabase certificates in local dev
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const { Pool } = pg;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set in .env");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  const client = await pool.connect();

  const statements = [
    // ── Enum types ────────────────────────────────────────────────────────────
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role') THEN
         CREATE TYPE role AS ENUM ('user', 'admin');
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'experiencelevel') THEN
         CREATE TYPE "experienceLevel" AS ENUM ('beginner', 'intermediate', 'professional', 'expert');
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'source') THEN
         CREATE TYPE source AS ENUM ('gigxo','eventbrite','thumbtack','yelp','craigslist','nextdoor','facebook','manual','gigsalad','thebash','weddingwire','theknot','inbound','reddit');
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'performertype') THEN
         CREATE TYPE "performerType" AS ENUM ('dj','solo_act','small_band','large_band','singer','instrumentalist','immersive_experience','hybrid_electronic','photo_video','photo_booth','makeup_artist','emcee','princess_character','photographer','videographer','audio_engineer','other');
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'buyertype') THEN
         CREATE TYPE "buyerType" AS ENUM ('bride','event_planner','venue_manager','corporate','festival','nightclub','university','private','unknown');
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'competitionlevel') THEN
         CREATE TYPE "competitionLevel" AS ENUM ('low','medium','high');
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leadtemperature') THEN
         CREATE TYPE "leadTemperature" AS ENUM ('hot','warm','cold');
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'budgetconfidence') THEN
         CREATE TYPE "budgetConfidence" AS ENUM ('low','medium','high');
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transactiontype') THEN
         CREATE TYPE "transactionType" AS ENUM ('lead_unlock','subscription');
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transactionstatus') THEN
         CREATE TYPE "transactionStatus" AS ENUM ('pending','completed','failed','refunded');
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscriptiontier') THEN
         CREATE TYPE "subscriptionTier" AS ENUM ('free','premium');
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscriptionstatus') THEN
         CREATE TYPE "subscriptionStatus" AS ENUM ('active','canceled','past_due');
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'creditsource') THEN
         CREATE TYPE "creditSource" AS ENUM ('referral','promo','refund');
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inquirystatus') THEN
         CREATE TYPE "inquiryStatus" AS ENUM ('new','read','replied','booked','declined');
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bookingstage') THEN
         CREATE TYPE "bookingStage" AS ENUM ('inquiry','confirmed','completed','cancelled');
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'planstatus') THEN
         CREATE TYPE "planStatus" AS ENUM ('trial','active','canceled');
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'venuegigstatus') THEN
         CREATE TYPE "venueGigStatus" AS ENUM ('open','filled','cancelled');
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'driptype') THEN
         CREATE TYPE "dripType" AS ENUM ('day3','day7','lead_alert','reengagement');
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outcome') THEN
         CREATE TYPE "outcome" AS ENUM ('booked','no_response','lost','price_too_high','not_relevant');
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scraperkeywordtype') THEN
         CREATE TYPE "scraperKeywordType" AS ENUM ('seeking','entertainment');
       END IF;
     END $$;`,

    // ── Tables ────────────────────────────────────────────────────────────────

    // users
    `CREATE TABLE IF NOT EXISTS "users" (
       "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       "openId" varchar(64) UNIQUE,
       "name" text,
       "email" varchar(320) UNIQUE,
       "passwordHash" varchar(255),
       "emailVerified" boolean NOT NULL DEFAULT false,
       "emailVerificationToken" varchar(255),
       "emailVerificationExpiry" timestamp,
       "googleId" varchar(128) UNIQUE,
       "avatarUrl" varchar(2048),
       "loginMethod" varchar(64),
       "role" "role" NOT NULL DEFAULT 'user',
       "hasUsedFreeTrial" boolean NOT NULL DEFAULT false,
       "createdAt" timestamp NOT NULL DEFAULT now(),
       "updatedAt" timestamp NOT NULL DEFAULT now(),
       "lastSignedIn" timestamp NOT NULL DEFAULT now()
     );`,

    // artistProfiles
    `CREATE TABLE IF NOT EXISTS "artistProfiles" (
       "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       "userId" integer NOT NULL,
       "djName" varchar(128),
       "slug" varchar(128) UNIQUE,
       "photoUrl" varchar(2048),
       "genres" jsonb,
       "location" varchar(255) NOT NULL DEFAULT 'Miami, FL',
       "experienceLevel" "experienceLevel" NOT NULL DEFAULT 'intermediate',
       "minBudget" integer NOT NULL DEFAULT 0,
       "maxDistance" integer NOT NULL DEFAULT 30,
       "equipment" jsonb,
       "bio" text,
       "soundcloudUrl" varchar(2048),
       "mixcloudUrl" varchar(2048),
       "createdAt" timestamp NOT NULL DEFAULT now(),
       "updatedAt" timestamp NOT NULL DEFAULT now()
     );`,
    `CREATE INDEX IF NOT EXISTS "artistProfiles_userId_idx" ON "artistProfiles" ("userId");`,

    // gigLeads
    `CREATE TABLE IF NOT EXISTS "gigLeads" (
       "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       "externalId" varchar(255) NOT NULL UNIQUE,
       "source" "source" NOT NULL,
       "title" varchar(255) NOT NULL,
       "description" text,
       "eventType" varchar(100),
       "budget" integer,
       "location" varchar(255) NOT NULL,
       "latitude" numeric(10,8),
       "longitude" numeric(11,8),
       "eventDate" timestamp,
       "contactName" varchar(255),
       "contactEmail" varchar(320),
       "contactPhone" varchar(20),
       "venueUrl" varchar(2048),
       "performerType" "performerType" NOT NULL DEFAULT 'other',
       "isApproved" boolean NOT NULL DEFAULT false,
       "isRejected" boolean NOT NULL DEFAULT false,
       "rejectionReason" text,
       "isHidden" boolean NOT NULL DEFAULT false,
       "isReserved" boolean NOT NULL DEFAULT false,
       "unlockPriceCents" integer,
       "contentHash" varchar(64),
       "buyerType" "buyerType" NOT NULL DEFAULT 'unknown',
       "sourceLabel" varchar(255),
       "sourceTrust" numeric(4,3),
       "contactScore" integer,
       "freshnessScore" numeric(4,3),
       "intentScore" integer,
       "finalScore" integer,
       "winProbability" numeric(4,3),
       "competitionLevel" "competitionLevel",
       "suggestedRate" varchar(128),
       "pitchStyle" varchar(255),
       "leadTemperature" "leadTemperature",
       "prestigeScore" integer,
       "urgencyScore" integer,
       "budgetConfidence" "budgetConfidence",
       "intentEvidence" text,
       "contactEvidence" text,
       "eventEvidence" text,
       "sourceEvidence" text,
       "eventWindowId" integer,
       "scrapeKeyword" varchar(255),
       "venueType" varchar(100),
       "estimatedGuestCount" integer,
       "createdAt" timestamp NOT NULL DEFAULT now(),
       "updatedAt" timestamp NOT NULL DEFAULT now()
     );`,
    `CREATE INDEX IF NOT EXISTS "gigLeads_source_idx" ON "gigLeads" ("source");`,
    `CREATE INDEX IF NOT EXISTS "gigLeads_externalId_idx" ON "gigLeads" ("externalId");`,
    `CREATE INDEX IF NOT EXISTS "gigLeads_isApproved_idx" ON "gigLeads" ("isApproved");`,

    // leadScores
    `CREATE TABLE IF NOT EXISTS "leadScores" (
       "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       "leadId" integer NOT NULL,
       "artistId" integer NOT NULL,
       "overallScore" integer NOT NULL,
       "payScore" integer NOT NULL,
       "locationScore" integer NOT NULL,
       "genreScore" integer NOT NULL,
       "reputationScore" integer NOT NULL,
       "createdAt" timestamp NOT NULL DEFAULT now()
     );`,
    `CREATE INDEX IF NOT EXISTS "leadScores_leadId_idx" ON "leadScores" ("leadId");`,
    `CREATE INDEX IF NOT EXISTS "leadScores_artistId_idx" ON "leadScores" ("artistId");`,
    `CREATE INDEX IF NOT EXISTS "leadScores_overallScore_idx" ON "leadScores" ("overallScore");`,

    // transactions
    `CREATE TABLE IF NOT EXISTS "transactions" (
       "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       "userId" integer NOT NULL,
       "leadId" integer NOT NULL,
       "amount" integer NOT NULL,
       "transactionType" "transactionType" NOT NULL,
       "stripePaymentIntentId" varchar(255),
       "status" "transactionStatus" NOT NULL DEFAULT 'pending',
       "createdAt" timestamp NOT NULL DEFAULT now(),
       "updatedAt" timestamp NOT NULL DEFAULT now()
     );`,
    `CREATE INDEX IF NOT EXISTS "transactions_userId_idx" ON "transactions" ("userId");`,
    `CREATE INDEX IF NOT EXISTS "transactions_leadId_idx" ON "transactions" ("leadId");`,
    `CREATE INDEX IF NOT EXISTS "transactions_status_idx" ON "transactions" ("status");`,

    // subscriptions
    `CREATE TABLE IF NOT EXISTS "subscriptions" (
       "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       "userId" integer NOT NULL,
       "stripeSubscriptionId" varchar(255) UNIQUE,
       "tier" "subscriptionTier" NOT NULL DEFAULT 'free',
       "status" "subscriptionStatus" NOT NULL DEFAULT 'active',
       "currentPeriodStart" timestamp,
       "currentPeriodEnd" timestamp,
       "createdAt" timestamp NOT NULL DEFAULT now(),
       "updatedAt" timestamp NOT NULL DEFAULT now()
     );`,
    `CREATE INDEX IF NOT EXISTS "subscriptions_userId_idx" ON "subscriptions" ("userId");`,

    // leadUnlocks
    `CREATE TABLE IF NOT EXISTS "leadUnlocks" (
       "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       "userId" integer NOT NULL,
       "leadId" integer NOT NULL,
       "unlockedAt" timestamp NOT NULL DEFAULT now()
     );`,
    `CREATE INDEX IF NOT EXISTS "leadUnlocks_userId_idx" ON "leadUnlocks" ("userId");`,
    `CREATE INDEX IF NOT EXISTS "leadUnlocks_leadId_idx" ON "leadUnlocks" ("leadId");`,

    // referrals
    `CREATE TABLE IF NOT EXISTS "referrals" (
       "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       "referrerId" integer NOT NULL,
       "referredId" integer NOT NULL,
       "referralCode" varchar(64) NOT NULL,
       "creditAmount" integer NOT NULL DEFAULT 700,
       "creditApplied" boolean NOT NULL DEFAULT false,
       "createdAt" timestamp NOT NULL DEFAULT now()
     );`,
    `CREATE INDEX IF NOT EXISTS "referrals_referrerId_idx" ON "referrals" ("referrerId");`,
    `CREATE INDEX IF NOT EXISTS "referrals_referredId_idx" ON "referrals" ("referredId");`,

    // leadViews
    `CREATE TABLE IF NOT EXISTS "leadViews" (
       "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       "leadId" integer NOT NULL,
       "userId" integer NOT NULL,
       "viewedAt" timestamp NOT NULL DEFAULT now()
     );`,
    `CREATE INDEX IF NOT EXISTS "leadViews_leadId_idx" ON "leadViews" ("leadId");`,

    // userCredits
    `CREATE TABLE IF NOT EXISTS "userCredits" (
       "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       "userId" integer NOT NULL,
       "amount" integer NOT NULL,
       "source" "creditSource" NOT NULL,
       "referralId" integer,
       "isUsed" boolean NOT NULL DEFAULT false,
       "createdAt" timestamp NOT NULL DEFAULT now()
     );`,
    `CREATE INDEX IF NOT EXISTS "userCredits_userId_idx" ON "userCredits" ("userId");`,

    // musicTracks
    `CREATE TABLE IF NOT EXISTS "musicTracks" (
       "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       "userId" integer NOT NULL,
       "title" varchar(255) NOT NULL,
       "fileKey" varchar(512) NOT NULL,
       "fileUrl" varchar(2048) NOT NULL,
       "durationSeconds" integer,
       "fileSizeBytes" integer,
       "mimeType" varchar(64) NOT NULL DEFAULT 'audio/mpeg',
       "playCount" integer NOT NULL DEFAULT 0,
       "sortOrder" integer NOT NULL DEFAULT 0,
       "createdAt" timestamp NOT NULL DEFAULT now()
     );`,
    `CREATE INDEX IF NOT EXISTS "musicTracks_userId_idx" ON "musicTracks" ("userId");`,

    // bookingInquiries
    `CREATE TABLE IF NOT EXISTS "bookingInquiries" (
       "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       "artistUserId" integer NOT NULL,
       "inquirerName" varchar(255) NOT NULL,
       "inquirerEmail" varchar(320) NOT NULL,
       "inquirerPhone" varchar(20),
       "eventType" varchar(100),
       "eventDate" varchar(64),
       "eventLocation" varchar(255),
       "budget" varchar(64),
       "message" text,
       "status" "inquiryStatus" NOT NULL DEFAULT 'new',
       "artistNotes" text,
       "bookingStage" "bookingStage" NOT NULL DEFAULT 'inquiry',
       "createdAt" timestamp NOT NULL DEFAULT now()
     );`,
    `CREATE INDEX IF NOT EXISTS "bookingInquiries_artistUserId_idx" ON "bookingInquiries" ("artistUserId");`,

    // passwordResetTokens
    `CREATE TABLE IF NOT EXISTS "passwordResetTokens" (
       "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       "userId" integer NOT NULL,
       "token" varchar(255) NOT NULL UNIQUE,
       "expiresAt" timestamp NOT NULL,
       "usedAt" timestamp,
       "createdAt" timestamp NOT NULL DEFAULT now()
     );`,
    `CREATE INDEX IF NOT EXISTS "passwordResetTokens_token_idx" ON "passwordResetTokens" ("token");`,
    `CREATE INDEX IF NOT EXISTS "passwordResetTokens_userId_idx" ON "passwordResetTokens" ("userId");`,

    // notifications
    `CREATE TABLE IF NOT EXISTS "notifications" (
       "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       "userId" integer NOT NULL,
       "type" varchar(64) NOT NULL DEFAULT 'info',
       "title" varchar(255) NOT NULL,
       "body" text,
       "isRead" boolean NOT NULL DEFAULT false,
       "createdAt" timestamp NOT NULL DEFAULT now()
     );`,
    `CREATE INDEX IF NOT EXISTS "notifications_userId_idx" ON "notifications" ("userId");`,
    `CREATE INDEX IF NOT EXISTS "notifications_isRead_idx" ON "notifications" ("isRead");`,

    // ownerChecklist
    `CREATE TABLE IF NOT EXISTS "owner_checklist" (
       "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       "item_key" varchar(100) NOT NULL UNIQUE,
       "label" varchar(255) NOT NULL,
       "description" text,
       "category" varchar(50) NOT NULL DEFAULT 'launch',
       "is_completed" boolean NOT NULL DEFAULT false,
       "completed_at" timestamp,
       "sort_order" integer NOT NULL DEFAULT 0,
       "created_at" timestamp NOT NULL DEFAULT now()
     );`,

    // growthTasks
    `CREATE TABLE IF NOT EXISTS "growth_tasks" (
       "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       "title" varchar(255) NOT NULL,
       "description" text,
       "category" varchar(50) NOT NULL DEFAULT 'daily',
       "frequency" varchar(50) NOT NULL DEFAULT 'daily',
       "estimated_revenue" varchar(100),
       "status" varchar(30) NOT NULL DEFAULT 'pending',
       "notes" text,
       "last_done_at" timestamp,
       "sort_order" integer NOT NULL DEFAULT 0,
       "is_automated" boolean NOT NULL DEFAULT false,
       "created_at" timestamp NOT NULL DEFAULT now()
     );`,

    // venues
    `CREATE TABLE IF NOT EXISTS "venues" (
       "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       "name" varchar(255) NOT NULL,
       "contactName" varchar(255) NOT NULL,
       "contactEmail" varchar(320) NOT NULL UNIQUE,
       "contactPhone" varchar(20),
       "venueType" varchar(100),
       "location" varchar(255) NOT NULL DEFAULT 'Miami, FL',
       "website" varchar(2048),
       "stripeCustomerId" varchar(255),
       "stripeSubscriptionId" varchar(255),
       "planStatus" "planStatus" NOT NULL DEFAULT 'trial',
       "passwordHash" varchar(255),
       "sessionToken" varchar(255),
       "createdAt" timestamp NOT NULL DEFAULT now()
     );`,
    `CREATE INDEX IF NOT EXISTS "venues_email_idx" ON "venues" ("contactEmail");`,

    // venueGigs
    `CREATE TABLE IF NOT EXISTS "venueGigs" (
       "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       "venueId" integer NOT NULL,
       "title" varchar(255) NOT NULL,
       "eventType" varchar(100) NOT NULL,
       "eventDate" timestamp,
       "budget" integer,
       "location" varchar(255) NOT NULL,
       "description" text,
       "genresNeeded" jsonb,
       "status" "venueGigStatus" NOT NULL DEFAULT 'open',
       "isApproved" boolean NOT NULL DEFAULT false,
       "createdAt" timestamp NOT NULL DEFAULT now(),
       "updatedAt" timestamp NOT NULL DEFAULT now()
     );`,
    `CREATE INDEX IF NOT EXISTS "venueGigs_venueId_idx" ON "venueGigs" ("venueId");`,
    `CREATE INDEX IF NOT EXISTS "venueGigs_status_idx" ON "venueGigs" ("status");`,

    // aiPitchDrafts
    `CREATE TABLE IF NOT EXISTS "aiPitchDrafts" (
       "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       "userId" integer NOT NULL,
       "leadId" integer NOT NULL,
       "pitchText" text NOT NULL,
       "stripePaymentIntentId" varchar(255),
       "isPaid" boolean NOT NULL DEFAULT false,
       "isFree" boolean NOT NULL DEFAULT false,
       "createdAt" timestamp NOT NULL DEFAULT now()
     );`,
    `CREATE INDEX IF NOT EXISTS "aiPitchDrafts_userId_idx" ON "aiPitchDrafts" ("userId");`,
    `CREATE INDEX IF NOT EXISTS "aiPitchDrafts_leadId_idx" ON "aiPitchDrafts" ("leadId");`,

    // newsArticles
    `CREATE TABLE IF NOT EXISTS "newsArticles" (
       "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       "title" varchar(512) NOT NULL,
       "summary" text NOT NULL,
       "url" varchar(2048),
       "source" varchar(255),
       "category" varchar(64) NOT NULL DEFAULT 'music',
       "imageUrl" varchar(2048),
       "publishedAt" timestamp,
       "digestDate" varchar(10) NOT NULL,
       "createdAt" timestamp NOT NULL DEFAULT now()
     );`,
    `CREATE INDEX IF NOT EXISTS "newsArticles_digestDate_idx" ON "newsArticles" ("digestDate");`,
    `CREATE INDEX IF NOT EXISTS "newsArticles_category_idx" ON "newsArticles" ("category");`,

    // dripEmailLog
    `CREATE TABLE IF NOT EXISTS "dripEmailLog" (
       "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       "userId" integer NOT NULL,
       "dripType" "dripType" NOT NULL,
       "sentAt" timestamp NOT NULL DEFAULT now()
     );`,
    `CREATE INDEX IF NOT EXISTS "dripEmailLog_userId_dripType_idx" ON "dripEmailLog" ("userId","dripType");`,

    // eventWindows
    `CREATE TABLE IF NOT EXISTS "event_window" (
       "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       "city" varchar(128) NOT NULL,
       "region" varchar(128) NOT NULL,
       "market_id" varchar(64) NOT NULL,
       "event_name" varchar(255) NOT NULL,
       "filter_label" varchar(128) NOT NULL,
       "start_date" timestamp NOT NULL,
       "end_date" timestamp NOT NULL,
       "lead_days" integer NOT NULL DEFAULT 90,
       "lead_boost_multiplier" numeric(4,2) NOT NULL DEFAULT 1.00,
       "search_keyword_pack" jsonb NOT NULL,
       "relevant_performer_types" jsonb NOT NULL,
       "active_status" boolean NOT NULL DEFAULT true,
       "event_year" integer NOT NULL,
       "notes" text,
       "created_at" timestamp NOT NULL DEFAULT now(),
       "updated_at" timestamp NOT NULL DEFAULT now()
     );`,
    `CREATE INDEX IF NOT EXISTS "event_window_market_id_idx" ON "event_window" ("market_id");`,
    `CREATE INDEX IF NOT EXISTS "event_window_start_date_idx" ON "event_window" ("start_date");`,
    `CREATE INDEX IF NOT EXISTS "event_window_active_status_idx" ON "event_window" ("active_status");`,

    // leadFeedback
    `CREATE TABLE IF NOT EXISTS "leadFeedback" (
       "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       "userId" integer NOT NULL,
       "leadId" integer NOT NULL,
       "outcome" "outcome" NOT NULL,
       "notes" text,
       "rateCharged" integer,
       "createdAt" timestamp NOT NULL DEFAULT now()
     );`,
    `CREATE INDEX IF NOT EXISTS "leadFeedback_userId_idx" ON "leadFeedback" ("userId");`,
    `CREATE INDEX IF NOT EXISTS "leadFeedback_leadId_idx" ON "leadFeedback" ("leadId");`,

    // scraperSubreddits
    `CREATE TABLE IF NOT EXISTS "scraperSubreddits" (
       "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       "subreddit" varchar(128) NOT NULL UNIQUE,
       "cityHint" varchar(255),
       "isActive" boolean NOT NULL DEFAULT true,
       "createdAt" timestamp NOT NULL DEFAULT now(),
       "updatedAt" timestamp NOT NULL DEFAULT now()
     );`,

    // scraperKeywords
    `CREATE TABLE IF NOT EXISTS "scraperKeywords" (
       "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       "keyword" varchar(128) NOT NULL UNIQUE,
       "type" "scraperKeywordType" NOT NULL,
       "isActive" boolean NOT NULL DEFAULT true,
       "createdAt" timestamp NOT NULL DEFAULT now(),
       "updatedAt" timestamp NOT NULL DEFAULT now()
     );`,
  ];

  try {
    for (const sql of statements) {
      // eslint-disable-next-line no-await-in-loop
      await client.query(sql);
    }
    console.log("All enum types and tables ensured in Supabase.");
  } catch (err) {
    console.error("Error running create-tables script:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

