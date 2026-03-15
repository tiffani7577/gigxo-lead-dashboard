# Gigxo Architecture Audit Report

**Date:** March 12, 2025  
**Scope:** Read-only audit of the current Gigxo system. No code was modified.

---

## 1. Lead System

### Storage

- **Table:** `gigLeads` (Drizzle schema in `drizzle/schema.ts`).
- Leads are stored in a single MySQL table with a unique `externalId` per lead (used for deduplication across sources).

### Fields (summary)

| Category | Fields |
|----------|--------|
| **Identity** | `id`, `externalId`, `source`, `leadType`, `leadCategory`, `sourceLabel` |
| **Content** | `title`, `description`, `eventType`, `performerType`, `location`, `latitude`, `longitude`, `eventDate`, `budget` (cents) |
| **Contact** | `contactName`, `contactEmail`, `contactPhone`, `venueUrl` |
| **Approval / visibility** | `isApproved`, `isRejected`, `isHidden`, `isReserved`, `rejectionReason`, `status`, `notes`, `followUpAt` |
| **Pricing** | `unlockPriceCents` (admin override; null = auto from budget) |
| **Intelligence** | `intentScore`, `freshnessScore`, `finalScore`, `contactScore`, `buyerType`, `leadTemperature`, `venueType`, `sourceTrust`, `winProbability`, `competitionLevel`, `suggestedRate`, `pitchStyle`, `prestigeScore`, `urgencyScore`, `budgetConfidence`, evidence fields, `eventWindowId`, `scrapeKeyword`, `estimatedGuestCount` |
| **Venue CRM** | `venueStatus`, `lastContactedAt`, `contactOwner`, `website`, `instagram`, `venuePhone`, `venueEmail`, `contactedAt` |
| **Monetization** | `leadMonetizationType`, `artistUnlockEnabled`, `premiumOnly`, `outreachStatus`, `outreachAttemptCount`, `outreachLastSentAt`, `outreachNextFollowUpAt`, `venueClientStatus`, `subscriptionVisibility`, `regionTag` |
| **Other** | `contentHash` (dedup), timestamps |

### Partial visibility before unlock

- **Yes.** Artist-facing APIs (`leads.getAvailable`, `leads.getById`) return the full lead row but **mask only contact fields** when the user has not unlocked the lead:
  - `contactName` → `"Contact info locked"` (or null if no name).
  - `contactEmail` → `null`.
  - `contactPhone` → `null`.
- All other fields (title, location, budget, eventType, eventDate, description, venueUrl, etc.) are **visible before unlock**.

### Lead unlock system

- **Tracking:** `leadUnlocks` table: `userId`, `leadId`, `unlockedAt`.
- **Payment:** Stripe PaymentIntent for `lead_unlock`; `transactions` table records `userId`, `leadId`, `amount` (cents), `transactionType: "lead_unlock"`, `status`.
- **Flow:** User calls `payments.createPaymentIntent` with `leadId` → price from `getLeadUnlockPriceCents` (or first-unlock $1) → after successful payment, webhook/confirm records transaction and inserts into `leadUnlocks` → confirmation email includes full contact info.
- **Unlock check:** `hasUnlockedLead(userId, leadId)` is used in `getAvailable` and `getById` to decide whether to expose real contact data.

---

## 2. Lead Unlock Logic

### $7 (and tiered) unlock

- **Default:** Standard tier **$7** (700 cents) for budget &lt; $1,500; **$15** (1,500 cents) for budget ≥ $1,500 (`shared/leadPricing.ts`: `PREMIUM_THRESHOLD_CENTS = 150_000`).
- **First unlock:** **$1** (100 cents) for users who have not used the free trial (`hasUsedFreeTrial === false`).
- **Admin override:** If `unlockPriceCents` is set on the lead, it overrides the budget-based price.
- **Credits:** User credits (e.g. referral $7) can be applied; if they cover the full price, no Stripe charge (unlock still recorded).

### What is hidden before unlock

- **Hidden:** `contactName` (replaced with "Contact info locked" or null), `contactEmail`, `contactPhone`.
- **Not hidden:** `title`, `location`, `budget`, `eventType`, `eventDate`, `description`, `venueUrl`, and all other non-contact fields.

### Lead leakage (venue name before purchase)

- **Partially.** The system does **not** hide title or location. If the venue or client name appears in `title` (e.g. "Wedding at XYZ Venue") or in `location`, that information is visible before purchase. Only explicit contact fields are redacted, so **lead leakage is possible** when identity is inferable from title/location/description.

---

## 3. Lead Status

### Status fields

