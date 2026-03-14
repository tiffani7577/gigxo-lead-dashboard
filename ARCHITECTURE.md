# Gigxo — Architecture & Onboarding

This document describes the Gigxo codebase for engineers joining the project or moving it from Manus to Cursor/Railway.

---

## 1. PROJECT OVERVIEW

**Gigxo** is a lead-generation and marketplace platform for entertainment professionals (DJs, bands, photographers, etc.) and event hosts. It has four main pillars:

- **DJ lead marketplace** — Artists pay to unlock contact info for event leads (weddings, corporate events, private parties). Leads are scraped from public sources, classified, and presented in an admin approval queue; approved leads appear in the artist dashboard and pipeline.
- **Venue intelligence engine** — Admin-only CRM fed by DBPR (Florida liquor-license) and Sunbiz (Florida business) data. Venue records are used for outreach and relationship tracking, not as paid artist leads.
- **Admin operator console** — Admin dashboard for approving/rejecting leads, running scrapers, configuring event windows, managing Venue Intelligence, Leads Explorer, Live Lead Search, and source toggles.
- **SEO lead capture engine** — Dynamic landing pages (e.g. `/:slug` for service+city combos like `dj-miami`, `wedding-dj-fort-lauderdale`) that capture quote requests and internal links to artist profiles; sitemap and SEO-focused content.

---

## 2. TECH STACK

The repo uses:

| Layer | Technology |
|-------|------------|
| Runtime | **Node.js** with **tsx** (TypeScript execute) in development; compiled ESM for production |
| Language | **TypeScript** (strict, ESM) |
| API / Server | **Express** (in `server/_core/index.ts`), **tRPC** for type-safe API (server in `server/routers.ts`, client in `client` via `@trpc/client` + React Query) |
| Database | **MySQL** (e.g. Railway), **Drizzle ORM** for schema and queries |
| Schema / Migrations | **Drizzle** (`drizzle/schema.ts`), `drizzle-kit` for generate/push; manual SQL in `drizzle/manual-sync-gigleads.sql` for additive changes |
| Frontend | **React 19**, **Vite** (client build), **wouter** (routing), **Tailwind CSS**, Radix UI–style components in `client/src/components/ui` |
| Auth | Custom email/password + JWT (`server/customAuth.ts`), optional Google OAuth (`server/googleAuth.ts`), Manus OAuth legacy path (`server/_core/sdk.ts`, `server/_core/oauth.ts`) |
| Payments | **Stripe** (unlock leads, subscriptions) |
| Email | **Resend** |
| Scraping | Modular **scraper collectors** in `server/scraper-collectors/` producing `RawLeadDoc`; **scraper-pipeline** for filtering, scoring, and producing `ScrapedLead`; legacy **server/scraper.ts** (LLM-based, Manus-era) still present but not used by the main admin “Fetch Leads” flow |
| Deployment | **Railway** (or any Node host); local via `npm run dev` (tsx watch) or `npm run build` + `npm start` |

---

## 3. DATABASE / SCHEMA LOGIC

### Main tables

- **users** — Auth (email/password, OAuth); `role` = `user` | `admin`.
- **artistProfiles** — One per user; stage name, location, genres, budget, equipment, bio, theme, `isPublished` / `isClaimed`.
- **gigLeads** — Central lead table (see below).
- **leadUnlocks** — Which artist unlocked which lead (paid unlock).
- **leadScores** — Per-lead, per-artist scores for ranking.
- **explorerSourceToggles** — Admin toggles for which scraped sources are enabled (reddit, eventbrite, craigslist, dbpr, sunbiz).
- **scraperRuns** — Log of each admin “Fetch Leads” run (counts collected, rejected, inserted).
- **savedSearches**, **explorerPhraseSets** — Admin Leads Explorer saved filters and phrase sets.
- **eventWindows** — Admin-defined event windows (e.g. “Wedding season”) for boost multipliers in the legacy scraper.

