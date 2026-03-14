# Gigxo — Complete Architecture Audit

This document provides a full architecture report for external system architects. It describes how the platform works today so monetization and automation can be added safely. **No code was changed**; this is analysis only.

---

## PROJECT OVERVIEW

Gigxo is a **lead-generation and marketplace platform** for entertainment professionals (DJs, bands, photographers, etc.) and event hosts. It has four main pillars:

### Admin dashboard
- **Location:** `client/src/pages/AdminDashboard.tsx`, `/admin`
- **Purpose:** Operator console for approving/rejecting leads, viewing stats, running scrapers, managing lead queue, and accessing sub-tools (Lead Explorer, Venue Intelligence, Event Windows, Live Lead Search).
- **Key actions:** Approve/reject leads, trigger "Fetch Leads" (scraper pipeline), view analytics, send drip emails, manage users. Admin-only routes and procedures enforce `ctx.user.role === 'admin'` (see `server/_core/trpc.ts` and inline checks in `server/routers.ts`).

### Artist dashboard
- **Location:** `client/src/pages/ArtistDashboard.tsx`, `/dashboard`
- **Purpose:** Artists browse approved leads, unlock contact info for a fee (or with credits), view unlocked leads, manage referrals, inquiries, and subscription. Contact availability badges ("Email available", "Phone available", "Facebook Lead — contact via profile link") show before unlock.
- **Key actions:** Filter leads, unlock via Stripe or credits, generate AI pitch (LLM), submit feedback on leads, view pipeline (booking inquiries).

### Venue intelligence system
- **Location:** `client/src/pages/AdminVenueIntelligence.tsx`, `/admin/venue-intelligence`
- **Purpose:** Admin-only CRM for venue leads from DBPR (Florida liquor licenses) and Sunbiz (Florida business data). Rows live in `gigLeads` with `leadType = 'venue_intelligence'` and `leadCategory = 'venue_intelligence'` and are **excluded** from all artist-facing queries.
- **Key actions:** Filter by `venueStatus` (NEW, CONTACTED, FOLLOW_UP, MEETING, CLIENT, IGNORED), city, license type; update status and notes; open mailto/venue links. No automated outreach to venues; admin contacts manually.

### Lead unlocking system
- **Flow:** Artist clicks Unlock → `payments.createPaymentIntent` (or free with credits / first unlock $1) → Stripe or credit application → `payments.confirmPayment` → `recordLeadUnlock` in `server/db.ts`, insert into `leadUnlocks` and `transactions` → contact data returned to client.
- **Pricing:** `shared/leadPricing.ts`: Standard $7 (budget &lt; $1,500), Premium $15 (budget ≥ $1,500). First unlock $1. Admin can set `unlockPriceCents` per lead. Credits (e.g. referral $7) applied before charging Stripe.

### Payment and monetization logic
- **Stripe:** One-time lead unlock (`createLeadUnlockPaymentIntent`, `verifyPaymentIntent` in `server/stripe.ts`), subscription checkout ($19/month Premium — 5 unlocks) in `subscription.startPremium`, webhook in `server/stripeWebhook.ts` for `checkout.session.completed`, `customer.subscription.updated/deleted`, `invoice.payment_succeeded` (renewal credits).
- **Credits:** `userCredits` table; referral grants 700 cents ($7) to referrer; credits consumed on unlock before Stripe charge.
- **Transactions:** `transactions` table records each unlock (userId, leadId, amount, transactionType: `lead_unlock` | `subscription`, stripePaymentIntentId, status).

---

## TECH STACK

| Layer | Technology |
|-------|------------|
| **Package manager** | pnpm (see `package.json` `packageManager` and `engines`) |
| **Runtime** | Node.js 22.x |
| **Language** | TypeScript (ESM, strict) |
| **Client framework** | React 19, Vite 7 (see `package.json` dependencies and `vite.config.ts`) |
| **Client routing** | wouter (`client/src/App.tsx`: Route, Switch) |
| **Client UI** | Tailwind CSS 4, Radix UI–style components in `client/src/components/ui`, Lucide icons |
| **Server framework** | Express (entry: `server/_core/index.ts`) |
| **API layer** | tRPC v11 (type-safe procedures; server in `server/routers.ts`, client via `@trpc/client` + `@tanstack/react-query`) |
| **Database** | MySQL (e.g. Railway; connection via `DATABASE_URL`) |
| **ORM** | Drizzle ORM (`drizzle-orm`, schema in `drizzle/schema.ts`) |
| **Build** | `vite build` (client) + `esbuild` (server bundle: `server/_core/index.ts` → `dist/index.js`) |
| **Deployment** | Railway (nixpacks; see `railway.toml`: buildCommand `npm install --legacy-peer-deps && npm run build`, startCommand `npm start`) |
| **Auth** | Custom email/password + JWT (`server/customAuth.ts`), optional Google OAuth (`server/googleAuth.ts`); session cookie `CUSTOM_AUTH_COOKIE` from `shared/const.ts` |
| **Payments** | Stripe (one-time and subscription); webhook route registered in `server/_core/index.ts` via `registerStripeWebhook` |
| **Email** | Resend (`server/email.ts`) |
| **Scraping** | Modular collectors in `server/scraper-collectors/` (Reddit, Eventbrite, Craigslist, DBPR, Sunbiz, Apify); pipeline in `server/scraper-collectors/scraper-pipeline.ts` |

