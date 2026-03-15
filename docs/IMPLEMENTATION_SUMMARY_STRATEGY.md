# Implementation Summary: Product Strategy

**Scope:** Fixes and enhancements on top of current Gigxo system. No architecture redesign.

---

## 1. Summary of Files Changed

| File | Change |
|------|--------|
| **client/src/pages/ArtistProfile.tsx** | Min Budget: string state + onBlur so user can clear and re-enter. Max Travel: same pattern. Both values now sent in handleSave. Added profile image upload (file picker + Upload button), `uploadProfileImage` mutation, display of `profileImageUrl` \|\| photoUrl \|\| avatarUrl. |
| **client/src/pages/AdminDashboard.tsx** | Lead tier: added `leadTier` to edit form state, openEditModal, handleSaveEdit; added Lead tier dropdown in edit modal; added tier badge on lead cards (Starter / Standard / Premium). |
| **client/src/pages/SEOLandingPage.tsx** | `leads.getPublicSummary` query for SEO pages; display “X gigs in this area” when count > 0. |
| **client/src/lib/seoConfig.ts** | New services: `band`, `dj-gigs`, `venues-hiring-djs`. New manual overrides: `dj-orlando`, `band-miami`, `dj-gigs-miami`, `venues-hiring-djs-miami`. |
| **server/routers.ts** | Artist: `upsertMyArtistProfile` accepts `minBudget`, `maxDistance`, `profileImageUrl`. New `artist.uploadProfileImage` (base64 → storage, update profile). Admin: `updateLead` accepts `leadTier`. Payments: call `ensureProMonthlyCredits` before credit check. New `leads.getPublicSummary` (location/serviceHint → count + teasers). Outreach: `sendOutreach` / `sendOutreachBulk` accept `venue_outreach`, `performer_outreach`; pass extra vars to `renderOutreachTemplate`. |
| **server/proCredits.ts** | New: `ensureProMonthlyCredits(userId, db)` — grants up to 5 × $7 credits per billing period for active Pro (premium) subscribers. |
| **server/outreachTemplates.ts** | New templates: `venue_outreach` (DBPR-style, [VENUE_NAME], [CITY], [OWNER_NAME], [PLATFORM_LINK]), `performer_outreach` ([ARTIST_NAME], [CITY], [LINK]). Extended `renderOutreachTemplate` with `OutreachTemplateVars` and [PLACEHOLDER] replacement. |
| **drizzle/schema.ts** | `gigLeads`: added `leadTier` enum (`starter_friendly`, `standard`, `premium`). `artistProfiles`: added `profileImageUrl` (text). `userCredits.source`: added `pro_monthly`. |
| **drizzle/0021_lead_tier.sql** | Add `leadTier` column to `gigLeads`. |
| **drizzle/0022_user_credits_pro_monthly.sql** | Extend `userCredits.source` enum to include `pro_monthly`. |
| **drizzle/0023_artist_profile_image_url.sql** | Add `profileImageUrl` to `artistProfiles`. |
| **scripts/promote-admins.mts** | New script: promote both `teryn@gigxo.com` and `pearlleashworldwide@gmail.com` to admin. |

---

## 2. Migration Steps (DB Schema)

Run in order (after backup):

1. **Lead tier**
   ```bash
   mysql -u ... -p ... < drizzle/0021_lead_tier.sql
   ```

2. **Pro monthly credits**
   ```bash
   mysql -u ... -p ... < drizzle/0022_user_credits_pro_monthly.sql
   ```

3. **Profile image URL**
   ```bash
   mysql -u ... -p ... < drizzle/0023_artist_profile_image_url.sql
   ```

Or run your usual migration runner if it picks up the `drizzle/*.sql` files.

---

## 3. Admin Usage Instructions

### Lead tier tagging

- **Where:** Admin Dashboard → lead list → each lead card shows a tier badge when set (Starter / Standard / Premium). Edit modal has a **Lead tier** dropdown.
- **How:** Open **Edit** on a lead → set **Lead tier** to **Starter friendly**, **Standard**, or **Premium** (or leave **—** to clear) → Save.
- **Meaning:** Informational only (not pricing). Use **Starter friendly** for small/new venues and lower-budget gigs, **Standard** for typical gigs, **Premium** for high budget or high visibility.

### Subscription credits (Pro)

- **Behavior:** Users with an active **Pro** subscription (tier = premium, status = active) receive **5 unlock credits per billing period**. Credits are applied automatically when they try to unlock a lead (before charging Stripe).
- **Admin:** No admin UI to “grant” Pro credits; they are granted by the system when a Pro user hits the unlock flow and the period has not yet been granted. Ensure Stripe subscription webhooks set `subscriptions.tier = 'premium'` and `currentPeriodStart` / `currentPeriodEnd` so the logic can see the current period.
- **$49/mo:** Configure the Pro product in Stripe at $49/month; the code uses existing `subscriptions` and `userCredits` (source `pro_monthly`).

### Email templates

- **Venue outreach (DBPR):** In Venue Intelligence (or Lead Explorer), when sending outreach, choose template **“Venue outreach (DBPR)”**. Placeholders: `[VENUE_NAME]`, `[CITY]`, `[OWNER_NAME]`, `[PLATFORM_LINK]` (filled from lead + env).
- **Performer outreach:** Choose **“Performer outreach”**. Placeholders: `[ARTIST_NAME]`, `[CITY]`, `[LINK]`.
- **Editable copy:** Template text lives in `server/outreachTemplates.ts`. To change wording, edit that file and deploy. (Fully DB-backed editable templates would require a separate store and admin UI.)

### Admin accounts

- **Primary:** `teryn@gigxo.com`  
- **Secondary:** `pearlleashworldwide@gmail.com`  
- **Granting admin:** Ensure both have a user row, then run:
  ```bash
  npx tsx scripts/promote-admins.mts
  ```
  This sets `role = 'admin'` for both. They then have access to `/admin`, Lead Explorer, pricing override, outreach tools, and all admin procedures.

---

## 4. Other Notes

- **States selector:** No “states” multi-select was found in the performer profile or filters in the codebase. If this refers to another screen (e.g. directory or dashboard filters), that flow can be audited separately.
- **Profile image:** Upload uses existing storage (Forge/storage proxy). Requires `BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY`. If not set, upload will fail with a clear error.
- **DBPR / lead unlock:** No changes to DBPR exclusion or artist lead visibility; venue_intelligence remains internal-only.
- **Unlock flow:** $1 first unlock, $7 standard, $15 premium, and admin override are unchanged; Pro credits are consumed before Stripe when the user has an active Pro subscription.