### gigLeads — purpose and key fields

**Purpose:** Single table for (1) artist-facing event leads (demand: “need a DJ”, “looking for band”) and (2) admin-only venue intelligence (DBPR/Sunbiz). Visibility is controlled by `source`, `leadType`, `leadCategory`, and `isHidden`.

| Concept | Implementation |
|--------|-----------------|
| **source** | Enum: where the lead came from — e.g. `reddit`, `eventbrite`, `craigslist`, `manual`, `inbound`, `dbpr`, `sunbiz`, `gigxo`. Drives trust/reputation logic and filtering. |
| **leadType** | Enum: `scraped_signal`, `client_submitted`, `venue_intelligence`, `manual_outreach`, `event_demand`, `referral`, `artist_signup`, `outreach`, `trash`, `other`. Venue intel and manual outreach are admin-only. |
| **leadCategory** | Enum: e.g. `general`, `wedding`, `corporate`, `venue_intelligence`, `yacht`, `unknown`. Used with `leadType` to hide venue intel from artists. |
| **venueStatus** | Enum (Venue Intelligence CRM): `NEW`, `CONTACTED`, `FOLLOW_UP`, `MEETING`, `CLIENT`, `IGNORED`. Only relevant for `leadType` = `venue_intelligence`; used on `/admin/venue-intelligence`. |
| **Artist-visible vs admin-only** | Artist-facing queries **exclude** `leadType` in `['venue_intelligence', 'manual_outreach']` and `leadCategory` = `venue_intelligence`, and typically `isHidden = false`. DBPR/Sunbiz rows use `leadType` and `leadCategory` = `venue_intelligence` so they never appear as paid marketplace leads. |
| **Dedupe** | **externalId** is unique (e.g. `reddit-{subreddit}-{id}`, `dbpr-{divisionKey}-{licenseNumber}`). Insert path checks `externalId` and skips or updates instead of duplicating. |

Other important columns: `title`, `description`, `location`, `eventType`, `performerType`, `budget`, `intentScore`, `isApproved`, `isRejected`, `isHidden`, `contactName`, `contactEmail`, `contactPhone`, `venueUrl`; for venue intel also `venueStatus`, `lastContactedAt`, `contactOwner`, `website`, `instagram`, `venuePhone`, `venueEmail`, `notes`.

---

## 4. INGESTION PIPELINE

The **active** path used by the admin “Fetch Leads” button is:

1. **Collectors** (in `server/scraper-collectors/`) — Each enabled source (Reddit, Eventbrite, Craigslist, DBPR, Sunbiz) is called and returns an array of **RawLeadDoc** (see `raw-lead-doc.ts`: `externalId`, `source`, `sourceType`, `title`, `rawText`, `url`, `postedAt`, `city`, `metadata`, etc.).
2. **RawLeadDoc normalization** — Collectors already produce `RawLeadDoc`; pipeline does not re-normalize format, but derives location, contact, and intent from it.
3. **Pipeline filtering** (`server/scraper-collectors/scraper-pipeline.ts`) — For each doc:
   - **Venue intel** (DBPR, Sunbiz): skip intent gate; convert to `ScrapedLead` with `leadType`/`leadCategory` = `venue_intelligence`.
   - **Others:** apply **junk doc** check (URL titles, article/sports/news hiring patterns), **negative keyword** list, and **intent gate** (e.g. must contain DJ-hiring phrases and pass local scoring). Rejected docs are counted (`negativeRejected`, `intentRejected`) and not turned into leads.
4. **Scoring** — **intentScore** is computed **in-pipeline** by rule-based logic (no LLM in this path): base score from phrase match, then adjustments for source, contactability, recency; clamped 0–100. Event type and performer type are classified with local regex/keyword logic.
5. **Insert/upsert** — Admin `runScraper` mutation (in `server/routers.ts`) takes pipeline `leads`, and for each: if `externalId` exists → update (for DBPR) or skip; else insert into `gigLeads`. Duplicates are avoided by `externalId`.