---

## DATABASE SCHEMA

All tables are defined in `drizzle/schema.ts`. Relationships are logical (foreign keys not always enforced in schema; application code joins by id).

### Core auth and users
| Table | Purpose | Key columns |
|-------|---------|-------------|
| **users** | Auth and role | id, openId, name, email, passwordHash, emailVerified, googleId, avatarUrl, loginMethod, **role** (enum: user, admin), hasUsedFreeTrial, createdAt, updatedAt, lastSignedIn |

### Artists
| Table | Purpose | Key columns |
|-------|---------|-------------|
| **artistProfiles** | One per user; stage identity and booking profile | id, userId, djName, stageName, slug, photoUrl, heroImageUrl, avatarUrl, genres (JSON), location, experienceLevel, minBudget, maxDistance, equipment (JSON), bio, soundcloudUrl, websiteUrl, etc., isPublished, isClaimed, templateId, themePrimary, themeAccent, createdAt, updatedAt |

### Leads and unlocks
| Table | Purpose | Key columns |
|-------|---------|-------------|
| **gigLeads** | Central lead table: artist-facing event leads + venue intelligence rows | id, **externalId** (unique), **source** (enum: gigxo, eventbrite, reddit, dbpr, sunbiz, …), **leadType** (scraped_signal, venue_intelligence, manual_outreach, …), **leadCategory** (general, wedding, venue_intelligence, …), title, description, eventType, budget (cents), location, latitude, longitude, eventDate, contactName, contactEmail, contactPhone, venueUrl, performerType, **venueStatus** (NEW, CONTACTED, FOLLOW_UP, MEETING, CLIENT, IGNORED — for venue intel), notes, lastContactedAt, contactOwner, website, instagram, venuePhone, venueEmail, isApproved, isRejected, isHidden, isReserved, unlockPriceCents, intentScore, leadTemperature, eventWindowId, scrapeKeyword, … |
| **leadUnlocks** | Which artist unlocked which lead | id, userId, leadId, unlockedAt |
| **leadViews** | Social proof: which user viewed which lead | id, leadId, userId, viewedAt |
| **leadScores** | Per-lead, per-artist AI/match scores (used by scoring layer) | id, leadId, artistId, overallScore, payScore, locationScore, genreScore, reputationScore, createdAt |
| **leadFeedback** | Artist outcome after unlock (booked, no_response, lost, etc.) | id, userId, leadId, outcome (enum), notes, rateCharged, createdAt |

### Payments and credits
| Table | Purpose | Key columns |
|-------|---------|-------------|
| **transactions** | Pay-to-unlock and subscription payments | id, userId, leadId, amount (cents), transactionType (lead_unlock, subscription), stripePaymentIntentId, status (pending, completed, failed, refunded), createdAt, updatedAt |
| **userCredits** | Referral/promo credits (cents) | id, userId, amount, source (referral, promo, refund), referralId, isUsed, createdAt |
| **subscriptions** | User subscription state | id, userId, stripeSubscriptionId, tier (free, premium), status (active, canceled, past_due), currentPeriodStart, currentPeriodEnd, createdAt, updatedAt |

### Referrals
| Table | Purpose | Key columns |
|-------|---------|-------------|
| **referrals** | Referral attribution | id, referrerId, referredId, referralCode, creditAmount (default 700), creditApplied, createdAt |

### Booking and inquiries
| Table | Purpose | Key columns |
|-------|---------|-------------|
| **bookingInquiries** | Inquiries from public artist profile pages | id, artistUserId, inquirerName, inquirerEmail, inquirerPhone, eventType, eventDate, eventLocation, budget, message, status (new, read, replied, booked, declined), artistNotes, bookingStage (inquiry, confirmed, completed, cancelled), createdAt |

### Venues (Venue Pro plan — table exists, product use may be limited)
| Table | Purpose | Key columns |
|-------|---------|-------------|
| **venues** | Venue accounts (separate from venue intelligence leads) | id, name, contactName, contactEmail, contactPhone, venueType, location, website, stripeCustomerId, stripeSubscriptionId, planStatus, passwordHash, sessionToken, createdAt |
| **venueGigs** | Gig postings by venues | id, venueId, title, eventType, eventDate, budget, location, description, genresNeeded, status, isApproved, createdAt, updatedAt |

