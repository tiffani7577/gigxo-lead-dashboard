# Gigxo Frontend + Monetization UI Audit

**Date:** March 12, 2025  
**Scope:** Dashboard → lead card → unlock → payment → access. No code changes.

---

## PRICING CONTEXT (What Code Has vs. What You Described)

You described: **$3** = discovery, **$7** = warm, **$15** = direct.

The codebase uses: **$1** = starter_friendly (discovery), **$7** = standard (warm), **$15** = premium (direct).

All findings below reflect the **actual code** ($1/$7/$15).

---

## 1. LEAD CARD UI ACCURACY

### What each lead shows

| Element | Location | Accuracy |
|--------|----------|----------|
| **Tier/price badge** | `ArtistDashboard.tsx` lines 928–946 | **Partial.** Two paths: (1) When `unlockPriceCents != null`: shows "Unlock $X" (correct). (2) When `unlockPriceCents == null` AND `leadTier` in [starter_friendly, standard, premium]: shows "Unlock $1", "$7", or "$15". **Gap:** Leads with `unlockPriceCents=null` AND `leadTier=null` (legacy) get **no badge** but button still shows "Unlock $7" (default from `getLeadDisplayPriceCents`). |
| **What user gets** | `ArtistDashboard.tsx` lines 1024–1040 | **Partial.** "Email available", "Phone available", "Facebook Lead" badges show **presence** of contact types. **Missing:** No explanation of *why* tiers differ. Starter ($1) = no direct contact, user finds post; Standard ($7) = phone or website; Premium ($15) = email or high-intent source. Users can't infer this from badges alone. |
| **Price on button** | `ArtistDashboard.tsx` lines 1062–1067 | **Correct.** Uses `getLeadDisplayPriceCents(lead)` → shows "Unlock FREE" if `availableCredits >= priceCents`, else "Unlock $X". |
| **Value rationale** | — | **Missing.** No explicit explanation why $1 < $7 < $15. Users see price and badges but not "Discovery = find post yourself", "Warm = partial contact", "Direct = full contact". |

### Summary

- Price is shown correctly on cards when tier/override exists.
- Legacy leads (no tier, no override) have no tier badge; price defaults to $7.
- Value difference between tiers is not explained; users must infer from "Email/Phone available" badges.

---

## 2. UNLOCK FLOW

### What happens when user clicks Unlock

1. **`handleUnlock(leadId)`** → `createPaymentIntent({ leadId })` (`ArtistDashboard.tsx` line 568).
2. **Server** (`server/routers.ts` lines 983–1077):
   - Loads lead, checks visibility and `artistUnlockEnabled`.
   - Price: `getLeadUnlockPriceCents(budget, unlockPriceCents, leadTier)` → 100, 700, or 1500 (or override).
   - First unlock: uses `FIRST_UNLOCK_PRICE_CENTS` ($1) regardless of lead tier.
   - Credits: uses first available credit, `creditApplied = min(credit.amount, price)`, `finalAmount = price - creditApplied`.
   - If `finalAmount === 0`: returns `isFreeWithCredits: true` → client calls `confirmPayment` without opening dialog.
   - Else: returns `clientSecret`, `amount`, `creditApplied`, `leadTitle` → opens `StripePaymentDialog`.
3. **Client** (`ArtistDashboard.tsx` lines 514–538): On success, either (a) calls `confirmPayment` directly (free), or (b) opens dialog, user pays, `onSuccess` calls `confirmPayment(paymentIntentId)`.

### Price consistency with database

- Server uses `getLeadUnlockPriceCents(budget, lead.unlockPriceCents, lead.leadTier)`.
- Client `getLeadDisplayPriceCents` uses same logic: `unlockPriceCents` first, then `leadTier`, then default 700.
- **Inconsistency:** DB audit showed `unlockPriceCents=150` on many leads. That value is not a defined tier (100/700/1500). UI will show "Unlock $2" (150/100 rounded), backend will charge 150 cents. So **DB data** can produce odd prices; logic is consistent between client and server for the same input.

### What UI says user receives after unlocking