The **legacy** path in `server/scraper.ts` (used by `run-scraper.mjs` or similar scripts) uses Reddit + DuckDuckGo + Quora + Meetup, then **LLM classification** (`classifyWithLLM` → `invokeLLM`). That path is **not** used by the in-app “Fetch Leads” and depends on Manus Forge LLM (see §6 and LLM section below).

---

## 5. ACTIVE COLLECTORS

| Collector | Status | Notes |
|-----------|--------|--------|
| **DBPR** | **Operational** | Fetches CSV from `DBPR_VENUE_CSV_URL` (e.g. FL daily extract). Supports positional column format (no header row). Outputs `RawLeadDoc` with `source`/`leadType`/`leadCategory` = dbpr/venue_intelligence. Insert works once DB has required columns (see §6). |
| **Sunbiz** | **Partially operational / blocked** | Reads from local file at `SUNBIZ_FILE_PATH` (fixed-width). No URL fetch; file must be synced separately. Placeholder/partial parsing; may need correct fixed-width offsets and file availability. |
| **Reddit** | **Operational** | Uses public RSS/JSON (`/new.json`) per subreddit; no API key. Returns `RawLeadDoc`-compatible docs. Filtered by entertainment keywords. |
| **Craigslist** | **Unstable / blocked** | Fetches RSS feeds; often returns **403** from Craigslist. Same pipeline; when fetch fails, 0 docs from this source. |
| **Eventbrite** | **Partially operational** | Fetches HTML from Eventbrite search URLs. Parsing is brittle (HTML structure); may return 0 or few docs. |

Only **reddit**, **eventbrite**, **craigslist**, **dbpr**, **sunbiz** are wired in **source-config** and the pipeline. Toggles are stored in **explorerSourceToggles** (admin UI).

---

## 6. ACTIVE BUGS / CURRENT BLOCKERS

- **DBPR insertion / schema mismatch**  
  - Inserts from the pipeline (and from the DBPR ingestion test script) include every column Drizzle knows (e.g. `status`, `venueStatus`, `notes`, …). If the Railway MySQL schema is behind (e.g. missing `status` or venue CRM columns), inserts fail with “Unknown column 'status' in 'field list'” (or similar).  
  - **Fix:** Run `drizzle/manual-sync-gigleads.sql` on Railway (add `status`, extend `source` enum, add venue columns). Skip any statement that errors because the column/enum already exists.

- **Enum mismatch (e.g. leadType = trash)**  
  - Some DBs were created before `leadType` enum included `trash`. Setting `leadType = 'trash'` then causes “Data truncated for column 'leadType'”.  
  - **Workaround used:** Legacy junk cleanup script only sets `isHidden = true` and does not set `leadType = 'trash'` so no enum change is required.

- **Junk legacy gigxo leads**  
  - Legacy rows with `source = 'gigxo'` included low-quality items (Google RSS, article headlines, sports “hire” noise). A one-off script `scripts/quarantine-legacy-junk-leads.ts` marks matching rows as `isHidden = true`. Pipeline was also updated with a **junk doc** filter (URL titles, article suffixes, sports/news hiring) so similar docs are rejected before becoming leads.

- **AdminVenueIntelligence type error**  
  - `client/src/pages/AdminVenueIntelligence.tsx`: the filter state `venueStatus` is typed as `string` but the tRPC input expects the union `"NEW" | "CONTACTED" | ...`. Causes TypeScript error and can cause build failure until fixed (e.g. type the state as the union or cast when calling the API).

- **Unstable external collectors**  
  - **Craigslist:** 403 from RSS endpoints; effectively blocked.  
  - **Eventbrite:** HTML scraping fragile; often 0 or few results.  
  - **Reddit:** Working; primary source for scraped demand leads.

---

## 7. CURRENT PRODUCT RULES