### Event windows (admin)
| Table | Purpose | Key columns |
|-------|---------|-------------|
| **event_window** | Time-bound event windows for boost and filter chips | id, city, region, market_id, event_name, filter_label, start_date, end_date, lead_days, lead_boost_multiplier, search_keyword_pack (JSON), relevant_performer_types (JSON), active_status, event_year, notes, createdAt, updatedAt |

### Scraper and explorer config
| Table | Purpose | Key columns |
|-------|---------|-------------|
| **scraperRuns** | Log of each "Fetch Leads" run | id, collected, negativeRejected, intentRejected, accepted, inserted, skipped, sourceCounts (JSON), createdAt |
| **explorerSourceToggles** | Which sources are enabled (reddit, eventbrite, craigslist, etc.) | id, sourceKey, enabled, updatedAt |
| **savedSearches** | Admin saved filter combinations (Leads Explorer) | id, userId, name, filterJson (JSON), createdAt |
| **explorerPhraseSets** | Include/exclude phrase sets for explorer | id, name, type (include, exclude), phrases (JSON), createdAt |
| **scraperSubreddits** | Managed subreddits for Reddit collector | id, subreddit, cityHint, isActive, createdAt, updatedAt |
| **scraperKeywords** | Keywords for intent filtering | id, keyword, type (seeking, entertainment), isActive, createdAt, updatedAt |

### Other
| Table | Purpose | Key columns |
|-------|---------|-------------|
| **musicTracks** | Artist-uploaded tracks (S3 key, URL) | id, userId, title, fileKey, fileUrl, durationSeconds, playCount, sortOrder, createdAt |
| **notifications** | In-app notifications | id, userId, type, title, body, isRead, createdAt |
| **passwordResetTokens** | Password reset flow | id, userId, token, expiresAt, usedAt, createdAt |
| **owner_checklist** | Launch checklist items | id, item_key, label, description, category, is_completed, completed_at, sort_order, created_at |
| **growth_tasks** | Growth/monetization worksheet tasks | id, title, description, category, frequency, estimated_revenue, status, notes, last_done_at, sort_order, is_automated, created_at |
| **aiPitchDrafts** | Stored AI pitch drafts per user/lead | id, userId, leadId, pitchText, stripePaymentIntentId, isPaid, isFree, createdAt |
| **newsArticles** | Daily industry news (digest) | id, title, summary, url, source, category, digestDate, publishedAt, createdAt |
| **dripEmailLog** | Which drip emails were sent to which user | id, userId, dripType (day3, day7, lead_alert, reengagement), sentAt |

---

## LEAD SYSTEM

### Where leads are stored
- **Single table:** `gigLeads` (`drizzle/schema.ts`). Both artist-facing event leads and admin-only venue intelligence rows live here. Visibility is determined by `leadType`, `leadCategory`, `isApproved`, `isHidden`, `isReserved`, and `eventDate` (future or null).

### Lead fields (relevant subset)
- **Identity:** id, externalId (unique; e.g. `reddit-{id}`, `dbpr-{divisionKey}-{licenseNumber}`).
- **Classification:** source, sourceLabel, leadType, leadCategory, performerType, eventType.
- **Content:** title, description, location, latitude, longitude, eventDate, budget (cents).
- **Contact:** contactName, contactEmail, contactPhone, venueUrl.
- **Venue intelligence CRM:** venueStatus, lastContactedAt, contactOwner, website, instagram, venuePhone, venueEmail, notes.
- **State:** isApproved, isRejected, isHidden, isReserved, rejectionReason, unlockPriceCents.
- **Scoring:** intentScore, leadTemperature, winProbability, intentEvidence, contactEvidence, eventEvidence, eventWindowId, scrapeKeyword.

### Lead statuses (operator/artist view)
- **Approval:** isApproved (true → visible to artists if not venue intel), isRejected (rejected from queue), isHidden (admin hid), isReserved (never shown to artists).
- **Venue intelligence:** venueStatus (NEW, CONTACTED, FOLLOW_UP, MEETING, CLIENT, IGNORED) — used only on admin Venue Intelligence page.

### How leads are filtered
- **Artist-facing:** All artist lead queries exclude rows where `leadType` in (`venue_intelligence`, `manual_outreach`) or `leadCategory = 'venue_intelligence'`. Additional filters: `isApproved = true`, `isHidden = false`, `isReserved = false`, and `eventDate >= now` or null (see `server/routers.ts` leads.getAvailable and getById).
- **Admin Leads Explorer:** Full `gigLeads` access with filters: sources, location, performerType, minIntentScore, status (pending/approved/rejected), date range, searchText, includePhrases, excludePhrases, leadType, leadCategory, hasEmail, hasPhone, hasVenueUrl, missingContact.
- **Venue Intelligence:** `leadType = 'venue_intelligence'` with filters venueStatus, city, licenseType, searchText.

