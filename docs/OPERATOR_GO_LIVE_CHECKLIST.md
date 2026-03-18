# Gigxo operator go-live checklist

Run in this order. Use one test artist account and one test admin account unless noted.

---

## 1. Starter lead test

**Setup**

- At least one lead in DB with `leadTier = 'starter_friendly'` and `unlockPriceCents IS NULL` (or 300), `isApproved = 1`, `artistUnlockEnabled = 1`, not hidden/reserved.
- If none exists, in admin: edit a lead, set Lead tier to "Starter friendly", save. Or run:
  ```sql
  UPDATE gigLeads SET leadTier = 'starter_friendly', unlockPriceCents = NULL WHERE id = <id> LIMIT 1;
  ```
- Note this lead’s `id` (= `STARTER_LEAD_ID`).

**Steps**

- Log in as artist. Open dashboard (marketplace).
- Find the lead; card must show **Unlock $3**.
- Click lead, then Unlock; complete Stripe payment for $3 (or use test card).
- See full contact/details and “Unlocked” state.

**Confirm**

- Server log line: `[payments.createPaymentIntent] userId=<artistId> leadId=<STARTER_LEAD_ID> priceCents=300 creditApplied=0 finalAmount=300`
- Then: `[payments.confirmPayment] unlocked userId=<artistId> leadId=<STARTER_LEAD_ID> amountCents=300 isFree=false`
- DB:
  ```sql
  SELECT * FROM leadUnlocks WHERE userId = <artistId> AND leadId = <STARTER_LEAD_ID>;
  ```
  One row.
- DB:
  ```sql
  SELECT id, amount, transactionType, status FROM transactions WHERE userId = <artistId> AND leadId = <STARTER_LEAD_ID> ORDER BY id DESC LIMIT 1;
  ```
  One row: `amount = 300`, `transactionType = 'lead_unlock'`, `status = 'completed'`.

---

## 2. Standard lead test

**Setup**

- Lead with `leadTier = 'standard'`, `unlockPriceCents IS NULL` (or 700), approved and artist-unlockable. Note `id` (= `STANDARD_LEAD_ID`).

**Steps**

- As artist, open dashboard. Find lead; card shows **Unlock $7**.
- Unlock; pay $7 (or test card). See contact info and Unlocked.

**Confirm**

- Log: `[payments.createPaymentIntent] ... leadId=<STANDARD_LEAD_ID> priceCents=700 ... finalAmount=700`
- Log: `[payments.confirmPayment] unlocked ... leadId=<STANDARD_LEAD_ID> amountCents=700 ...`
- DB: `leadUnlocks` has one row for this `(userId, leadId)`.
- DB: `transactions` has one row for this unlock with `amount = 700`, `status = 'completed'`.

---

## 3. Premium lead test

**Setup**

- Lead with `leadTier = 'premium'`, `unlockPriceCents IS NULL` (or 1500), approved and artist-unlockable. Note `id` (= `PREMIUM_LEAD_ID`).

**Steps**

- As artist, find lead; card shows **Unlock $15**. Unlock; pay $15. See contact and Unlocked.

**Confirm**

- Log: `[payments.createPaymentIntent] ... leadId=<PREMIUM_LEAD_ID> priceCents=1500 ... finalAmount=1500`
- Log: `[payments.confirmPayment] unlocked ... leadId=<PREMIUM_LEAD_ID> amountCents=1500 ...`
- DB: `leadUnlocks` row for this `(userId, leadId)`; `transactions` row with `amount = 1500`, `status = 'completed'`.

---

## 4. Credit-covered unlock test

**Setup**

- Test artist has at least one unused credit: `userCredits` row with `userId = <artistId>`, `isUsed = 0`, `amount >= 700` (e.g. 700).
- Lead: `leadTier = 'standard'`, price $7, approved and unlockable. Note `id` (= `CREDIT_LEAD_ID`).

**Steps**

- As that artist, open dashboard. Lead shows **Unlock FREE** or **Unlock $0** (credits cover full amount).
- Click Unlock; no Stripe form; flow completes and lead shows Unlocked with contact.

**Confirm**

- Log: `[payments.createPaymentIntent] userId=<artistId> leadId=<CREDIT_LEAD_ID> priceCents=700 creditApplied=700 finalAmount=0`
- Log: `[payments.confirmPayment] unlocked userId=<artistId> leadId=<CREDIT_LEAD_ID> amountCents=700 isFree=true`
- DB: `leadUnlocks` has row for this `(userId, leadId)`.
- DB: one `userCredits` row for this user now has `isUsed = 1`.
- No new Stripe charge for this unlock.

---

## 5. Already-unlocked lead test

**Setup**

- Use an artist and lead already unlocked in a step above (e.g. starter lead and same artist).

**Steps**

