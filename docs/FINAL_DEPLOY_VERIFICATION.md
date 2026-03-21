# Final Deploy Verification — Gigxo

## PART 1 — Config (production env)

The app expects:

- **APP_URL** — `https://www.gigxo.com` (Google callback redirect fallback; Stripe success/cancel URL fallback when client doesn’t send origin)
- **GOOGLE_REDIRECT_URI** — `https://www.gigxo.com/api/auth/google/callback` (must match Google Cloud Console exactly)

**Full production env checklist:**

| Env var | Purpose |
|--------|---------|
| **APP_URL** | `https://www.gigxo.com` — OAuth redirect fallback, Stripe success/cancel fallback |
| **GOOGLE_CLIENT_ID** | Google OAuth |
| **GOOGLE_CLIENT_SECRET** | Google OAuth |
| **GOOGLE_REDIRECT_URI** | `https://www.gigxo.com/api/auth/google/callback` |
| **STRIPE_SECRET_KEY** | Pro checkout + lead unlock payments |
| **STRIPE_WEBHOOK_SECRET** | Webhook signature verification (required in production) |
| **VITE_STRIPE_PUBLISHABLE_KEY** | Server exposes via `payments.getConfig` for client |
| **DATABASE_URL** | MySQL connection |
| **JWT_SECRET** | Auth cookie/session (ENV.cookieSecret) |
| **RESEND_API_KEY** | Welcome/digest/outreach emails |
| **BUILT_IN_FORGE_API_URL** | Storage (profile image, tracks) — Forge proxy |
| **BUILT_IN_FORGE_API_KEY** | Storage auth |
| **PORT** | Optional; default 3000 |
| **RAILWAY_TRUST_PROXY** | Set `true` on Railway so edge/proxy headers align with `app.set("trust proxy", true)` and apex→www redirects |

Optional for launch: MICROSOFT_* (outreach inbox), APIFY_API_TOKEN, SCRAPER_API_KEY, OAUTH_SERVER_URL, VITE_APP_ID, OWNER_OPEN_ID, etc.

---

## PART 2 — Database / migrations

- **0021_lead_tier.sql** — **Required.** Adds `leadTier` to `gigLeads`. Schema already defines it; run if not yet applied.
- **0022_user_credits_pro_monthly.sql** — **Required.** Adds `pro_monthly` to `userCredits.source` enum. Schema already defines it; run if not yet applied.
- **0023_artist_profile_image_url.sql** — **Required.** Adds `profileImageUrl` to `artistProfiles`. Schema already defines it; run if not yet applied.

**Order:** 0021 → 0022 → 0023 (numeric order).

**Other migrations:** No additional migrations needed for the current launch scope. Ensure all migrations up to 0023 are applied in order.

---

## PART 3 — Stripe Pro flow

1. **Pro price** — Confirmed **$49/month** (`unit_amount: 4900` in `subscription.startPremium`).
2. **Button/route** — Dashboard → “Pro & Unlock Packs” tab → “Go Pro” button → `subscription.startPremium` → Stripe Checkout; success/cancel URLs use client `origin` or server `APP_URL`.
3. **checkout.session.completed** — `fulfillSubscription` stores subscription and fetches Stripe subscription to set `currentPeriodStart` / `currentPeriodEnd` so credits can be granted.
4. **invoice.payment_succeeded** — `handleSubscriptionRenewal` updates period from Stripe so the next unlock grants 5 credits for the new period.
5. **5 credits** — `ensureProMonthlyCredits` (called from `createPaymentIntent`) grants up to 5 credits per period; period is set by webhook.
6. **Credits before pay-per-lead** — `createPaymentIntent` calls `ensureProMonthlyCredits` then uses available credits (referral, promo, pro_monthly) before charging.
7. **$7/$15 after credits** — When credits are exhausted, `createPaymentIntent` charges dynamic price (e.g. $7/$15 by lead tier); `confirmPayment` / webhook fulfill unlock. No change to existing unlock flow.

**Risks addressed:** Price fixed to $49; fulfillment and renewal set/update period; frontend passes `origin` to startPremium; backend falls back to `APP_URL` for success/cancel URL.