- **`StripePaymentDialog.tsx` lines 92–96:**
  - "✓ Client name and contact details"
  - "✓ Direct email and phone number"
  - "✓ Confirmation email sent to you"
- **Issue:** For **starter_friendly** ($1) leads, there is often **no** direct email or phone. User may get a link to a Reddit/Facebook post and must find contact themselves. The dialog promises "Direct email and phone number" for all leads, which is wrong for $1 discovery leads.

---

## 3. POST-UNLOCK EXPERIENCE

### What becomes visible

- **`ArtistDashboard.tsx` lines 1086–1118 (card)** and **1286–1314 (detail panel):**
  - `contactName`, `contactEmail`, `contactPhone`, `venueUrl` when present.
- **Hidden before unlock:** contact fields (masked as "Contact info locked" or null).
- **Always visible:** title, location, budget, eventType, eventDate, description.

### Value difference between tiers post-unlock

- **Not obvious.** Unlocked cards and panels show the same layout for all tiers.
- For $1 discovery leads, `contactEmail` and `contactPhone` may be null; only `venueUrl` or post link may exist. There is **no copy** like "Discovery lead — you received a link to the original post" vs. "Premium lead — direct contact info."
- Users who unlock a $1 lead and see no email/phone may feel misled by the pre-unlock promises.

---

## 4. PRICING CONSISTENCY CHECK

| Source | Behavior |
|--------|----------|
| **shared/leadPricing.ts** | `LEAD_TIER_PRICE_CENTS`: starter_friendly=100, standard=700, premium=1500. `getLeadUnlockPriceCents` used by server. |
| **ArtistDashboard.tsx `getLeadDisplayPriceCents`** | Mirrors server logic; fallback 700 when no tier/override. |
| **createPaymentIntent** | Uses `getLeadUnlockPriceCents`; passes `finalAmount` (after credits) to Stripe. |
| **Stripe charge** | `createLeadUnlockPaymentIntent` charges `finalAmount` in cents. |
| **DB `unlockPriceCents`** | If set, overrides tier in pricing. DB audit showed 150 cents on many rows; not a valid tier, produces $1.50. |

### Mismatches

1. **DB `unlockPriceCents=150`** — Produces $1.50, which is not a defined tier. Likely bad data from an older pricing scheme.
2. **First unlock** — New users always pay $1, even for $15 premium leads. Intentional acquisition, but users may not expect a $15 lead for $1.

---

## 5. SUBSCRIPTION / CREDIT SYSTEM

### How credits are implemented

- **`server/proCredits.ts`:** Pro = 5 credits/month, each 700 cents ($7).
- **`server/routers.ts` getMyCredits:** Sums `userCredits` rows where `isUsed=false` into `totalCredits`.
- **`server/routers.ts` createPaymentIntent:** Uses first unused credit; `creditApplied = min(credit.amount, price)`; `finalAmount = price - creditApplied`.
- **`server/routers.ts` confirmPayment:** Marks credits as used in full (no partial deduction).

### Credits = dollar value, not "number of leads"

- Each credit has `amount` in cents (e.g., 700).
- One $7 credit can cover a $1, $7, or part of a $15 lead.
- For a $15 lead: one $7 credit → user pays $8; two $7 credits → free (if they had 1400 cents).

### Handling leads of different prices

- **Correct:** Credits reduce the charge; partial application works (e.g., 700 cents credit on 1500 cents lead → 800 cents charge).
- **Issue:** When a credit is used, the **entire** credit row is marked `isUsed=true`. Using a $7 credit on a $1 lead consumes the whole $7. No change or "credit balance" per credit; each row is all-or-nothing. So a $7 credit on a $1 lead effectively wastes $6.

### Credit pack fulfillment

- **`purchaseCreditPack`** creates a Stripe Checkout Session with `mode: "payment"` and `metadata: { pack_id, unlocks }`.
- **`stripeWebhook.ts`** handles `checkout.session.completed` only for `mode === "subscription"`. Credit pack purchases (`mode: "payment"`) are **not** handled. Pack buyers may pay but **never receive credits** unless there is another fulfillment path not found in the codebase.