- **`status`:** `varchar(50)` — free-form operator/approval state (no enum).
- **`venueStatus`:** Enum for venue intelligence CRM: `NEW`, `CONTACTED`, `FOLLOW_UP`, `MEETING`, `CLIENT`, `IGNORED`.
- **`outreachStatus`:** Enum for outreach: `not_sent`, `queued`, `sent`, `replied`, `interested`, `not_interested`, `bounced`.
- **Approval flags:** `isApproved`, `isRejected`, `isHidden`, `isReserved` — control visibility and pipeline state.

There is **no single, unified "lead lifecycle" status** (e.g. new → contacted → booked → expired) for artist-facing leads; status is a mix of approval, venue CRM, and outreach.

### Freshness / ranking

- **Schema:** `freshnessScore` (decimal 0–1), `intentScore` (0–100), `finalScore` (0–100) exist on `gigLeads`.
- **Artist-facing listing:** `leads.getAvailable` orders by `desc(createdAt)` then `desc(intentScore)` in at least one path (admin/explorer); the main artist feed may order by `desc(budget)` for featured and by `createdAt`/filters elsewhere. **No explicit "freshness badge" or freshness-based sort** is implemented in the artist-facing API.
- **Filtering:** Event date filter: only future or null `eventDate` shown. Optional `minIntentScore` filter exists in admin/explorer.

---

## 4. Venue Intelligence Data (DBPR)

### Integration