---

## PART 4 — Google login

- **Login button** — Links to `/api/auth/google/login?origin=${encodeURIComponent(window.location.origin)}` (Login.tsx, Signup.tsx). Correct.
- **Callback route** — `GET /api/auth/google/callback` registered in `googleAuth.ts` before static; works on deployed host.
- **APP_URL fallback** — Callback uses `state` (origin) when valid, else `process.env.APP_URL`, else relative `/dashboard`. Correct.
- **Canonical host** — Use **www.gigxo.com** everywhere: set `APP_URL=https://www.gigxo.com` and `GOOGLE_REDIRECT_URI=https://www.gigxo.com/api/auth/google/callback`; add that exact redirect URI in Google Console.
- **Dashboard host** — Redirect is `baseUrl + "/dashboard"` (e.g. `https://www.gigxo.com/dashboard`). No remaining host mismatch in code.

---

## PART 5 — Frontend sales layer

- **Homepage** — Hero, step 3, pricing section, footer: $1 first unlock, $7/$15, $49 Pro, 5 credits. Correct.
- **/pricing** — Three plans (First $1, Pay as you go $7/$15, Pro $49 + 5 credits). Correct.
- **Login** — Card copy: “$1 first unlock, $7/$15 per lead”, Pro. Correct.
- **Signup** — Card copy: “First unlock $1 — then $7 standard or $15 premium. Go Pro for 5 credits/month.” Correct.
- **Dashboard** — Scarcity banner and “Pro & Unlock Packs” tab: $1, $7/$15, $49/mo, 5 credits. Correct.
- **SharePage** — Updated: “First unlock is FREE” / “First lead is free” → “First unlock $1” / “First unlock is just $1” in all share templates and FB quote.
- **Welcome email / digest** — Welcome: $1 first unlock, $7/$15, Pro $49 + 5 credits. Digest: “Unlock from $7”. Correct.

---

## PART 6 — Admin access

- **teryn@gigxo.com** and **pearlleashworldwide@gmail.com** are the two admin emails in `scripts/promote-admins.mts`.
- **Manual step:** Run after deploy (and after those users have signed up at least once):

  ```bash
  npx tsx scripts/promote-admins.mts
  ```

- Requires `DATABASE_URL` in env (e.g. `.env` or shell). Promotes any existing user with those emails to `role: "admin"`; if not found, logs “Not found (sign up first): …”.

---

## PART 7 — Final output (concise)

### 1. DEPLOY NOW: **yes**

### 2. Remaining blockers: **none**

### 3. Final production checklist

**Env vars (set in Railway / production):**

- `APP_URL=https://www.gigxo.com`
- `GOOGLE_REDIRECT_URI=https://www.gigxo.com/api/auth/google/callback`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VITE_STRIPE_PUBLISHABLE_KEY`
- `DATABASE_URL`, `JWT_SECRET`
- `RESEND_API_KEY`
- `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` (for profile image / track upload)

**Migrations (run in order):**

- `0021_lead_tier.sql`
- `0022_user_credits_pro_monthly.sql`
- `0023_artist_profile_image_url.sql`

**Manual commands:**

- Promote admins (after deploy, once users exist):  
  `npx tsx scripts/promote-admins.mts`

**Post-deploy tests:**

1. **Google login** — From https://www.gigxo.com/login, sign in with Google → redirect to https://www.gigxo.com/dashboard (no blank/404).
2. **Pro checkout** — Dashboard → Pro & Unlock Packs → Go Pro → complete Stripe Checkout ($49) → land on dashboard; unlock a lead and confirm credits or charge.
3. **Webhooks** — Stripe Dashboard → Webhooks → endpoint returns 200 for `checkout.session.completed`, `invoice.payment_succeeded`, `payment_intent.succeeded`.
4. **Pricing copy** — Homepage, /pricing, login, signup, dashboard show $1 / $7 / $15 / $49 Pro / 5 credits.
5. **Admin** — Log in as teryn@gigxo.com or pearlleashworldwide@gmail.com after running promote-admins → access /admin and admin features.