### How leads are scored
- **Pipeline (no LLM):** In `server/scraper-collectors/scraper-pipeline.ts`, intentScore is computed by rule-based logic: base from phrase match (~80), then adjustments for source (reddit/craigslist +10), contactability (email/phone/venue URL), recency (e.g. ≤3 days +8). Clamped 0–100. Event type and performer type from regex/keyword classification.
- **Artist match (optional):** `server/scoring.ts` `scoreLead()` used for lead-match emails and ranking; uses lead fields and artist profile (genres, location, experienceLevel) to produce overallScore and sub-scores.
- **Intelligence engine fields** (intentScore, leadTemperature, winProbability, etc.) are written at insert/update; some may be backfilled or set by pipeline.

### How leads appear in the artist dashboard
- **List:** `leads.getAvailable` returns paginated, approved, non–venue-intel leads. Each lead includes: full lead row, **isUnlocked** (user’s id in `leadUnlocks`), **contactName** (or "Contact info locked"), **contactEmail** and **contactPhone** (null if not unlocked), **hasContactEmail**, **hasContactPhone**, **hasFacebookProfileLink** (for badges), viewCount, unlockCount.
- **Detail:** Selecting a lead calls `leads.getById`; same contact masking and hints. Unlock flow uses `payments.createPaymentIntent` then `payments.confirmPayment`; after that, contact data is returned and stored in client state / getById.

### How contact data is hidden or revealed
- **Hidden:** For non-unlocked leads, API overwrites contactEmail and contactPhone to null and contactName to "Contact info locked" (or null). venueUrl is not sent in a way that reveals contact; hasFacebookProfileLink is a boolean hint.
- **Revealed:** After successful unlock, `recordLeadUnlock` inserts into `leadUnlocks`, and getById/getAvailable return real contactName, contactEmail, contactPhone for that user. getUnlockedLeadInfo also returns contact + venueUrl for unlocked lead.

---

## ARTIST DASHBOARD

### How artists view leads
- **Route:** `/dashboard` (ArtistDashboard.tsx). Tab "leads" lists leads from `leads.getAvailable` with filters (event type, performer type, city). Each card shows title, location, event date, budget, performer/event type, temperature badge, "NEW" badge, contact availability badges (Email/Phone/Facebook Lead), win probability bar, and Unlock button.
- **Detail panel:** Clicking a lead loads `leads.getById(selectedLead)`; shows full detail, contact section (locked or unlocked), and AI pitch generation when unlocked.

### How lead unlock works
1. Artist clicks Unlock → client calls `payments.createPaymentIntent({ leadId })`.
2. Server checks: lead exists, approved, not venue intel, not already unlocked. Computes price via `getLeadUnlockPriceCents(budget, unlockPriceCents)`. First unlock: $1; else applies userCredits then Stripe amount.
3. If amount 0 (credits cover), returns isFreeWithCredits; client calls `confirmPayment({ leadId, paymentIntentId: null, isFree: true })`.
4. Otherwise client opens Stripe payment (or demo); on success calls `payments.confirmPayment({ leadId, paymentIntentId, isFree })`.
5. Server verifies payment (or skips if free), marks hasUsedFreeTrial if first, consumes credits if used, calls `recordLeadUnlock(userId, leadId)`, inserts transaction, sends confirmation email, returns contactInfo.
6. Client refreshes lead data; contact and venueUrl appear.

### Endpoints powering the dashboard
- **Leads:** `leads.getAvailable`, `leads.getById`, `leads.getStats`, `leads.submitFeedback`, `leads.getMyFeedback`, `leads.generatePitch`.
- **Payments:** `payments.getConfig`, `payments.createPaymentIntent`, `payments.confirmPayment`, `payments.getUnlockedLeadInfo`, `payments.getMyTransactions`.
- **Artist:** `artist.getMyCredits`, `artist.getMyUnlocks`, `artist.getProfile`, `artist.getMyArtistProfile`, `artist.updateProfile`.
- **Referrals:** `referrals.getReferralLink`, `referrals.getReferralStats`.
- **Booking:** `booking.getMyInquiries`, `booking.updateStatus`.
- **Subscription:** `subscription.getMy`, `subscription.startPremium`, `subscription.cancel`.
- **Events:** `events.getActiveFilters` (for filter chips).
- **Notifications:** `notifications.getUnreadCount`, `notifications.getAll`, `notifications.markRead` / `markAllRead`.

### Data before vs after unlock
- **Before unlock:** Lead row with contactEmail/contactPhone null, contactName "Contact info locked" or null; hasContactEmail, hasContactPhone, hasFacebookProfileLink booleans for badges; no venueUrl in contact payload (hint only for "Facebook Lead").
- **After unlock:** Same lead with real contactName, contactEmail, contactPhone, and venueUrl in getById and getUnlockedLeadInfo; isUnlocked true in list and detail.