---

## 6. CONFUSION POINTS

| Scenario | Likely user thought |
|----------|---------------------|
| Unlocks $1 lead, gets link to post only | "Why did I pay? Where’s the email/phone?" |
| Sees "Unlock $7" on button but no tier badge | "Why $7? Is this standard or premium?" |
| Uses $7 credit on $1 lead | "I only needed $1; did I waste the rest?" (Yes — full credit consumed.) |
| Detail panel shows "Unlock Contact Info — $7" for a $15 lead | Hardcoded $7 is wrong; user expects $15. |
| Detail panel shows "unlock free!" when credits ≥ $7, but lead is $1 | Wrong threshold; $1 lead should show free when credits ≥ $1. |
| First unlock gets a $15 lead for $1 | "Great deal" or "Why is this normally $15?" — unclear. |
| No Email/Phone badges on $1 lead | "What do I get for $1?" — unclear. |

---

## 7. RECOMMENDED FIXES (UI ONLY)

Surgical wording, labels, and placement changes. No redesign.

### 7.1 Lead card — explain tier value

**File:** `client/src/pages/ArtistDashboard.tsx`

- **Placement:** Under the tier/price badge (around lines 928–946) or near "Contact availability badges" (1024–1040).
- **Change:** Add a short tooltip or helper text per tier:
  - starter_friendly: "Discovery — find contact via post link"
  - standard: "Warm — phone or website"
  - premium: "Direct — email & high intent"
- **Option:** Add a `(?)` icon next to price with a popover explaining the three tiers.

### 7.2 StripePaymentDialog — tier-accurate copy

**File:** `client/src/components/StripePaymentDialog.tsx`

- **Current:** Lines 92–96 always say "✓ Direct email and phone number."
- **Change:** Pass a prop such as `leadTier` or `hasDirectContact`. If starter_friendly (or no direct contact), use:
  - "✓ Link to original post — find contact details yourself"
  - "✓ Confirmation email with next steps"
- Avoid promising "Direct email and phone" for discovery leads.

### 7.3 Detail panel — use lead-specific price

**File:** `client/src/pages/ArtistDashboard.tsx`

- **Line 1360:** Replace `availableCredits >= 700` with `availableCredits >= getLeadDisplayPriceCents(selectedLeadData)`.
- **Line 1363:** Replace "You have $X credit — unlock free!" with logic that only shows when credits cover *this* lead’s price.
- **Line 1406:** Replace hardcoded `"$7"` with:
  `availableCredits >= getLeadDisplayPriceCents(selectedLeadData) ? "FREE" : `$${Math.round(getLeadDisplayPriceCents(selectedLeadData) / 100)}``

### 7.4 Scarcity banner — clarify tiers

**File:** `client/src/pages/ArtistDashboard.tsx` line 664

- **Current:** "First unlock $1 — then $7 standard or $15 premium."
- **Change:** Add: "Discovery leads ($1) = post link; Standard ($7) = phone/website; Premium ($15) = direct contact."

### 7.5 Pricing page — match dashboard messaging

**File:** `client/src/pages/Pricing.tsx` and `client/src/pages/Home.tsx` (pricing section)

- **Current:** "Pay as you go" shows "$7 / $15 per lead" without explaining tiers.
- **Change:** Add a short line: "$7 = partial contact, $15 = direct contact."

### 7.6 Credit display — show "covers X leads" or value

**File:** `client/src/pages/ArtistDashboard.tsx` lines 693–697

- **Current:** "`$X` credit" (dollar value).
- **Option:** Add: "($7 each — use on any lead)" or similar so users know credits are dollar-value, not per-lead count.

### 7.7 Unlocked tab empty state

**File:** `client/src/pages/ArtistDashboard.tsx` line 1434

- **Current:** "Browse gigs and unlock contact info for $7 per lead."
- **Change:** "Browse gigs and unlock contact info — prices from $1 to $15 depending on lead tier."

---

*End of audit. No code was modified.*