- **Yes.** DBPR dataset is integrated via **`server/scraper-collectors/dbpr-collector.ts`**.
- **Config:** Reads CSV from `DBPR_VENUE_CSV_URL`; supports header-based CSV and positional FL daily extract columns (division, county, license#, class, DBA, entity, address, city, state, zip, date, description).

### Storage and normalization

- **Same table:** Rows are normalized to `RawLeadDoc` and then written into **`gigLeads`** (same table as scraped/artist leads).
- **Identifiers:** `externalId` = `dbpr-{divisionKey}-{licenseNumber}` (divisionKey normalized, safe for uniqueness).
- **Lead type:** `leadType` / `leadCategory` = `"venue_intelligence"`; `source` = `"dbpr"`.
- **Fields:** Title from name + city; location from city/state; raw text includes name, license, division/class, county, address, city, state, zip, date, description.
- **Upsert:** For `externalId.startsWith("dbpr-")`, scraper **updates** existing rows instead of inserting duplicates.
- **Visibility:** Venue intelligence leads are **excluded** from artist-facing `getAvailable` / `getById` (and from lead unlock flow) via `leadType === "venue_intelligence"` / `leadCategory === "venue_intelligence"` checks. They are exposed only through **admin** procedures (e.g. `scraper.getVenueIntelligenceLeads`).

---

## 5. Scoring System

### Where scoring lives

- **Intelligence pipeline:** `server/intelligenceEngine.ts` and `server/scraper-collectors/scraper-pipeline.ts` (and legacy `server/scraper.ts`).
- **Config:** `server/intelligenceConfig.ts` documents formula: `baseScore = intentScore×intentWeight + contactScore×contactWeight + freshnessScore×freshnessWeight + …`; `finalScore = baseScore × eventBoostMultiplier` (capped at 100).

### Factors used

- **Intent score (0–100):** From AI/LLM classification; adjusted in pipeline by:
  - Source (e.g. Reddit/Craigslist +10, Eventbrite +5, DBPR/Sunbiz −5).
  - Contact: has email (+10), phone (+7), business/venue URL (+5); no contact −15 (except venue intel).
  - Recency (postedAt): ≤3 days +8, ≤7 days +5, &gt;60 days −5.
  - Transactional booking phrases +25; "conversation" type −10.
- **Contact score:** Quality of contact info (separate 0–100).
- **Freshness:** Multiplier from `scrapedAt` (time decay).
- **Source trust:** 0–1.
- **Other:** `winProbability`, `buyerType`, `prestigeScore`, `urgencyScore`, `competitionLevel`, `suggestedRate`, `venueType`, etc., used in intelligence engine and display.

**Note:** There is **no dedicated "venue score"** in the schema based purely on DBPR attributes (e.g. square footage, liquor license type) for venue intelligence rows; scoring is intent/contact/freshness and related factors. `leadScores` table stores **artist–lead match scores** (overallScore, payScore, locationScore, genreScore, reputationScore) for AI matching, not venue quality.

---

## 6. Admin Permissions

### Backend

- **Enforced per procedure.** Admin-only operations check `ctx.user?.role !== 'admin'` (or throw `TRPCError` with `code: "FORBIDDEN"`). Examples: `scraper.getMarkets`, `scraper.getLeadsExplorer`, `scraper.getVenueIntelligenceLeads`, `scraper.updateVenueStatus`, `scraper.getScraperRunHistory`, and other admin-only routes.
- **Auth:** User role comes from session (e.g. `users.role` enum: `"user" | "admin"`). So **admin API is restricted** to users with `role === 'admin'`.

### Frontend

- **Dashboard layout:** `client/src/components/DashboardLayout.tsx` checks if the path starts with `/admin` and `user.role !== "admin"`. If so, it renders a **403 Forbidden** view with a "Go to My Dashboard" button instead of the admin content.
- **Admin pages:** Additional guards (e.g. `AdminDashboard.tsx`: redirect or no render when `!isAuthenticated || user?.role !== "admin"`).

**Conclusion:** The admin dashboard **is** restricted. Knowing the `/admin` route alone is not enough; non-admins get 403 and cannot use admin APIs because of server-side role checks.

---

## 7. Marketplace Readiness

| Capability | Status | Notes |
|------------|--------|--------|
| **Paid lead unlocks** | ✅ Implemented | Stripe PaymentIntent, `transactions` (lead_unlock), `leadUnlocks`, credits, first unlock $1, tiered $7/$15. |
| **Subscriptions** | ✅ Present | `subscriptions` table (userId, stripeSubscriptionId, tier: free/premium, status). Stripe subscription flow for premium tier. |
| **Venue profiles** | ✅ Present | `venues` table (name, contact, venueType, location, website, Stripe, planStatus). `venueGigs` for venue-posted gigs. |
| **DJ/artist profiles** | ✅ Present | `artistProfiles` (stageName, slug, genres, location, experienceLevel, minBudget, bio, social links, isPublished, etc.). |
| **Booking transactions** | ⚠️ Partial | `bookingInquiries` table (artistUserId, inquirer contact, eventType, eventDate, budget, message, status, bookingStage). Inquiry flow exists; full booking/contract/payment flow not fully traced in this audit. |

The architecture **supports** paid unlocks, subscriptions, venue and DJ profiles, and booking inquiries; full end-to-end booking transactions may need to be verified or extended depending on product scope.

---

## 8. Risks (Adding New Features)

### Subscription tiers (e.g. multiple paid tiers)

- **Schema:** `subscriptions.tier` is currently `["free", "premium"]`. Adding tiers implies enum migration and possible new Stripe products/prices.
- **Risks:** All logic that gates features on "premium" (e.g. `premiumOnly` on leads, subscription checks) must be updated to handle new tier names and entitlements. Hardcoded `tier === "premium"` checks could leave new tiers without correct access.
- **Recommendation:** Centralize tier/entitlement checks (e.g. "can access premium leads") in one place and drive behavior from config or a tier capability matrix.

### Lead freshness badges

- **Data:** `freshnessScore` and `createdAt` (and optionally `eventDate`) already exist. Displaying a "Fresh" or "Posted X days ago" badge is mostly a front-end and API contract change.
- **Risks:** If freshness is computed on the fly and used for sorting or filtering, ensure indexes and query patterns are aligned (e.g. avoid full table scans). If freshness becomes a **stored, updated** value (e.g. nightly job), add a clear ownership so it doesn’t conflict with pipeline-written `freshnessScore`.

### DBPR venue scoring

- **Current state:** DBPR rows are stored in `gigLeads` with intent/contact/freshness-style scoring. There is **no** dedicated "venue score" from DBPR attributes (license type, size, etc.).
- **Risks:** Adding a DBPR-specific venue score (e.g. from license class, square footage) would likely require: (1) new columns or a separate venue_attributes/venue_scores table linked to `gigLeads` or `externalId`; (2) normalization of DBPR fields in the collector so they can be scored consistently; (3) ensuring collector and any batch jobs write the same shape so UI and filters don’t break. Duplicate or overlapping concepts (e.g. intentScore vs new venueScore) should be clearly separated to avoid confusion in sorting and filtering.

---

## Summary Table

| Area | Finding |
|------|--------|
| **Lead storage** | Single `gigLeads` table; rich schema (contact, approval, intelligence, venue CRM, monetization). |
| **Partial visibility** | Yes; only contact name/email/phone masked before unlock; title/location/description visible. |
| **Unlock** | $7/$15 (or admin override); first unlock $1; credits; Stripe + `leadUnlocks` + `transactions`. |
| **Lead leakage** | Possible; venue/client name in title or location is visible before purchase. |
| **Status** | `status` (varchar), `venueStatus`, `outreachStatus`, approval flags; no single lifecycle enum. |
| **Freshness/ranking** | `freshnessScore`, `intentScore`, `finalScore` in schema; listing by createdAt/intent; no freshness badge. |
| **DBPR** | Integrated; same `gigLeads` table; `externalId` dbpr-*; venue_intelligence excluded from artist APIs. |
| **Scoring** | Intent, contact, freshness, source trust; pipeline adjustments; no DBPR-only venue score. |
| **Admin** | Backend role checks on every admin procedure; frontend 403 for non-admins on `/admin`. |
| **Marketplace** | Paid unlocks ✅; subscriptions ✅; venue/DJ profiles ✅; booking inquiries ✅ (full booking flow TBD). |

---

*End of report. No code was modified during this audit.*
