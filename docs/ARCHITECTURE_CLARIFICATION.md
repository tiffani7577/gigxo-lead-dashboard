# Gigxo Architecture Clarification

**Source of truth:** `docs/ARCHITECTURE_AUDIT_REPORT.md`  
**Scope:** Read-only. No code modified.

---

## 1. Venue Intelligence (DBPR)

### How DBPR venue intelligence flows through the system

1. **Ingestion**
   - **Collector:** `server/scraper-collectors/dbpr-collector.ts` reads a CSV from the env var `DBPR_VENUE_CSV_URL`.
   - Supports two CSV shapes: (a) header-based (e.g. DBA, License Number, Location City), (b) positional FL daily extract (division, county, license#, class, DBA, entity, address, city, state, zip, date, description).
   - Each row is normalized to a `RawLeadDoc` with `source: "dbpr"`, `sourceType: "dbpr"`, and metadata `leadCategory: "venue_intelligence"`, `leadType: "venue_intelligence"` (or `"venue"` in header path).

2. **Pipeline → storage**
   - The scraper pipeline (e.g. `server/scraper.ts` / pipeline that consumes collectors) converts `RawLeadDoc` to lead rows and writes to the **same** `gigLeads` table.
   - **externalId:** `dbpr-{divisionKey}-{licenseNumber}` (divisionKey normalized for uniqueness).
   - **Upsert:** When inserting, if `existing.externalId.startsWith("dbpr-")` the row is **updated** instead of inserted, so DBPR rows are deduplicated by license.

3. **Separation from artist-facing leads**
   - **Query-level exclusion:** Artist-facing APIs explicitly exclude venue intelligence so these rows are never returned to artists:
     - **`leads.getAvailable`** (`server/routers.ts`): `artistVisibleLead` requires `leadType` not in `["venue_intelligence", "manual_outreach"]` and `leadCategory` not `"venue_intelligence"`.
     - **`leads.getById`**: If `leadType === "venue_intelligence"` or `leadCategory === "venue_intelligence"` (or `manual_outreach`), returns **NOT_FOUND** (lead not exposed at all).
   - **Payment/unlock:** `payments.createPaymentIntent` and `payments.confirmPayment` reject with "Lead not available" when the lead’s `leadType` or `leadCategory` is `venue_intelligence` or `manual_outreach`.
   - So DBPR rows live in `gigLeads` but are **invisible** to the artist lead marketplace; they are admin-only.

4. **Admin APIs that expose venue intelligence**

   - **`admin.getVenueIntelligenceLeads`**  
     - **File:** `server/routers.ts` (under `admin` router).  
     - **Guard:** `if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" })`.  
     - **Query:** `gigLeads` where `leadType === "venue_intelligence"`.  
     - **Filters:** venueStatus, city, licenseType, searchText, leadMonetizationType, outreachStatus, venueClientStatus, subscriptionVisibility, regionTag.  
     - **Returns:** id, externalId, title, location, intentScore, venueStatus, lastContactedAt, contact fields, venueEmail, venuePhone, venueUrl, notes, sourceLabel, monetization/outreach columns.

   - **`admin.getLeadsExplorer`**  
     - **File:** `server/routers.ts` (under `admin` router).  
     - **Guard:** Same `role !== "admin"` → FORBIDDEN.  
     - **Query:** Paginated `gigLeads` with filters (sources, location, performerType, minIntentScore, status, date range, searchText, leadType, leadCategory, contact filters, etc.).  
     - **Returns:** Full lead rows (including venue_intelligence) for admin review; used by Lead Explorer UI.

   - **`admin.updateVenueStatus`** (and related admin update procedures)  
     - Used to update venue CRM state on venue_intelligence rows; all behind the same admin role check.

   - Other admin-only procedures (e.g. `getPendingLeads`, `getAllLeads`, `runScraper`, `getScraperRunHistory`, etc.) also enforce `ctx.user?.role !== 'admin'` and can touch or list all leads, including DBPR.

**Summary:** DBPR data flows CSV → dbpr-collector → pipeline → `gigLeads` (same table). Separation is by **leadType** / **leadCategory** in every artist-facing and payment path; only admin procedures with an explicit role check expose venue intelligence.

---

## 2. Lead Leakage

### Where lead identity may leak before purchase (from audit)

- **Title:** Often contains event or venue name (e.g. "Wedding at XYZ Venue"). Returned in full by `leads.getAvailable` and `leads.getById` before unlock.
- **Location:** City/address/venue location. Returned in full before unlock; can identify a venue or area.
- **Description:** Free text that may name the venue, client, or event details. Returned in full before unlock.
- **venueUrl:** Returned before unlock; can identify a business or venue.
- **Other:** budget, eventType, eventDate, performerType, etc., are also visible; identity risk is highest from title, location, description, and venueUrl.

Only **contactName**, **contactEmail**, and **contactPhone** are masked (e.g. "Contact info locked", null) when the user has not unlocked the lead.

### Safest minimal change to prevent venue identification before unlock (proposal only; no rewrite of lead system)

- **Goal:** Avoid revealing venue (or client) identity until after unlock, with minimal change to the existing lead model.
- **Approach:** Extend the **same masking pattern** already used for contact fields: for ununlocked leads, do not return identifying text in title, location, description, or venueUrl to the artist-facing API responses.

**Concrete minimal change (conceptual):**

1. **Server response shape (artist-facing only)**  
   In the procedures that return lead data to artists (e.g. `leads.getAvailable`, `leads.getById`), when `!unlocked`:
   - **title:** Replace with a generic placeholder (e.g. "Event lead" or a redacted variant that keeps only non-identifying info such as event type + budget band + city **if** city is considered non-identifying; otherwise omit or generalize).
   - **location:** Replace with a coarse value (e.g. city/region only, or "Location locked") so that address/venue name is not exposed.
   - **description:** Replace with a short generic line (e.g. "Details available after unlock") or null; do not send raw description.
   - **venueUrl:** Return null or a generic placeholder when not unlocked.

2. **Scope**
   - Apply only in the **response mapping** of artist-facing procedures (getAvailable / getById). No change to DB schema or to how leads are stored; no change to admin APIs, which may continue to see full data.
   - After unlock, return the same full title, location, description, venueUrl as today.

3. **Backward compatibility**
   - Listing and detail views will show generic text until unlock; clients that rely on title/location/description for display will show placeholders until the user unlocks. This is the minimal, safest way to prevent venue identification before purchase without redesigning the lead system.

---

## 3. Pricing Logic

### Implementation

- **$1 first unlock**  
  - **Constant:** `FIRST_UNLOCK_PRICE_CENTS = 100` in `shared/leadPricing.ts`.  
  - **Enforcement:** In `server/routers.ts`, `payments.createPaymentIntent`: if `!ctx.user.hasUsedFreeTrial`, the procedure creates a PaymentIntent for `FIRST_UNLOCK_PRICE_CENTS` (100) and returns `isFirstUnlock: true`.  
  - **After first unlock:** On successful payment confirmation, `payments.confirmPayment` (and webhook path) sets `users.hasUsedFreeTrial = true` for that user, so subsequent unlocks use standard/premium pricing.

- **$7 standard lead**  
  - **Logic:** In `shared/leadPricing.ts`, `getLeadUnlockPriceCents(budgetCents, unlockPriceCentsOverride)` returns **700** when there is no admin override and budget is under $1,500 (under `PREMIUM_THRESHOLD_CENTS = 150_000`).  
  - **Used in:** `server/routers.ts` in `payments.createPaymentIntent` (for non–first-unlock price) and in `payments.confirmPayment` when validating amount (expected price for non–first-unlock comes from `getLeadUnlockPriceCents`).  
  - **Fallback constant:** `server/stripe.ts` exports `LEAD_UNLOCK_PRICE_CENTS = 700` for legacy/backup use; the source of truth for $7 standard is `getLeadUnlockPriceCents` in `shared/leadPricing.ts`.

- **$15 premium lead**  
  - **Logic:** In `shared/leadPricing.ts`, when `budgetCents >= PREMIUM_THRESHOLD_CENTS` (150_000) and there is no admin override, `getLeadUnlockPriceCents` returns **1500** ($15).  
  - **Enforcement:** Same call sites as $7; no separate code path, only the budget threshold.

- **Admin override**  
  - If the lead has `unlockPriceCents` set and &gt; 0, `getLeadUnlockPriceCents` returns that value and ignores budget tier.

### Files that enforce these rules

| Rule | Primary file(s) |
|------|------------------|
| $1 first unlock | `shared/leadPricing.ts` (constant); `server/routers.ts` (`createPaymentIntent`: check `hasUsedFreeTrial`, use `FIRST_UNLOCK_PRICE_CENTS`; `confirmPayment`: set `hasUsedFreeTrial`) |
| $7 / $15 tier | `shared/leadPricing.ts` (`getLeadUnlockPriceCents`, `PREMIUM_THRESHOLD_CENTS`); `server/routers.ts` (`createPaymentIntent`, `confirmPayment` use `getLeadUnlockPriceCents`) |
| Override | `shared/leadPricing.ts` (`getLeadUnlockPriceCents` takes `unlockPriceCentsOverride`); admin sets `gigLeads.unlockPriceCents`; routers pass it into `getLeadUnlockPriceCents` |

---

## 4. SEO Page Generation

### Confirmation: new SEO pages should reuse `SEOLandingPage.tsx`

- **Yes.** The app uses a **single template**, `client/src/pages/SEOLandingPage.tsx`, for all SEO landing pages.  
- **Routing:** In `client/src/App.tsx`, a single dynamic route `/:slug` renders `SEOLandingPage`. The `slug` is the path segment (e.g. `dj-miami`, `yacht-dj-fort-lauderdale`).  
- **Config:** `SEOLandingPage` gets content from `client/src/lib/seoConfig.ts`: it uses `parseSlug(slug)` to get `{ serviceId, cityId }`, then `generatePageConfig(serviceId, cityId)` to get a `PageConfig`. Optional overrides come from `MANUAL_OVERRIDES[slug]` (merged in `generatePageConfig`).  
- **Slug semantics:** Slugs are **serviceId-cityId** (e.g. `dj-miami`, `wedding-dj-miami`). `parseSlug` matches the longest `SERVICE.id` prefix such that the remainder is a valid `CITY.id`; that drives which config is used.

### Cleanest way to generate new pages with the existing template

1. **New service + city combination (recommended)**  
   - Add a **service** to `SERVICES` and/or a **city** to `CITIES` in `seoConfig.ts`.  
   - `generateAllPageConfigs()` already iterates over `SERVICES × CITIES` and builds a config for each `serviceId-cityId` slug; no change to `SEOLandingPage.tsx` or routing.  
   - Optionally add an entry in **`MANUAL_OVERRIDES`** for that slug (e.g. `"new-service-miami"`) to set `seoTitle`, `seoDescription`, `heading`, `subheading`, `content`, `pageType`, `calculatorVariant`, `faq`, etc., so the new page uses the same template with custom copy and behavior.

2. **New one-off or custom slug**  
   - The current design assumes **slug = serviceId + "-" + cityId**. For a slug that does not follow that pattern (e.g. a single keyword or custom URL):
     - **Option A:** Add a **pseudo-service** or **pseudo-city** in `seoConfig.ts` so that the desired URL becomes a valid `serviceId-cityId` (e.g. service `"corporate-events"` and city `"miami"` → slug `corporate-events-miami`), then use `MANUAL_OVERRIDES` for that slug.  
     - **Option B:** Extend `seoConfig.ts` to support a **standalone slug → PageConfig** map (or a list of “custom slugs” that resolve to a config without going through `parseSlug`). `SEOLandingPage` would then need a small change to resolve config by slug from that map when `parseSlug(slug)` returns null.

3. **Sitemap / static generation**  
   - Use `getAllPageSlugs()` (and any custom slugs if Option B is added) to drive sitemap or static generation; all such pages are still rendered by the same `SEOLandingPage` component and config.

**Summary:** New SEO pages should reuse `SEOLandingPage.tsx`. The cleanest approach is to add entries to `SERVICES`/`CITIES` (and optionally `MANUAL_OVERRIDES`) in `seoConfig.ts` so new slugs are generated from the existing service×city matrix; for custom slugs, add a pseudo service/city or a dedicated slug→config path in config and, if needed, in the page’s config resolution.

---

## 5. Admin Security

### Confirmation: admin dashboard restricted to `role === 'admin'`

- **Backend:** Every admin procedure under the `admin` router in `server/routers.ts` explicitly checks `ctx.user?.role !== 'admin'` (or `!== "admin"`). On failure they throw (e.g. `throw new Error("Unauthorized")` or `throw new TRPCError({ code: "FORBIDDEN" })`). So the admin API is restricted to users with `users.role = 'admin'`.  
- **Frontend:** `client/src/components/DashboardLayout.tsx` treats any path starting with `/admin` as an admin route. If `user.role !== "admin"`, it renders a **403 Forbidden** view and a “Go to My Dashboard” link instead of the admin content. So even if a non-admin knows the URL, they cannot use the admin UI.  
- **Auth context:** User and role come from the same session (e.g. `server/_core/context.ts` loads user including `role`; `customAuth` provides `hasUsedFreeTrial` etc.).  

**Conclusion:** The admin dashboard and admin APIs are restricted to `role === 'admin'`; there is no route-only protection—both API and UI enforce the role.

---

## 6. Venue Intelligence as a Future Product

### Can the DBPR dataset be exposed as a separate product without breaking the lead marketplace?

- **Yes, with the current architecture.**  
  - Artist-facing lead flows are already isolated from venue intelligence by **leadType** and **leadCategory**: `getAvailable`, `getById`, and payment/unlock paths all exclude `venue_intelligence` (and `manual_outreach`).  
  - DBPR rows are stored in `gigLeads` but are **never** returned or unlockable in the artist lead product.  
  - A future “venue intelligence” product can expose the same rows through:
    - **Separate API procedures** that query `gigLeads` with `leadType === 'venue_intelligence'` (and optionally `subscriptionVisibility` or other flags), with their own auth and entitlement (e.g. subscription or one-time purchase).
    - **Separate UI** (e.g. a “Venue Pro” or “Venue Intel” area) that calls only those procedures, not the artist `leads.*` or `payments.createPaymentIntent` for artist leads.

- **What to avoid**  
  - Do not add venue_intelligence rows to artist-facing `leads.getAvailable` / `getById` or to the artist lead unlock flow.  
  - Do not reuse the same payment intent type or product as “artist lead unlock” for venue intel access without clearly separating which lead types are being unlocked (so that DBPR never becomes unlockable as an artist lead).

- **Optional hardening**  
  - If desired, introduce a separate “product” or “entitlement” (e.g. “venue_intel_access”) and gate the new venue-intel API on that entitlement, while keeping artist lead unlock tied to `leadUnlocks` + artist-visible leads only. The current schema and role separation already support this.

**Summary:** The DBPR dataset can be safely exposed as a future product (separate APIs and UI for venue intelligence) without breaking the existing lead marketplace, as long as artist-facing queries and payment flows continue to exclude `venue_intelligence` and any new monetization for venue intel is implemented on separate procedures and products.

---

*End of clarification. No code was modified.*
