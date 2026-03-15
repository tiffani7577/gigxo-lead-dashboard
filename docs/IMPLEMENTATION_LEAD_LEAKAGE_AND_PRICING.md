# Implementation: Lead Leakage Fix & Pricing Control

**Source:** `docs/ARCHITECTURE_CLARIFICATION.md`  
**Date:** March 2025

---

## Files changed

| File | Change |
|------|--------|
| `server/routers.ts` | **Lead leakage:** In `leads.getAvailable`, when the user has not unlocked a lead, response now masks `title` → "Event lead", `location` → "Location locked", `description` → "Details available after unlock", `venueUrl` → null. Same masking applied in `leads.getById` when not unlocked. **Pricing:** `admin.setLeadPrice` now accepts optional `clearOverride: true`; when set, `unlockPriceCents` is set to `null` (revert to auto $7/$15). |
| `client/src/pages/AdminDashboard.tsx` | **Pricing:** When a lead has a custom price override (`unlockPriceCents != null`), added a "Use auto" button next to the price badge that calls `setLeadPrice({ leadId, clearOverride: true })` so admins can revert to budget-based pricing. |

---

## Per-lead price override: editable in admin?

**Yes.** Per-lead unlock price was already editable in the admin UI and remains so:

- **Where:** Admin Dashboard (main `/admin` view), on each lead card in the lead list.
- **How:** Click the price badge (e.g. "$7" or "$15") to open an inline input, enter a dollar amount (1–999), click "Set". This calls `admin.setLeadPrice({ leadId, priceDollars })` and stores it in `gigLeads.unlockPriceCents`.
- **Improvement:** When a lead has a custom override, a **"Use auto"** button is now shown next to the price. Clicking it calls `setLeadPrice({ leadId, clearOverride: true })`, which sets `unlockPriceCents` to `null` so the lead again uses the global rule ($7 standard / $15 premium by budget).

Global pricing logic is unchanged: $1 first unlock, $7 standard, $15 premium, admin override wins when set.

---

## Lead leakage: fixed?

**Yes.** For artist-facing lead responses only:

- **When the user has not unlocked the lead:**  
  `title`, `location`, `description`, and `venueUrl` are no longer returned with real values. They are replaced with:
  - `title`: `"Event lead"`
  - `location`: `"Location locked"`
  - `description`: `"Details available after unlock"`
  - `venueUrl`: `null`
- **Contact fields** remain masked as before (`contactName` → "Contact info locked", `contactEmail`/`contactPhone` → null when locked).
- **When the user has unlocked the lead:** Full lead data (title, location, description, venueUrl, contact) is returned unchanged.
- **Admin-facing responses** (e.g. `admin.getLeadsExplorer`, `admin.getVenueIntelligenceLeads`, `admin.getPendingLeads`) are unchanged and still return full lead data.
- **Schema:** No schema changes; masking is done only in the artist-facing API response mapping.

---

## How to test safely (including production)

### 1. Lead leakage (artist-facing)

- **As an artist (non-admin) user who has not unlocked a lead:**
  - Call or use the UI that calls `leads.getAvailable` or `leads.getById` for a lead you have not unlocked.
  - **Expect:** For that lead, `title` is "Event lead", `location` is "Location locked", `description` is "Details available after unlock", `venueUrl` is null. Other fields (e.g. budget, eventType, eventDate) remain as-is; contact fields remain masked.
- **As the same user after unlocking that lead:**
  - Call `leads.getById` (or the same list from `getAvailable`).
  - **Expect:** Full title, location, description, venueUrl, and contact for that lead.
- **As an admin:** Use admin Lead Explorer or Dashboard; **expect** full title, location, description, venueUrl on all leads (no masking in admin APIs).

### 2. Pricing control (admin)

- **Set custom price:** In Admin Dashboard, pick a lead, click its price badge (e.g. "$7"), enter a value (e.g. 10), click "Set". **Expect:** Badge shows the new price (e.g. "$10"); unlocking that lead charges $10 (or uses credits) per existing payment flow.
- **Revert to auto:** For a lead that has a custom price, click **"Use auto"** next to the badge. **Expect:** Badge shows "$7" (or "$15" for high-budget leads); price for that lead again follows the global rule.
- **Global logic:** Ensure a new user’s first unlock is $1; subsequent unlocks use $7 / $15 by budget (or admin override when set). No change from previous behavior.

### 3. Safe production rollout

- **Deploy:** Deploy the changed `server/routers.ts` and `client/src/pages/AdminDashboard.tsx`; no DB migrations.
- **Smoke test:** Log in as an artist, open the lead list and a locked lead detail; confirm masked placeholders. Unlock a lead and confirm full data. Log in as admin, confirm full data in Explorer/Dashboard and test "Set" and "Use auto" on one lead.
- **Rollback:** Revert the two file changes if needed; behavior reverts to previous (no masking of title/location/description/venueUrl; no "Use auto" and no `clearOverride` in `setLeadPrice`).

---

*End of implementation summary.*