---

## ADMIN DASHBOARD

### Venue Intelligence
- **Route:** `/admin/venue-intelligence` (AdminVenueIntelligence.tsx).
- **Data:** `admin.getVenueIntelligenceLeads` — queries `gigLeads` where `leadType = 'venue_intelligence'` with filters: venueStatus, city, licenseType, searchText. Returns id, externalId, title, location, intentScore, venueStatus, lastContactedAt, contact fields, venueEmail, venuePhone, venueUrl, notes, sourceLabel.
- **Actions:** Update venue status (`admin.updateVenueStatus` → updates gigLeads.venueStatus, lastContactedAt), update notes (`admin.updateVenueNotes`). UI offers mailto and venue link; no automated sending.
- **Tables affected:** `gigLeads` (venueStatus, notes, lastContactedAt).

### Lead Explorer
- **Route:** `/admin/leads-explorer` (AdminLeadsExplorer.tsx).
- **Data:** `admin.getLeadsExplorer` — paginated query on `gigLeads` with filters (sources, location, performerType, minIntentScore, status, date range, searchText, include/exclude phrases, leadType, leadCategory, hasEmail, hasPhone, hasVenueUrl, missingContact). Returns items + total.
- **Actions:** Approve/reject leads (updateLead), open mailto for outreach, save/delete saved searches, manage phrase sets (getPhraseSets, savePhraseSet, deletePhraseSet). Saved searches and phrase sets stored in savedSearches, explorerPhraseSets.
- **Tables affected:** `gigLeads` (isApproved, isRejected, rejectionReason, etc.), `savedSearches`, `explorerPhraseSets`.

### Event Windows
- **Route:** `/admin/event-windows` (AdminEventWindows.tsx).
- **Data:** `events.getAllEvents` (all rows from `event_window`), `events.getActiveFilters` (active windows for filter chips).
- **Actions:** Toggle active (toggleEvent), add (addEvent), update (updateEvent), delete (deleteEvent) event windows.
- **Tables affected:** `event_window`.

### Pipeline Board
- **Route:** `/pipeline` (PipelineBoard.tsx) — artist-facing Kanban for **booking inquiries**, not gig leads.
- **Data:** `pipeline.getBoard` — bookingInquiries where artistUserId = ctx.user.id, grouped by bookingStage (inquiry, confirmed, completed, cancelled).
- **Actions:** Move card (`pipeline.moveCard` → update bookingStage), update notes (`pipeline.updateNotes`).
- **Tables affected:** `bookingInquiries`.

### Live Lead Search
- **Route:** `/admin/live-lead-search` (LiveLeadSearch.tsx).
- **Data:** No persistent table for "live" results; admin runs a search with custom phrase, sources (reddit, craigslist, eventbrite), city, performerType, keywords, date range. `admin.runLiveLeadSearch` calls `runLiveLeadSearch()` from scraper-pipeline; returns raw leads from live collectors (not yet in DB).
- **Actions:** Run search, then optionally save results to gigLeads via `admin.saveLeadsToGigLeads` (insert or update by externalId; new rows get isApproved: false).
- **Tables affected:** `gigLeads` only when admin saves; `savedSearches` for presets (filterJson.presetType === "liveSearch").

---

## VENUE INTELLIGENCE INGESTION

### Scrapers and sources
- **DBPR:** `server/scraper-collectors/dbpr-collector.ts` — fetches CSV from `DBPR_VENUE_CSV_URL`, parses rows, produces RawLeadDoc with source dbpr, leadType/leadCategory venue_intelligence. externalId format e.g. `dbpr-{divisionKey}-{licenseNumber}`. Inserted/updated in runScraper (upsert by externalId for dbpr-*).
- **Sunbiz:** `server/scraper-collectors/sunbiz-collector.ts` — reads from local file `SUNBIZ_FILE_PATH` (fixed-width). Partial/placeholder parsing; may need correct file and offsets.
- **Reddit, Eventbrite, Craigslist:** Same pipeline as artist leads; when source is DBPR/Sunbiz, pipeline marks leadType/leadCategory as venue_intelligence and they are not shown to artists.

### Google Maps ingestion
- **Apify:** `server/scraper-collectors/apify-collector.ts` includes Google Maps actor (compass/google-maps-scraper); normalizes to RawLeadDoc. Apify is enabled via source-config (apify in LEAD_SOURCE_KEYS). Results go through pipeline; if classified as venue-type they can be venue_intelligence.
- **No direct Google Maps API** in the main Fetch Leads path; Apify actor is used when enabled.

