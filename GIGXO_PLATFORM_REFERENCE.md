# Gigxo Platform — Master Reference Document

> **Last updated:** March 7, 2026  
> **Status:** Pre-launch. Stripe keys pending. Domain connection pending.  
> **Admin account:** pearlleashworldwide@gmail.com

---

## Table of Contents

1. [Pricing Structures](#1-pricing-structures)
2. [Database Schema — Key Tables](#2-database-schema--key-tables)
3. [Funnel Copy & Landing Page Messaging](#3-funnel-copy--landing-page-messaging)
4. [Email Templates](#4-email-templates)
5. [Automation Logic](#5-automation-logic)
6. [Admin Controls Reference](#6-admin-controls-reference)
7. [Payment Flow Architecture](#7-payment-flow-architecture)
8. [Performer Type Verticals](#8-performer-type-verticals)
9. [Revenue Projection Summary](#9-revenue-projection-summary)
10. [Testing Checklist — Dynamic Pricing & Admin Lead Cards](#10-testing-checklist--dynamic-pricing--admin-lead-cards)

---

## 1. Pricing Structures

### 1.1 Dynamic Lead Unlock Pricing

The unlock price is automatically calculated from the gig's `budget` field at the moment an artist initiates a payment. If an admin has manually overridden the price on a specific lead, that override takes priority.

**Source file:** `shared/leadPricing.ts`

| Gig Budget (USD) | Unlock Price | Tier Label |
|---|---|---|
| Unknown / under $300 | **$7** | Standard |
| $300 – $799 | **$12** | Premium |
| $800 – $1,999 | **$18** | High-Value |
| $2,000+ | **$25** | Elite |

**Admin override:** Any lead can have its price manually set via the price editor on the admin lead card. The override is stored in `unlockPriceCents` on the `gigLeads` table. Setting it to `null` or `0` reverts to auto-calculation.

**Code reference:**
```ts
// shared/leadPricing.ts
export function getLeadUnlockPriceCents(
  budgetCents: number | null | undefined,
  unlockPriceCentsOverride: number | null | undefined
): number {
  if (unlockPriceCentsOverride && unlockPriceCentsOverride > 0) return unlockPriceCentsOverride;
  if (!budgetCents || budgetCents <= 0) return 700;
  const d = budgetCents / 100;
  if (d < 300) return 700;
  if (d < 800) return 1200;
  if (d < 2000) return 1800;
  return 2500;
}
```

### 1.2 Premium Subscription Tier

| Plan | Price | Included |
|---|---|---|
| Pay-per-lead | $7–$25 per unlock | Unlock individual leads on demand |
| Premium | **$19/month** | 5 lead unlocks/month, SMS alerts, priority matching, community access |

### 1.3 Referral Credits

| Action | Credit Awarded |
|---|---|
| Referring a new artist (referrer) | $7 credit (700 cents) |
| Signing up via referral link (new user) | $3.50 credit (350 cents) |

Credits are applied automatically at checkout, reducing the amount charged to Stripe. The credit deduction is capped at the lead price — no negative charges.

---

## 2. Database Schema — Key Tables

### 2.1 `gigLeads` — Core Lead Table

| Column | Type | Description |
|---|---|---|
| `id` | int PK | Auto-increment |
| `externalId` | varchar(255) unique | Deduplication key from source |
| `source` | enum | `gigsalad`, `thebash`, `facebook`, `eventbrite`, `manual` |
| `title` | varchar(255) | Gig title shown to artists |
| `description` | text | Full description (blurred until unlocked) |
| `eventType` | varchar(100) | Wedding, Corporate, Nightclub, etc. |
| `budget` | int | **In cents** (e.g., 50000 = $500) |
| `location` | varchar(255) | City/neighborhood |
| `eventDate` | timestamp | Event date (used for auto-expiry) |
| `contactName` | varchar(255) | **Admin-only until unlocked** |
| `contactEmail` | varchar(320) | **Admin-only until unlocked** |
| `contactPhone` | varchar(20) | **Admin-only until unlocked** |
| `venueUrl` | varchar(2048) | Original source URL — **admin-only, never shown to artists** |
| `performerType` | enum | See Section 8 |
| `isApproved` | boolean | Must be true for artists to see the lead |
| `isHidden` | boolean | Admin toggle — hides from artists without deleting |
| `isReserved` | boolean | Owner-only flag — permanently hidden from artists |
| `unlockPriceCents` | int nullable | Admin price override; null = auto-calculated |
| `isRejected` | boolean | Rejected leads never shown |

### 2.2 `users` — Artist Accounts

Key fields: `id`, `email`, `name`, `role` (admin/user), `passwordHash`, `emailVerified`, `profileSlug`, `djName`, `genres`, `bio`, `location`, `profilePhotoUrl`.

### 2.3 `leadUnlocks` — Payment Records

Records every successful unlock: `userId`, `leadId`, `stripePaymentIntentId`, `amountPaid`, `creditApplied`, `createdAt`.

### 2.4 `inquiries` — Booking Inquiries

Tracks inbound booking requests to artists: `artistId`, `inquirerName`, `inquirerEmail`, `eventType`, `eventDate`, `message`, `status` (new/replied/booked/declined).

### 2.5 `venues` + `venueGigs` — Venue Pro (Ready, UI Pending)

Full venue account schema exists. Venues can post gigs directly. Admin approves before showing to artists. This is the next monetization tier.

---

## 3. Funnel Copy & Landing Page Messaging

**Source file:** `client/src/pages/Home.tsx`

### Hero Section

> **Headline:** Find Your Next **Gig**  
> **Subheadline:** Discover verified gig opportunities matched to your style, location, and budget. $7 per lead. No commission. No BS.  
> **Primary CTA:** "Browse Gigs — Join Free"  
> **Secondary CTA:** "See How It Works"  
> **Social proof line:** "Trusted by artists in Miami, Fort Lauderdale, and beyond · 50+ artists already booking"

### How It Works (3 Steps)

1. **Create Your Profile** — Sign up free and tell us your style, location, and availability
2. **Browse Curated Leads** — See verified gig opportunities matched to your performer type
3. **Unlock & Book Direct** — Pay $7 to unlock contact info and book directly. No middleman, no commission.

### Value Props (Feature Cards)

- **AI-Matched Gigs** — Only see opportunities that match your style, location, and budget
- **Verified Opportunities** — Every gig is curated and verified by our team. No spam, no scams
- **Community First** — Connect with other artists, share experiences, and grow together

### Pricing Section Headline

> **Simple, Transparent Pricing** — No hidden fees. No commission. Just pure value.

### Footer CTA

> **Ready to Find Your Next Gig?**  
> Join hundreds of artists in Miami and Fort Lauderdale who are booking more gigs with Gigxo.

### Brand Voice Notes

- Tone: Direct, artist-first, anti-middleman
- Tagline: "Founded by artists, for artists"
- Color palette: Purple (#7c3aed) primary, pink (#ec4899) accent, dark slate background
- No emojis in body copy; emoji used sparingly in email subject lines only

---

## 4. Email Templates

All emails are sent via **Resend** from the `gigxo.com` domain (already verified). Source file: `server/email.ts`.

| Template Function | Trigger | Subject Line |
|---|---|---|
| `sendWelcomeEmail` | First login / signup | "Welcome to Gigxo — Your first gig leads are waiting 🎵" |
| `sendVerificationEmail` | After signup | "Verify your Gigxo email address" |
| `sendPasswordResetEmail` | Forgot password request | "Reset your Gigxo password" |
| `sendLeadUnlockConfirmation` | Successful lead unlock | "✅ Lead Unlocked: {lead title}" |
| `sendLeadMatchEmail` | Admin triggers re-engage | "{Match Score}: "{lead title}" - Unlock for $7" |
| `sendDailyDigest` | Admin triggers digest | "🎵 {N} new gigs in Miami/Fort Lauderdale today" |
| `sendReEngagementEmail` | Admin triggers re-engage | "{N} new gig leads in Miami/Fort Lauderdale — don't miss out" |
| `sendReferralCreditEmail` | New user signs up via referral | "🎁 You earned a ${amount} credit — {name} just joined Gigxo!" |
| `sendBookingInquiryEmail` | Venue/fan submits booking form | "New Booking Inquiry from {name} — Gigxo" |

### Key Email Design Decisions

All emails use inline HTML with a white card on `#f8f9fa` background, purple (`#7c3aed`) brand color, and a single primary CTA button. No external CSS dependencies — fully compatible with Gmail, Apple Mail, and Outlook.

The `sendLeadMatchEmail` template includes a **blurred description preview** — the first 25 characters are shown clearly, the next 55 characters are replaced with block characters (`█`) to create urgency without revealing the full lead.

---

## 5. Automation Logic

### 5.1 Lead Visibility Rules (Server-Side, Always Enforced)

The `getAvailableLeads` query in `server/routers.ts` applies three mandatory filters before returning any leads to artists:

```
isApproved = true  AND  isHidden = false  AND  isReserved = false
```

This means: even if a lead exists in the database, artists will never see it unless all three conditions are met. The admin can flip any of these at any time.

### 5.2 Dynamic Pricing at Unlock Time

When an artist clicks "Unlock," the server:
1. Fetches the lead's `budget` and `unlockPriceCents` fields
2. Calls `getLeadUnlockPriceCents(budget, unlockPriceCents)` to determine the final price
3. Checks the user's available credits and subtracts them (capped at lead price)
4. Creates a Stripe PaymentIntent for the remaining amount
5. Returns `clientSecret` to the frontend for Stripe Elements to complete payment

### 5.3 Demo Mode (No Stripe Keys)

If `STRIPE_SECRET_KEY` is not set, the system runs in **demo mode**: PaymentIntents are fake (`pi_demo_...`), all payments succeed, and leads are unlocked immediately. This allows full testing without a Stripe account.

### 5.4 Admin-Triggered Automations

The following actions are available from the admin dashboard:

| Button | Action |
|---|---|
| **Run Scraper** | Calls `runDailyScrape()` — generates AI-written leads and deduplicates against existing `externalId` values |
| **Send Re-Engage Email** | Sends `sendReEngagementEmail` to all artists who have not unlocked a lead in the past 7 days |
| **Send Daily Digest** | Sends `sendDailyDigest` to all verified artists with the latest approved leads |

### 5.5 Deduplication Logic

Every lead has an `externalId` (unique constraint). The scraper generates a deterministic ID from the source + title + date combination. Duplicate inserts are silently ignored via `INSERT IGNORE` semantics.

### 5.6 Referral Automation

On signup, if a `referralCode` query param is present:
- A `referrals` record is created
- The referrer receives 700 cents ($7) in `userCredits`
- The new user receives 350 cents ($3.50) in `userCredits`
- A `sendReferralCreditEmail` is sent to the referrer

---

## 6. Admin Controls Reference

**URL:** `/admin` (requires `role = 'admin'` in database)  
**Admin account:** pearlleashworldwide@gmail.com

### Per-Lead Controls

| Control | What It Does |
|---|---|
| **Live / Hidden toggle** | Green = visible to artists. Red = hidden. Click to toggle. Stored as `isHidden`. |
| **Reserve / Reserved toggle** | Amber = reserved for owner only. Grey = available. Stored as `isReserved`. Hidden leads are also excluded from artist view. |
| **Price badge (click to edit)** | Click the "$7" / "$12" etc. badge to open an inline input. Type a new dollar amount and press Save. Stored as `unlockPriceCents`. |
| **Approve** | Sets `isApproved = true`. Lead becomes visible to artists (subject to isHidden/isReserved). |
| **Reject** | Sets `isRejected = true`. Lead permanently removed from artist view. |
| **Source URL link** | Clickable external link to the original listing. Only visible to admin. Never exposed to artists. |
| **Full contact info** | contactName, contactEmail (mailto link), contactPhone (tel link) — always unblurred for admin. |

### Admin Dashboard Tabs

- **Leads** — All leads with full controls
- **Artists** — All registered artist accounts
- **Analytics** — Revenue, unlock counts, top leads
- **Scraper** — Trigger manual scrape, view scrape logs
- **Growth Worksheet** — Launch checklist + monetization playbook

---

## 7. Payment Flow Architecture

```
Artist clicks "Unlock $12"
        ↓
trpc.payments.createUnlockIntent({ leadId })
        ↓
Server: getLeadUnlockPriceCents(budget, override) → $12
        ↓
Server: check userCredits → subtract available credits
        ↓
If finalAmount > 0: Stripe.paymentIntents.create({ amount: finalAmount })
If finalAmount = 0: skip Stripe, unlock immediately
        ↓
Frontend: Stripe Elements collects card → confirms PaymentIntent
        ↓
trpc.payments.confirmUnlock({ paymentIntentId })
        ↓
Server: verifyPaymentIntent() → insert leadUnlocks row
        ↓
Server: sendLeadUnlockConfirmation email (async)
        ↓
Artist sees full contact info
```

**Webhook (backup):** `POST /api/stripe/webhook` listens for `payment_intent.succeeded` events and unlocks the lead server-side as a fallback in case the client-side confirmation fails.

---

## 8. Performer Type Verticals

These are the filter chips on the artist browse page and the `performerType` enum in the database.

| Value | Display Label | Emoji |
|---|---|---|
| `dj` | DJ | 🎧 |
| `singer` | Singer | 🎤 |
| `solo_act` | Solo Act | 🎸 |
| `small_band` | Small Band | 🎺 |
| `large_band` | Large Band | 🎷 |
| `instrumentalist` | Instrumentalist | 🎹 |
| `immersive_experience` | Immersive | ✨ |
| `hybrid_electronic` | Hybrid Electronic | 🎛️ |
| `other` | Other | 🎵 |

---

## 9. Revenue Projection Summary

**Source:** `/home/ubuntu/gigxo_projections/index.html` (investor-ready interactive model)

| Month | New Artists | Unlocks | Revenue |
|---|---|---|---|
| Month 1 | 25 | ~50 | ~$350 |
| Month 2 | 50 | ~150 | ~$1,050 |
| Month 3 | 75 | ~300 | ~$2,100 |
| Month 6 | 150 | ~900 | ~$6,300 |

These projections assume an average unlock price of $7 and a 10% monthly unlock rate per artist. The model scales to $50k/month at 500 active artists with a mix of pay-per-lead and $19/month subscriptions.

---

## 10. Testing Checklist — Dynamic Pricing & Admin Lead Cards

### Pre-Conditions

Before testing, ensure:
- [ ] You are logged in as `pearlleashworldwide@gmail.com` (admin account)
- [ ] At least one lead exists in the database with a known budget value
- [ ] A second test account exists (non-admin artist) for the artist-view tests

---

### Test A: Dynamic Pricing — Verify Price Tiers Display Correctly

**Goal:** Confirm that the unlock button price reflects the gig budget tier.

| Step | Action | Expected Result |
|---|---|---|
| A1 | Go to `/admin` → Leads tab | All leads are visible with a price badge |
| A2 | Find a lead with budget under $300 (or no budget) | Price badge shows **$7** |
| A3 | Find a lead with budget $300–$799 | Price badge shows **$12** |
| A4 | Find a lead with budget $800–$1,999 | Price badge shows **$18** |
| A5 | Find a lead with budget $2,000+ | Price badge shows **$25** |
| A6 | Log in as the test artist account, go to `/dashboard` | The same leads show the matching unlock price on the "Unlock" button |

**If no leads with varied budgets exist:** Use the admin "Add Manual Lead" form to create one lead at each budget tier, then approve them.

---

### Test B: Admin Price Override

| Step | Action | Expected Result |
|---|---|---|
| B1 | On any lead card in `/admin`, click the price badge | An inline input field appears |
| B2 | Type `15` and click Save | Badge updates to **$15** |
| B3 | Log in as test artist, find that lead | Unlock button shows **$15** |
| B4 | Back in admin, click the badge again, type `0`, click Save | Price reverts to auto-calculated tier price |

---

### Test C: Toggle Live / Hidden

| Step | Action | Expected Result |
|---|---|---|
| C1 | In `/admin`, find an approved lead showing "Live" (green badge) | Badge is green, lead is visible to artists |
| C2 | Click the "Live" badge | Badge turns red and shows "Hidden" |
| C3 | Log in as test artist, browse leads | That lead is **gone** from the list |
| C4 | Back in admin, click "Hidden" badge | Badge turns green "Live" again |
| C5 | Refresh artist dashboard | Lead reappears |

---

### Test D: Reserve for Me

| Step | Action | Expected Result |
|---|---|---|
| D1 | In `/admin`, find a lead and click "Reserve" (grey bookmark icon) | Badge turns amber and shows "Reserved" |
| D2 | Log in as test artist, browse leads | That lead is **not visible** even though it is approved and not hidden |
| D3 | Back in admin, click "Reserved" to release | Badge returns to grey "Reserve" |
| D4 | Refresh artist dashboard | Lead reappears |

---

### Test E: Full Contact Info & Source URL (Admin View)

| Step | Action | Expected Result |
|---|---|---|
| E1 | In `/admin` Leads tab, expand any lead card | Contact name, email, and phone are visible in plain text |
| E2 | Click the email address | Your email client opens a compose window pre-filled with that address |
| E3 | Click the phone number | Your phone app opens (on mobile) or a tel: link fires |
| E4 | Look for the source URL link (chain icon or "View Source") | Clicking it opens the original listing in a new tab |
| E5 | Log in as test artist | Contact info shows as "Contact info locked" — source URL is **not visible at all** |

---

### Test F: End-to-End Unlock with Dynamic Price (Demo Mode)

*This test works even without Stripe keys configured.*

| Step | Action | Expected Result |
|---|---|---|
| F1 | Log in as test artist | Dashboard loads with leads |
| F2 | Find a lead with a non-$7 price (e.g., $12 or $18) | Unlock button shows the correct price |
| F3 | Click "Unlock $12" | Payment modal opens |
| F4 | In demo mode, click "Pay" (no real card needed) | Lead unlocks immediately |
| F5 | Contact info is now visible | Name, email, phone shown in full |
| F6 | Check admin dashboard → that lead's unlock count incremented | Unlock count badge increased by 1 |

---

### Test G: Hidden/Reserved Leads Do Not Appear in Artist Stats

| Step | Action | Expected Result |
|---|---|---|
| G1 | Note the "X leads available" count shown in artist dashboard header | Record the number |
| G2 | In admin, hide 2 leads | — |
| G3 | Refresh artist dashboard | Available count decreased by 2 |
| G4 | Unhide the leads | Count returns to original |

---

*End of Gigxo Platform Reference Document*