- **DBPR and Sunbiz are admin-only venue intelligence.** They must **not** appear as artist-paid marketplace leads. In code:
  - Artist-facing lead queries (dashboard, pipeline, drip emails, etc.) **exclude** rows where `leadType` in (`venue_intelligence`, `manual_outreach`) or `leadCategory` = `venue_intelligence`.
  - DBPR (and Sunbiz) rows are stored with `source` = `dbpr`/`sunbiz`, `leadType` = `venue_intelligence`, `leadCategory` = `venue_intelligence`.
- **Venue intel rows** are visible only in admin surfaces (e.g. Leads Explorer with filters, **Venue Intelligence** page at `/admin/venue-intelligence`).
- **Manual outreach** and **venue_intelligence** are treated the same for visibility: hidden from artist-facing flows.

---

## 8. ENVIRONMENT VARIABLES

Variables the repo **actually uses or expects** (from `server/_core/env.ts`, collectors, and auth):

| Variable | Purpose |
|----------|---------|
| **DATABASE_URL** | MySQL connection string (e.g. Railway). Required for app and Drizzle. |
| **JWT_SECRET** | Used as cookie/secret for custom email/password auth and session signing. |
| **DBPR_VENUE_CSV_URL** | URL for DBPR daily CSV. If unset, DBPR collector returns no docs. |
| **SUNBIZ_FILE_PATH** | Path to Sunbiz fixed-width file. Required by Sunbiz collector (throws if unset). |
| **STRIPE_SECRET_KEY** | Stripe API key for payments. |
| **VITE_STRIPE_PUBLISHABLE_KEY** | Stripe publishable key (client). |
| **STRIPE_WEBHOOK_SECRET** | Webhook signing secret. |
| **RESEND_API_KEY** | Resend for transactional email. |
| **BUILT_IN_FORGE_API_URL** | Manus Forge–compatible LLM base URL (e.g. `https://forge.manus.im`). Used by `invokeLLM` when set. |
| **BUILT_IN_FORGE_API_KEY** | API key for that LLM. Used by `invokeLLM`; required for “Generate pitch” and any LLM-based scraper path. |
| **GOOGLE_CLIENT_ID** / **GOOGLE_CLIENT_SECRET** | Optional; for Google OAuth. |
| **OAUTH_SERVER_URL** / **OWNER_OPEN_ID** / **VITE_APP_ID** | Legacy Manus OAuth; may still be read. |
| **PORT** | Server port (default 3000). |
| **NODE_ENV** | `development` | `production`. |

---

## 9. DEPLOYMENT

- **Local**
  - Install: `pnpm install` (or npm).
  - Env: copy `.env.example` to `.env` and set at least `DATABASE_URL`, `JWT_SECRET`; optionally Stripe, Resend, DBPR URL, Sunbiz path, Forge if using LLM features.
  - Dev: `npm run dev` (tsx watch on `server/_core/index.ts`; Vite dev server for client via same process or proxy).
  - DB: Run migrations or `drizzle-kit push`; if push fails or DB is older, run `drizzle/manual-sync-gigleads.sql` manually.
  - Type-check: `npm run check` or `npx tsc --noEmit`.

- **Railway (or similar)**
  - Build: `npm run build` (Vite client + esbuild server bundle to `dist/`).
  - Start: `npm start` → `NODE_ENV=production node dist/index.js`.
  - Set env vars in Railway (at least `DATABASE_URL`, `JWT_SECRET`; then Stripe, Resend, DBPR, etc.). Run manual-sync SQL once against Railway MySQL if the schema is missing columns.
  - No Procfile/nixpacks found in repo; use Node buildpack and start command above.

---

## 10. NEXT 3 STEPS (RECOMMENDED)