### Manual lead creation
- Admin can add/update leads via Lead Explorer (updateLead) and by saving Live Lead Search results (saveLeadsToGigLeads). Manual entries use gigLeads insert/update with appropriate source/leadType.

### Lead scoring logic (venue vs event leads)
- **Venue intel (DBPR/Sunbiz):** No intent gate; pipeline assigns leadType/leadCategory venue_intelligence and passes through. intentScore may be set but is not used for artist visibility.
- **Event leads:** Rule-based intent (phrase match, negative keywords, junk doc filter), then intentScore 0–100 and event/performer classification. Only approved, non–venue-intel rows appear in artist dashboard.

---

## OUTREACH SYSTEM

**There is no automated venue or lead outreach system.**

- **Email sending:** Resend is used for: verification, password reset, lead-unlock confirmation, drip (day 3, day 7, reengagement), lead-match emails (admin-triggered sendMatchEmails), and new-lead alerts (admin-triggered sendNewLeadAlerts). See `server/email.ts` and `server/dripCron.ts`.
- **Outreach “templates”:** `automation.getOutreachTemplates` returns **static copy** for admin to use manually in Facebook groups, Instagram, TikTok, DMs, Nextdoor. No sending or tracking; templates are for copy-paste only.
- **Venue Intelligence:** Admin uses mailto: and venue links from the UI; no status tracking beyond venueStatus and lastContactedAt. No automated emails to venues.
- **Lead Explorer:** Admin can open mailto for a lead’s contactEmail; no templates or sent-log per lead.

So: **outreach is manual only**; no automated venue outreach, no per-lead email campaigns, and no outreach status beyond venue CRM status.

---

## AUTHENTICATION AND ROLES

### Roles
- **user (default):** Artists; can use dashboard, unlock leads, manage profile, referrals, inquiries, subscription. Cannot access admin routes or admin procedures.
- **admin:** Full access to admin dashboard, Lead Explorer, Venue Intelligence, Event Windows, Live Lead Search, runScraper, getUsers, sendMatchEmails, sendNewLeadAlerts, getOutreachTemplates, etc.

