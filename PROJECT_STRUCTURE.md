# Gigxo project structure — data flow, pages, monetization

## DBPR → database (liquor / venue intelligence)

1. **`server/scraper-collectors/dbpr-collector.ts`** — Fetches Florida DBPR **`daily.csv`** (positional columns). Filters: liquor license tokens, South Florida county names, staleness window. Emits **`RawLeadDoc`** (`sourceType: "dbpr"`, `metadata.leadCategory` / `leadType` venue intelligence).
2. **`server/scraper-collectors/scraper-pipeline.ts`** — `collectFromDbpr()` is wired into **`runScraperPipeline`**. Venue-intel docs **bypass** the Reddit/Craigslist negative-keyword and intent gates. **`rawLeadDocToLead()`** sets marketplace fields and now splits:
   - **Contact present (email or phone)** → `leadType: "manual_outreach"`, `leadCategory: "venue_intelligence"`, `isApproved: true` (Outreach Hub queue).
   - **Otherwise** → `leadType: "venue_intelligence"` (admin CRM + optional artist subscription feed).
3. **Insert paths**
   - **`admin.runDbprPipeline`** (`server/routers.ts`) — Inserts DBPR rows only (`isApproved: true`), triggers **`contact-enrichment`** (Google Places + optional website email).
   - **`admin.runScraper`** — **Strips `source === "dbpr"`** from the batch before insert; DBPR is intentionally separated so the main scraper does not double-insert.
   - **`server/dripCron.ts`** — Optional Monday DBPR job; same pattern as `runDbprPipeline`.
4. **Enrichment** — **`server/scraper-collectors/contact-enrichment.ts`** — After phone/email is found, promotes `venue_intelligence` → **`manual_outreach`** when appropriate so rows move into the Outreach Hub queue.

**Important:** DBPR has **no HTML selectors**. “Menu” junk does **not** come from DBPR parsing; it comes from **other sources** (see § Scraper diagnosis below).

---

## General scraper → `gigLeads` (event / gig leads)

1. **`runScraperPipeline`** collects Reddit, Eventbrite, Craigslist, Sunbiz, Apify, enabled by **`server/scraper-collectors/source-config.ts`**.
2. Non–venue-intel docs pass **`isJunkDoc`**, **`NEGATIVE_KEYWORDS`** / **`GEAR_SOFTWARE_NEGATIVE_KEYWORDS`**, intent gate, geo/tier rules.
3. **Tier 1** (contact + thresholds) → may auto-`isApproved`.
4. **Tier 2** (high intent, allowed source, weak contact) → `isApproved: false`, `notes: needs_enrichment` → shows under admin **Marketplace** tab as **pending**.
5. **`server/routers.ts` `runScraper`** persists rows (not DBPR) with `insertData` including `leadType`, `isApproved`, `regionTag`, etc.

---

## Lead routing surfaces (admin)

| Surface | Path | Purpose |
|--------|------|---------|
| Admin overview | `/admin` | High-level stats, DBPR/venue status. |
| Queue / routing | `/admin/queue` (`AdminDashboard`) | **Marketplace** pod: pending/approved artist-facing leads. **Venue Intelligence** pod: `leadType === venue_intelligence` only (research / no outreach queue). **Growth / CRM** pod: all types including `manual_outreach`. |
| Venue Intelligence CRM | `/admin/venue-intelligence` | `getVenueIntelligenceLeads`: **`leadType === venue_intelligence`** — DBPR/Sunbiz/Maps **without** relying on manual_outreach. |
| Outreach Hub | `/admin/outreach-hub` | `getNextOutreachVenue`: sources `dbpr` / `sunbiz` / `google_maps`, **has `contactEmail`**, `outreachStatus === not_sent`, `leadType` in `manual_outreach` **or** legacy `venue_intelligence` with email. |
| Leads explorer | `/admin/leads-explorer` | Advanced filters, bulk actions, outreach email. |
| Scraper config | `/admin/scraper-config` | Source toggles, run scraper / DBPR. |
| Live lead search | `/admin/live-lead-search` | On-demand search pipeline. |

