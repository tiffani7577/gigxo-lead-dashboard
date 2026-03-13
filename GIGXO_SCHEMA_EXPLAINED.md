# Gigxo Database Schema — Plain English Explainer

> Think of the database as a set of spreadsheets that are connected to each other. Each table is one spreadsheet. Each row is one record. Each column is one piece of information about that record. The connections between tables let us answer questions like "which leads did this artist unlock?" or "how much has this user spent?"

---

## Table 1: `gigLeads` — The Gig Opportunities

**What it is:** Every gig booking opportunity on the platform lives here. This is the core product — the thing artists pay to unlock.

| Column | Plain English | Example |
|---|---|---|
| `id` | A unique number we assign to every lead | 42 |
| `externalId` | A fingerprint we use to avoid adding the same gig twice | `ai-nyc-1741234567-3` |
| `source` | Where we found this gig | `manual`, `gigsalad`, `eventbrite` |
| `title` | The headline artists see before unlocking | "DJ Needed for Rooftop Wedding" |
| `description` | The full details — blurred until unlocked | "30 guests, 4 hours, open bar..." |
| `eventType` | What kind of event it is | Wedding, Corporate Event, Nightclub |
| `budget` | How much the client is willing to pay — stored in **cents** | `150000` = $1,500 |
| `location` | City and neighborhood | "Williamsburg, NY" |
| `latitude` / `longitude` | GPS coordinates (for future map view) | 40.7128, -74.0060 |
| `eventDate` | When the gig is | April 12, 2026 |
| `contactName` | The person to call — **hidden until unlocked** | "Sarah Johnson" |
| `contactEmail` | Their email — **hidden until unlocked** | sarah@venue.com |
| `contactPhone` | Their phone — **hidden until unlocked** | (305) 555-1234 |
| `venueUrl` | The original listing URL — **admin-only, never shown to artists** | https://gigsalad.com/... |
| `performerType` | What kind of artist they want | dj, singer, small_band, hybrid_electronic |
| `isApproved` | Has the admin reviewed and approved this lead? | true / false |
| `isRejected` | Has the admin rejected this lead? | true / false |
| `isHidden` | Admin toggled it off temporarily (still in DB, just invisible) | true / false |
| `isReserved` | Owner reserved this for personal use — never shown to anyone else | true / false |
| `unlockPriceCents` | Admin-set custom price override (null = auto-calculated from budget) | `1800` = $18 |
| `createdAt` | When we added this lead | March 7, 2026 |

**The key rule:** An artist can only see a lead if `isApproved = true` AND `isHidden = false` AND `isReserved = false`. All three must be true at the same time.

**Why budget is in cents:** Computers are bad at decimals. Storing `150000` instead of `$1,500.00` avoids rounding errors when doing math on prices.

---

## Table 2: `users` — The Artist Accounts

**What it is:** Every person who signs up on Gigxo — artists and admins — gets a row here.

| Column | Plain English | Example |
|---|---|---|
| `id` | Unique number for this person | 7 |
| `email` | Their login email | dj@example.com |
| `name` | Display name | "DJ Pulse" |
| `role` | Are they a regular artist or an admin? | `user` or `admin` |
| `passwordHash` | Their password, scrambled so we can't read it | `$2b$10$...` |
| `emailVerified` | Have they clicked the verification link we sent? | true / false |
| `profileSlug` | Their public URL on the artist directory | `dj-pulse` → gigxo.com/artist/dj-pulse |
| `djName` | Stage name shown on their public profile | "DJ Pulse" |
| `genres` | What music styles they play (stored as JSON array) | `["House", "R&B", "Hip-Hop"]` |
| `bio` | Their artist bio | "Miami-based DJ with 10 years..." |
| `location` | Where they're based | "Miami, FL" |
| `profilePhotoUrl` | Link to their profile photo (stored on CDN) | https://cdn.../photo.jpg |
| `stripeCustomerId` | Their ID in Stripe's system (for payments) | `cus_abc123` |
| `referralCode` | Their personal referral link code | `ref-7` |
| `createdAt` | When they signed up | March 1, 2026 |

**Admin account:** The user with `role = 'admin'` (currently `pearlleashworldwide@gmail.com`) can see everything — full contact info, source URLs, all leads including hidden/reserved ones.