### How permissions are enforced
- **tRPC:** `protectedProcedure` requires authenticated user (session from cookie; see `server/_core/context.ts` and `server/_core/trpc.ts`). Admin-only procedures check `ctx.user.role !== 'admin'` and throw FORBIDDEN (e.g. runScraper, getLeadsExplorer, getVenueIntelligenceLeads, updateVenueStatus, runLiveLeadSearch, sendMatchEmails).
- **Routes:** Client shows admin nav (DashboardLayout) and admin routes (/admin/*) to all authenticated users; backend rejects non-admin calls. No separate admin login; same users table, role column.
- **Lead visibility:** Enforced in queries (exclude venue_intelligence, manual_outreach, isReserved, isHidden, isApproved, eventDate) and in payments (createPaymentIntent/confirmPayment reject venue intel leads).

---

## ROUTES AND API ENDPOINTS

All API access is via **tRPC** (no REST list). Main routers and procedures:

### Events (public + admin)
- events.getActiveFilters, events.getAllEvents, events.toggleEvent, events.addEvent, events.updateEvent, events.deleteEvent — event_window CRUD and active filters.

### Auth
- auth.login, auth.logout, auth.register, auth.me, auth.resendVerification, auth.updateProfile, auth.onLogin — custom auth and session.

### Public leads
- publicLeads.getFeatured — featured leads for marketing; submitClientLead — inbound form.

### Artist
- artist.getProfile, artist.getMyArtistProfile, artist.updateProfile, artist.getMyUnlocks, artist.getMyCredits — profile and credits.

### Leads (artist + admin)
- leads.getAvailable — paginated artist-visible leads, with hasContactEmail/hasContactPhone/hasFacebookProfileLink, view/unlock counts.
- leads.getById — single lead; contact masked unless unlocked.
- leads.getStats — total available, myUnlocks.
- leads.generatePitch — LLM pitch for unlocked lead (requires BUILT_IN_FORGE_API_KEY).
- leads.submitFeedback, leads.getMyFeedback — outcome after unlock.
- leads.getFeatured — public featured list.

### Payments
- payments.getConfig — Stripe publishable key, demo mode.
- payments.createPaymentIntent — lead unlock intent; first unlock $1, credits applied, then Stripe.
- payments.confirmPayment — verify payment/credits, recordLeadUnlock, create transaction, send email, return contact.
- payments.getUnlockedLeadInfo — contact + venueUrl for unlocked lead.
- payments.getMyTransactions — user’s transactions.

### Referrals
- referrals.getReferralLink, referrals.getReferralStats — link and stats; referral attribution and credit grant on signup.

### Admin
- admin.getPendingLeads, admin.getAllLeads, admin.updateLead — queue and approve/reject.
- admin.getAnalytics, admin.getUsers — dashboard stats and user list.
- admin.runScraper — runScraperPipeline, insert into gigLeads, log scraperRuns.
- admin.getMarkets — US_MARKETS for UI.
- admin.getLeadsExplorer — filtered gigLeads list.
- admin.getScraperRunHistory — scraperRuns.
- admin.getVenueIntelligenceLeads, admin.updateVenueStatus, admin.updateVenueNotes — venue CRM.
- admin.getSourceToggles, admin.getPhraseSets, admin.savePhraseSet, admin.deletePhraseSet, admin.getSavedSearches, admin.saveSearch, admin.deleteSavedSearch — explorer config.
- admin.runLiveLeadSearch, admin.saveLeadsToGigLeads, admin.getLiveSearchPresets, admin.saveLiveSearchPreset, admin.deleteLiveSearchPreset — live search and save to gigLeads.

### Tracks, directory, booking
- tracks.getMyTracks, tracks.uploadTrack, tracks.getArtistTracks, tracks.deleteTrack.
- directory.getArtistBySlug — public artist profile.
- booking.submitInquiry, booking.getMyInquiries, booking.updateStatus — public inquiry form and artist pipeline.

### Subscription
- subscription.getMy, subscription.startPremium ($19/mo checkout), subscription.cancel — subscription state and Stripe checkout.

### Pipeline (booking inquiries Kanban)
- pipeline.getBoard, pipeline.moveCard, pipeline.updateNotes — bookingInquiries by artist.

### Notifications, worksheet, automation
- notifications.getUnreadCount, notifications.getAll, notifications.markRead, notifications.markAllRead.
- worksheet.getChecklist, worksheet.getGrowthTasks, worksheet.updateGrowthTask.
- automation.sendDay3Drip, automation.sendDay7Drip, automation.sendReengagement, automation.sendMatchEmails, automation.sendNewLeadAlerts, automation.getOutreachTemplates.

### Other
- inbound router (inbound.ts), scraper-config router (scraper-config.ts) — subrouters for inbound leads and scraper config (e.g. subreddits).

**HTTP routes (Express):** Stripe webhook (POST), OAuth callbacks, sitemap, static/Vite. Main app and API are tRPC over POST (e.g. /api/trpc).

---

## CURRENT MONETIZATION LOGIC

- **Paid lead unlock:** Primary. Price from `shared/leadPricing.ts`: $7 standard (budget &lt; $1,500), $15 premium (≥ $1,500). First unlock $1. Admin override: unlockPriceCents per lead. Stripe one-time payment or full credit use; transaction recorded in `transactions` (lead_unlock).
- **Credits:** userCredits (referral $7, promo, refund); applied to unlock before charging Stripe; marked isUsed when consumed.
- **Subscription:** Premium $19/month for 5 unlocks; Stripe Checkout and webhook (checkout.session.completed, subscription.updated/deleted, invoice.payment_succeeded) update `subscriptions` and grant monthly credits (see stripeWebhook.ts). subscription.getMy, startPremium, cancel.
- **Referral:** Referrer gets 700 cents ($7) credit when referred user signs up; creditApplied and userCredits inserted (routers.ts auth/register path and referrals).
- **No commission on bookings** — artists keep 100%; no revenue share on inquiry conversion.
- **Venue intelligence:** Admin-only; no current productized venue subscription or per-venue fee in code (venues table exists for future Venue Pro).

---

## DEPLOYMENT

- **Platform:** Railway. Config: `railway.toml` — builder nixpacks, buildCommand `npm install --legacy-peer-deps && npm run build`, startCommand `npm start`, restartPolicyType ON_FAILURE, restartPolicyMaxRetries 10.
- **Build:** `npm run build` → `vite build` (client to dist/client assets) + `esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist` (server bundle dist/index.js). Node 22.x in package.json engines.
- **Start:** `npm start` → `NODE_ENV=production node dist/index.js` (serves Express + tRPC + static and Vite-built client).
- **Environment variables (key):** DATABASE_URL (MySQL), JWT_SECRET, STRIPE_SECRET_KEY, VITE_STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY, DBPR_VENUE_CSV_URL, SUNBIZ_FILE_PATH, BUILT_IN_FORGE_API_URL / BUILT_IN_FORGE_API_KEY (LLM), GOOGLE_CLIENT_ID/SECRET (OAuth), PORT, NODE_ENV. See ARCHITECTURE.md and server/_core/env.ts for full list.

---

## KNOWN LIMITATIONS

- **No automated venue outreach** — Venue Intelligence is manual CRM only; no emails or sequences to venues.
- **No lead monetization tagging** — No explicit “monetization type” or product tag on leads (e.g. marketplace vs venue-intel subscription); distinction is leadType/leadCategory only.
- **Booking pipeline is inquiry-only** — Pipeline Board is for bookingInquiries from public profile; no direct link from unlocked gig lead to a “booking” or deal record; no commission tracking.
- **Subscription and credits not fully wired to unlock limit** — Premium grants “5 unlocks per month” in product copy; webhook and credit logic exist but monthly reset and cap enforcement may need verification against product spec.
- **No venue subscription product** — venues table and venueGigs exist; no active flow for venues to pay for listing or for artist access to venue gigs.
- **Outreach templates are copy-only** — getOutreachTemplates returns static text; no sending, no tracking, no A/B tests.
- **Live Lead Search results are ephemeral** — Not stored until admin clicks save; no draft or queue.
- **Intent scoring is rule-based only** — No LLM in Fetch Leads pipeline; quality depends on phrases and filters (see ARCHITECTURE.md).
- **Craigslist/Eventbrite collectors unstable** — 403 or brittle parsing; Reddit and DBPR are primary.

---

## RECOMMENDED EVOLUTION OF GIGXO

These recommendations assume the current schema and flows remain; add new features and tables where needed rather than breaking existing behavior.

### 1. Automated venue outreach
- **Current:** Venue Intelligence is view/update only; admin uses mailto and manual notes.
- **Add:** New table e.g. `venueOutreachLog` (venueLeadId, sentAt, templateId, channel, status). Scheduled job or admin “Send batch” that:
  - Selects venues by venueStatus (e.g. NEW) and optional segment.
  - Uses Resend (or dedicated sender) with templates parameterized by venue fields from gigLeads.
  - Logs each send and updates lastContactedAt (and optionally venueStatus to CONTACTED).
- **Safety:** Keep venue_intelligence excluded from artist leads. Run jobs in a single place (cron or queue) to avoid duplicate sends; rate-limit by domain/email if needed.

### 2. Lead marketplace for artists
- **Current:** Single unlock price per lead; no bidding or marketplace dynamics.
- **Add:** Optional “marketplace” layer: lead_offers or lead_availability (leadId, maxUnlocks, unlockPriceOverride, expiresAt). Artist-facing “marketplace” view could show scarcity (e.g. “3 left at $7”) and time-limited offers. Revenue remains per-unlock; no need to change core leadUnlocks/transactions, only add offer logic and UI.
- **Safety:** Keep getAvailable/getById contract; add optional fields or a separate marketplace.getOffers procedure so existing dashboard still works.

### 3. Venue intelligence subscription product
- **Current:** Venue intel is admin-only; no paid tier for venues or for “venue lead” access.
- **Add:** Product concept: “Venue Intel Pro” — subscription or one-time for access to a filtered export or list of venue_intelligence rows (e.g. by region, license type). New table e.g. venueIntelSubscriptions (userId or orgId, plan, stripeSubscriptionId, filters JSON). Backend: new procedure that returns venue intel rows only if caller has an active subscription and within usage limits. Stripe product for “Venue Intel Pro” and webhook to activate/cancel.
- **Safety:** Continue excluding venue_intelligence from artist lead APIs; new product uses a separate permission and dataset (same gigLeads rows, different access path).

### 4. Gigxo venue booking network
- **Current:** bookingInquiries from public profile; no connection to unlocked leads or venues table.
- **Add:** Link venues (and venue intelligence) to “booking network”: e.g. venueGigs as first-class postings that artists can browse and apply to; or “request to play” from artist to venue. Tables venues and venueGigs already exist; add flows: venue onboarding (auth, subscription if desired), gig creation, artist view of open venue gigs, application/inquiry from artist to venue. Optionally link venue record to gigLeads.externalId (e.g. dbpr-*) so that when a venue “claims” a DBPR row, it becomes a client in the network.
- **Safety:** Keep current artist “unlock lead” flow unchanged; booking network is an additional surface (new routes, new procedures). Venue intelligence ingestion (DBPR/Sunbiz) remains as-is; new logic only for “claimed” or “network” venues.

### 5. South Florida regional marketplace positioning
- **Current:** Location and filters (Miami, Fort Lauderdale, South Florida) and event windows already bias content and keywords; cityFromPostText and location logic in pipeline and apify-collector enforce “South Florida” keywords for display.
- **Add:** Explicit “region” or “market” dimension: e.g. marketId on gigLeads or a view that segments by region (South Florida, then expand). Use event_window and explorer config to drive South Florida–first experience (filter chips, default city, copy). Optional: dedicated landing or pricing for “South Florida artists” (same stack, different default filters and messaging). No schema change strictly required; mainly defaults, SEO, and positioning in UI and marketing.

---

*End of architecture audit. All references are to the current codebase (drizzle/schema.ts, server/routers.ts, server/scraper-collectors/*, client/src/pages/*, shared/leadPricing.ts, server/stripeWebhook.ts, railway.toml, package.json).*
