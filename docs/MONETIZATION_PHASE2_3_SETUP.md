# Phase 2 & 3 — Migration and Backfill Setup

**Run order:** Apply migration → Run backfill (once) → Deploy app. If you deploy before the migration, the app will hit "Unknown column" errors.

---

## 1. Safest way to apply `drizzle/0018_monetization_layer.sql` on Railway MySQL

- **Recommended:** Run the SQL **manually** against your Railway MySQL database. The project uses Drizzle with `db:push` and `db:migrate`; migration `0018` was hand-written and is not in Drizzle’s migration journal, so it will not run automatically.

**Steps:**

1. Get your Railway MySQL connection string (`DATABASE_URL`) from the Railway project → Variables (or CLI).
2. Connect with any MySQL client (e.g. Railway’s “MySQL” tab, or `mysql` CLI, or TablePlus/Sequel Ace using the same URL).
3. Run the migration in two parts so you can recover if needed:
   - **Part 1 — ALTER gigLeads:**  
     Run the single `ALTER TABLE gigLeads ADD COLUMN ...` block from `drizzle/0018_monetization_layer.sql`.  
     If you get “Duplicate column name”, the columns already exist; skip or comment out that ALTER and proceed.
   - **Part 2 — CREATE outreachLog:**  
     Run the `CREATE TABLE IF NOT EXISTS outreachLog ...` statement.  
     `IF NOT EXISTS` makes this safe to run more than once.
4. Optional: wrap in a transaction so you can roll back on error:
   ```sql
   START TRANSACTION;
   -- paste ALTER and CREATE here
   COMMIT;
   -- or ROLLBACK; if something failed
   ```

**Alternative:** If you use `npm run db:push` and your schema is already updated, Drizzle may try to add the new columns. Pushing can be risky if there is schema drift. Prefer running the hand-written SQL above for a controlled, additive change.

---

## 2. How to run the backfill script in production without breaking existing data

- The script **only updates** rows that satisfy:
  - `leadType = 'venue_intelligence'`
  - `leadMonetizationType IS NULL`
- It does **not** overwrite any row that already has `leadMonetizationType` set.
- It only **sets** monetization-related fields to the documented defaults (e.g. `venue_outreach`, `not_sent`, `prospect`, `subscriptionVisibility = false`, `artistUnlockEnabled = false`, inferred `regionTag`). It does not change contact data, title, or other core fields.

**Steps:**

1. **Run the migration first** (Section 1) so the new columns exist.
2. **Run the backfill once** from a machine that can reach Railway MySQL:
   ```bash
   # Set DATABASE_URL to your Railway MySQL URL (same as in Railway env)
   export DATABASE_URL="mysql://user:pass@host:port/dbname"
   npx tsx scripts/backfill-monetization-defaults.ts
   ```
   Or in Railway: create a one-off job / shell that has `DATABASE_URL` set and run the same command.
3. You should see: `[backfill] Updated N venue_intelligence leads.`  
   Running it again is safe: it will only touch rows that still have `leadMonetizationType IS NULL` (typically 0 after the first run).

---

## 3. Manual steps you must do before (or right after) deploying Phase 2/3 code

1. **Apply the migration**  
   Run `drizzle/0018_monetization_layer.sql` against Railway MySQL as in Section 1.

2. **Run the backfill (optional but recommended)**  
   Run `scripts/backfill-monetization-defaults.ts` once so existing venue intelligence leads get defaults (Section 2).

3. **Deploy the app**  
   Deploy the code that uses the new columns and procedures. If you deploy before running the migration, the app may see “Unknown column” errors when reading or writing the new fields.

4. **Resend (for outreach)**  
   Phase 3 outreach uses the same Resend setup as the rest of the app (`server/email.ts`). Ensure `RESEND_API_KEY` is set in Railway if you want real sends; otherwise the code will log to console (demo mode).

No other manual steps are required for Phase 2/3.

---

## 4. Phase 2 & 3 implementation summary (reference)

**Files created**

- `server/outreachTemplates.ts` — Venue outreach templates (venue_intro, follow_up, performer_supply) and placeholder rendering.

**Files modified**

- `server/email.ts` — Added `sendOutreachEmail(to, subject, bodyPlain)` using existing Resend; returns `{ success, error? }`.
- `server/routers.ts` — Extended `getVenueIntelligenceLeads` and `getLeadsExplorer` with monetization filters and new columns; extended `updateLead` with monetization fields; added `setLeadMonetization`, `setMonetizationBulk`, `getOutreachTemplates`, `sendOutreach`, `sendOutreachBulk`, `getOutreachLog`, `scheduleFollowUp`; `leads.getAvailable` excludes leads with `artistUnlockEnabled === false`; `payments.createPaymentIntent` rejects when `artistUnlockEnabled === false`.
- `client/src/pages/AdminVenueIntelligence.tsx` — Monetization/region/outreach filters; table columns (Monetization, Outreach, Artist/Sub); row actions (Mark as Sell to Artists, Send Outreach, Add to Subscription Pool, Convert to Client Pipeline); outreach modal with template picker and “No outreachable email” handling.
- `client/src/pages/AdminLeadsExplorer.tsx` — Same monetization filters; “Monet / Outreach” column; same four actions and template-based outreach modal.

**New API procedures (admin-only)**

- `admin.setLeadMonetization` — Set monetization path and related fields for one lead.
- `admin.setMonetizationBulk` — Set monetization path/fields for multiple leads.
- `admin.getOutreachTemplates` — List venue outreach templates.
- `admin.sendOutreach` — Send one outreach email (Resend), log to `outreachLog`, update lead outreach fields; returns `noOutreachableEmail: true` when neither contactEmail nor venueEmail.
- `admin.sendOutreachBulk` — Send outreach to multiple leads (same logging and updates).
- `admin.getOutreachLog` — Fetch outreach log entries for a lead.
- `admin.scheduleFollowUp` — Set `outreachNextFollowUpAt` for a lead.

**Migration / backfill**

- **Migration must be run first.** Apply `drizzle/0018_monetization_layer.sql` on Railway MySQL (Section 1).
- **Backfill recommended.** Run `scripts/backfill-monetization-defaults.ts` once after migration (Section 2).