---

## Table 3: `leadUnlocks` — The Payment Records

**What it is:** Every time an artist pays to unlock a lead, we record it here. This is the revenue ledger.

| Column | Plain English | Example |
|---|---|---|
| `id` | Unique record number | 156 |
| `userId` | Which artist unlocked it (links to `users.id`) | 7 |
| `leadId` | Which lead they unlocked (links to `gigLeads.id`) | 42 |
| `stripePaymentIntentId` | The Stripe transaction ID (for refunds/disputes) | `pi_3abc...` |
| `amountPaid` | How much they actually paid, in cents | `1200` = $12 |
| `creditApplied` | How much of their referral credit was used, in cents | `350` = $3.50 |
| `createdAt` | When the unlock happened | March 7, 2026 |

**How it works:** When an artist clicks "Unlock $12," we create a row here after Stripe confirms payment. The next time they visit that lead, we check this table — if their `userId` + `leadId` combo exists here, we show them the full contact info.

---

## Table 4: `inquiries` — Booking Requests to Artists

**What it is:** When someone visits an artist's public profile and fills out the "Book This Artist" form, it creates a row here. This is the artist's inbound sales pipeline.

| Column | Plain English | Example |
|---|---|---|
| `id` | Unique record number | 23 |
| `artistId` | Which artist received this inquiry (links to `users.id`) | 7 |
| `inquirerName` | The name of the person who wants to book them | "Maria Rodriguez" |
| `inquirerEmail` | Their email address | maria@corp.com |
| `inquirerPhone` | Their phone number (optional) | (212) 555-9876 |
| `eventType` | What kind of event they're planning | "Corporate Holiday Party" |
| `eventDate` | When their event is | December 20, 2026 |
| `budget` | What they're willing to pay | "Around $1,500" |
| `message` | Their full message to the artist | "We need a DJ for our office party..." |
| `status` | Where this inquiry is in the pipeline | `new`, `replied`, `booked`, `declined` |
| `createdAt` | When they submitted the form | March 7, 2026 |

**The pipeline:** Artists manage these in their "My Inquiries" tab. They can move each one from `new` → `replied` → `booked` or `declined`. When a new inquiry comes in, the artist gets an email notification automatically.

---

## Table 5: `venues` — Venue Pro Accounts (Ready, Not Yet Live)

**What it is:** This table is built and ready but the public-facing UI is not yet launched. It will power the "Venue Pro" subscription tier — venues pay $49/month to post gigs directly to the marketplace.

| Column | Plain English | Example |
|---|---|---|
| `id` | Unique venue ID | 1 |
| `name` | Venue business name | "The Rooftop at 1 Hotel" |
| `contactName` | The booker's name | "James Chen" |
| `contactEmail` | Their login email | james@1hotel.com |
| `contactPhone` | Their phone | (305) 555-7890 |
| `venueType` | What kind of venue it is | "Wedding Venue", "Club", "Corporate" |
| `location` | Where the venue is | "South Beach, FL" |
| `website` | Their website | https://1hotels.com/south-beach |
| `stripeCustomerId` | Their Stripe ID for subscription billing | `cus_xyz789` |
| `stripeSubscriptionId` | Their active subscription ID | `sub_abc456` |
| `planStatus` | Are they on trial, active, or canceled? | `trial`, `active`, `canceled` |
| `createdAt` | When they signed up | — |

**Connected table — `venueGigs`:** Venues post individual gig opportunities here. Each `venueGig` links back to a `venue` via `venueId`. When a venue posts a gig, an admin reviews it (`isApproved = false` by default), then approves it to appear in the marketplace. This is the same flow as manual leads, but venues do the data entry themselves.

---

## How the Tables Connect

```
users (artist)
  ↓ unlocks leads via
leadUnlocks
  ↓ references
gigLeads (the gig opportunity)

users (artist)
  ↓ receives booking requests via
inquiries
  ↑ sent by visitors to their public profile

venues
  ↓ post gig opportunities via
venueGigs → (admin approves) → gigLeads (same marketplace)
```

**The money flow in one sentence:** An artist (`users`) pays to create a `leadUnlock` record, which gives them permission to see the `contactName`, `contactEmail`, and `contactPhone` on a `gigLeads` row that was previously blurred.