- As that artist, open dashboard. Open the same lead again; try to unlock again (button may say “Unlocked” or trigger createPaymentIntent).

**Confirm**

- If createPaymentIntent is called: server log `[payments.createPaymentIntent] already-unlocked userId=<artistId> leadId=<id>` and API returns error “Lead already unlocked”.
- No new row in `leadUnlocks` for this (userId, leadId). No second charge.

---

## 6. Trusted SEO lead auto-publish test

**Setup**

- Submit a client lead from a trusted SEO page (e.g. yacht-dj-fort-lauderdale) with `sourceSlug = "yacht-dj-fort-lauderdale"` and a unique note (e.g. "GO_LIVE_TEST_6") so you can find the row.

**Steps**

- From the SEO form or a tool that calls `publicLeads.submitClientLead` with `sourceSlug: "yacht-dj-fort-lauderdale"`, submit once.
- Then as admin: open Lead Queue / Lead Sources; as artist: open dashboard.

**Confirm**

- Server log: `[seo-auto-publish] leadId=<id> slug=yacht-dj-fort-lauderdale tier=premium price=1500`
- DB:
  ```sql
  SELECT id, leadType, isApproved, artistUnlockEnabled, leadMonetizationType, leadTier, unlockPriceCents
  FROM gigLeads WHERE description LIKE '%GO_LIVE_TEST_6%' OR description LIKE '%yacht-dj-fort-lauderdale%' ORDER BY createdAt DESC LIMIT 1;
  ```
  Expect: `leadType = 'client_submitted'`, `isApproved = 1`, `artistUnlockEnabled = 1`, `leadMonetizationType = 'artist_unlock'`, `leadTier = 'premium'`, `unlockPriceCents = 1500`.
- Admin: Lead appears in approved list; Lead Sources shows `yacht-dj-fort-lauderdale` with count ≥ 1.
- Artist: Lead appears in marketplace with **Unlock $15**.

---

## 7. Admin edit / tier test

**Setup**

- One lead in admin list (any status). Note `id` (= `EDIT_LEAD_ID`).

**Steps**

- As admin, open Lead Queue, find lead, click Edit.
- Set Lead tier to "Starter friendly". Leave Unlock Price ($) blank. Save.
- Change to "Premium". Save.
- As artist, find this lead (if approved and visible). Card must show **Unlock $15**.

**Confirm**

- DB:
  ```sql
  SELECT id, leadTier, unlockPriceCents FROM gigLeads WHERE id = <EDIT_LEAD_ID>;
  ```
  After last save: `leadTier = 'premium'`; `unlockPriceCents` unchanged or null (tier drives price).
- Artist UI shows $15 for this lead (premium).

---

## 8. Post-deploy verification

**Steps**

- In production (or staging with prod-like config):
  - Load artist dashboard; confirm lead list loads and prices show as $3 / $7 / $15 (no $1, no odd amounts).
  - Load admin Lead Queue; confirm no console/network errors; open one lead edit and confirm tier/price fields and Lead Sources section load.
  - Trigger one createPaymentIntent (e.g. click Unlock on a paid lead) and confirm server log line appears with `priceCents`, `creditApplied`, `finalAmount`.
  - If you have monitoring, confirm no spike in 5xx or auth errors after deploy.

**Confirm**

- No 500s on `/api/trpc/*` (or your tRPC path) for leads or payments.
- Server logs show `[payments.createPaymentIntent]` and/or `[payments.confirmPayment]` with expected `priceCents` (300, 700, or 1500) when unlocks are attempted.
- Optional: run `admin.cleanupLeadPrices` once; check `rowsAffected` and then:
  ```sql
  SELECT COUNT(*) FROM gigLeads WHERE unlockPriceCents IS NOT NULL AND unlockPriceCents NOT IN (300, 700, 1500);
  ```
  Expect 0.

---

## Quick reference — log and DB

| Check              | Log pattern / DB |
|--------------------|------------------|
| Intent created     | `[payments.createPaymentIntent] userId=... leadId=... priceCents=... creditApplied=... finalAmount=...` |
| Unlock recorded    | `[payments.confirmPayment] unlocked userId=... leadId=... amountCents=... isFree=...` |
| Duplicate blocked  | `[payments.createPaymentIntent] already-unlocked userId=... leadId=...` or `[payments.confirmPayment] already-unlocked ...` |
| SEO auto-publish   | `[seo-auto-publish] leadId=... slug=... tier=... price=...` |
| Unlock row         | `SELECT * FROM leadUnlocks WHERE userId = ? AND leadId = ?;` → exactly one row per successful unlock |
| Transaction        | `SELECT * FROM transactions WHERE userId = ? AND leadId = ? ORDER BY id DESC LIMIT 1;` → amount 300/700/1500, status completed |