1. **Fix DB schema on Railway** — Run `drizzle/manual-sync-gigleads.sql` so all current insert columns exist (e.g. `status`, venue CRM columns, `source` enum). Fix any remaining enum mismatches (e.g. add `trash` to `leadType` if desired) so inserts and updates never hit “Unknown column” or “Data truncated”.
2. **Fix AdminVenueIntelligence TypeScript** — Type the `venueStatus` filter state as the enum union (or narrow when passing to tRPC) so `npm run check` passes and the admin Venue Intelligence page is stable.
3. **Restore or replace LLM intent classification** — The active “Fetch Leads” path uses only rule-based intent; no LLM. Either wire a new LLM provider into the pipeline for intent scoring, or formally adopt and tune the rule-based + junk filters so product behavior is clear and junk (e.g. “UCLA hires coach”, “DJ Khaled net worth”) stays out. See critical LLM section below.

---

## CRITICAL: LLM SCORING GAP

### Where LLM was used

- **server/scraper.ts** — `classifyWithLLM()` calls `invokeLLM()` with a structured prompt and output schema to get `intentScore`, `isRealEventNeed`, performer type, extracted date/city/budget/contact, refined title/description. That classification is used when running the **legacy** full scrape (e.g. via `run-scraper.mjs`), which uses Reddit + DuckDuckGo + Quora + Meetup and then batch LLM classification.
- **server/routers.ts** — **generatePitch** mutation uses `invokeLLM()` to generate a short pitch for an artist to send to a lead. This is the only LLM call in the **current** in-app flow; it requires `BUILT_IN_FORGE_API_KEY` (and optionally `BUILT_IN_FORGE_API_URL`).

### What replaced LLM in the active pipeline

- The **admin “Fetch Leads”** flow does **not** use `server/scraper.ts` or any LLM. It uses **server/scraper-collectors/scraper-pipeline.ts** only, which:
  - Applies a **junk doc** check (URL titles, article/sports/news hiring),
  - Uses **negative keyword** lists and **intent gate** (e.g. DJ-hiring phrases + local score),
  - Computes **intentScore** with **rule-based** logic (phrase match → 80, then +/- for source, contact, recency),
  - Classifies event type and performer type with **regex/keyword** in the pipeline.

So **intentScore is still calculated**, but by **rules only** — no LLM in this path.

### DuckDuckGo, Quora, Meetup

- **Survived in code** in `server/scraper.ts` and in `server/scraper-collectors/quora.ts`, `meetup.ts`, and the DuckDuckGo function inside `scraper.ts`.
- They are **not** in the active pipeline. The pipeline only uses collectors from **source-config**: Reddit, Eventbrite, Craigslist, DBPR, Sunbiz. So **DuckDuckGo, Quora, and Meetup are not used** when an admin clicks “Fetch Leads”; they only run if the legacy `runFullScrape()` in `server/scraper.ts` is invoked (e.g. via `run-scraper.mjs`).
- That legacy path also calls **LLM** for classification. Without a working Forge/LLM config (`BUILT_IN_FORGE_API_URL` / `BUILT_IN_FORGE_API_KEY`), that path would either throw on `invokeLLM` or fall back to a fixed keyword-only score (e.g. 40) for every doc, so **no intelligent filtering** in that path either.

### Why junk leads appeared

- With **no LLM** in the active pipeline, filtering relies on:
  - Junk doc patterns (URL titles, article/sports hiring),
  - Negative keyword list (e.g. khaled, nfl, coach, net worth),
  - Intent gate requiring DJ-hiring phrases and a minimum score.
- If those rules were missing or loose, or if legacy data came from the old LLM-based scraper before it broke, leads like “UCLA hires football coach” or “DJ Khaled net worth” could have been approved. The recent addition of **isJunkDoc** and the **quarantine-legacy-junk-leads** script is intended to prevent and clean such noise.

### Summary

- **CRITICAL GAP:** The only path that inserts leads from the UI (**Fetch Leads** → `runScraperPipeline`) does **not** use any LLM. Intent is rule-based only. So “intelligent” filtering is limited to keyword/phrase and heuristic rules. Restoring or replacing LLM-based intent classification (in pipeline or in a separate step) would be a high-priority improvement to reduce junk and improve lead quality.