---

## Monetization triggers (summary)

- **Artist unlock** — `leadType` in artist-visible set; `payments.createPaymentIntent` / **`confirmPayment`** reject `venue_intelligence` and `manual_outreach`. Revenue: **`leadUnlocks`** + Stripe PaymentIntent (**`server/stripe.ts`**, webhook **`server/stripeWebhook.ts`**).
- **Venue intelligence (B2B)** — Internal ops: Outreach Hub emails, **`leadMonetizationType`** (e.g. `venue_outreach`), CRM fields (`venueStatus`, `outreachStatus`). Artist-facing SKU: **`venueIntel.getSubscriptionEligibility`** (active **premium** subscription) + **`venueIntel.getVenues`** — only rows with **`subscriptionVisibility === true`** and **`leadType === venue_intelligence`**.
- **Credits / Pro** — **`Pricing`**, **`SharePage`** referrals; **`subscriptions`** table for premium tier.
- **Inbound / SEO** — **`server/routers/inbound.ts`**, **`RequestEntertainment`**, **`SEOLandingPage`** slugs → leads with `leadType: client_submitted` etc.

---

## Artist-facing pages (selected)

| Route | Purpose |
|-------|---------|
| `/` | Home |
| `/signup`, `/login` | Auth; **no** venue-intel upsell wired here by default |
| `/dashboard` | **ArtistDashboard** — browse/unlock **non–venue-intel** leads; **Venue Intel** nav link → **`/venue-intel`** (see gap below) |
| `/pipeline` | Kanban for unlocked / booked |
| `/pricing`, `/share` | Monetization |
| `/artists`, `/artist/:slug` | Directory / public profile |
| `/book`, `/request-entertainment` | Client demand capture |
| `/:slug` | **SEOLandingPage** (SEO) — **matches before a dedicated `/venue-intel` page if that route is missing** |

---

## Scraper diagnosis: why “menu” content appears

- **DBPR** uses **CSV column indices** (`POS` in `dbpr-collector.ts`), not DOM selectors. It does **not** scrape restaurant menus.
- **Negative keywords** such as **`menu`**, **`chef`**, etc. live in **`scraper-pipeline.ts`** and apply to **non–venue-intel** docs (Reddit/Craigslist/Apify text). They **do not** run on the DBPR branch (venue intel short-circuits before `hasNegativeKeyword`).
- **Typical causes of “menu-like” rows in pending:** Tier **2** **`scraped_signal`** posts (Craigslist/Reddit) that **slipped past** substring filters, or **false negatives** (e.g. phrase shape doesn’t match `normalizeText` + `includes`). Those land as **`isApproved: false`** → **Marketplace pending**, not DBPR.

---

## Revenue disconnect: Venue Intelligence vs artist signup

- **Backend** sells venue intel via **`subscriptions`** (premium) and **`venueIntel.getVenues`**.
- **ArtistDashboard** shows **Venue Intel** only if **`venueIntel.getSubscriptionEligibility`**, linking to **`/venue-intel`**.
- **`App.tsx` does not define `/venue-intel`**; the link likely falls through to **`SEOLandingPage`** (`/:slug`), which is the wrong experience and breaks the product story between signup and venue data.

---

## Files touched by venue routing fix (reference)

- `server/scraper-collectors/scraper-pipeline.ts` — `manual_outreach` vs `venue_intelligence` for venue-intel sources.
- `server/scraper-collectors/contact-enrichment.ts` — Promote to `manual_outreach` after enrichment adds contact.
- `server/routers.ts` — Outreach Hub queue sources + `leadType` filter.
- `client/src/pages/AdminDashboard.tsx` — Venue pod lists research leads only; badge for Outreach Hub type.
- `client/src/pages/AdminOutreachHub.tsx` — Copy updated for multi-source queue.
