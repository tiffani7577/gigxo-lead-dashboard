# Gigxo — Final Production Deploy Checklist

**Source of truth:** `docs/FINAL_DEPLOY_VERIFICATION.md`  
**Deploy decision:** Yes. No remaining blockers.

---

## 1. Pre-deploy: commit and push (if using Git)

Ensure all launch-ready code and migrations are committed and pushed so production builds from the correct state.

**Modified files to include in commit (if not already):**
- `client/src/App.tsx`
- `client/src/components/DashboardLayout.tsx`
- `client/src/components/SiteFooter.tsx`
- `client/src/lib/seoConfig.ts`
- `client/src/pages/AdminDashboard.tsx`
- `client/src/pages/AdminEventWindows.tsx`
- `client/src/pages/ArtistDashboard.tsx`
- `client/src/pages/ArtistProfile.tsx`
- `client/src/pages/Home.tsx`
- `client/src/pages/Login.tsx`
- `client/src/pages/SEOLandingPage.tsx`
- `client/src/pages/SharePage.tsx`
- `client/src/pages/Signup.tsx`
- `drizzle/schema.ts`
- `server/email.ts`
- `server/googleAuth.ts`
- `server/outreachTemplates.ts`
- `server/routers.ts`
- `server/stripeWebhook.ts`

**New/untracked files to include:**
- `client/src/pages/Pricing.tsx`
- `drizzle/0021_lead_tier.sql`
- `drizzle/0022_user_credits_pro_monthly.sql`
- `drizzle/0023_artist_profile_image_url.sql`
- `scripts/promote-admins.mts`
- `server/proCredits.ts`
- Docs (optional for deploy): `docs/FINAL_DEPLOY_VERIFICATION.md`, `docs/DEPLOY_CHECKLIST.md`, etc.

**Do not commit:** `.env`, `gigxo env ` (env notes file), or any secrets.

---

## 2. ENV VARS (production — e.g. Railway)

Set these in the production environment **before** or at deploy:

| Variable | Example / note |
|----------|-----------------|
| **APP_URL** | `https://www.gigxo.com` |
| **GOOGLE_REDIRECT_URI** | `https://www.gigxo.com/api/auth/google/callback` |
| **GOOGLE_CLIENT_ID** | (from Google Cloud Console) |
| **GOOGLE_CLIENT_SECRET** | (from Google Cloud Console) |
| **STRIPE_SECRET_KEY** | `sk_live_...` (or `sk_test_...` for staging) |
| **STRIPE_WEBHOOK_SECRET** | (from Stripe Dashboard → Webhooks) |
| **VITE_STRIPE_PUBLISHABLE_KEY** | `pk_live_...` (or `pk_test_...`) |
| **DATABASE_URL** | MySQL connection string |
| **JWT_SECRET** | Strong secret for auth cookies |
| **RESEND_API_KEY** | (from Resend) |
| **BUILT_IN_FORGE_API_URL** | Forge storage API URL |
| **BUILT_IN_FORGE_API_KEY** | Forge storage API key |

**Google Cloud Console:** Add authorized redirect URI exactly:  
`https://www.gigxo.com/api/auth/google/callback`

**Stripe Dashboard:** Add webhook endpoint `https://<your-production-host>/api/stripe/webhook`, subscribe to: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `payment_intent.succeeded`. Use the signing secret as `STRIPE_WEBHOOK_SECRET`.

---

## 3. MIGRATIONS (production DB)

Run in this order against the **production** database (only if not already applied):

1. `drizzle/0021_lead_tier.sql`
2. `drizzle/0022_user_credits_pro_monthly.sql`
3. `drizzle/0023_artist_profile_image_url.sql`

Example (adjust for your DB client):

```bash
# From repo root, with DATABASE_URL set for production
mysql "$DATABASE_URL" < drizzle/0021_lead_tier.sql
mysql "$DATABASE_URL" < drizzle/0022_user_credits_pro_monthly.sql
mysql "$DATABASE_URL" < drizzle/0023_artist_profile_image_url.sql
```

Or use Drizzle Kit / your migration runner if you use one.

---

## 4. MANUAL COMMAND (after deploy)

After the app is deployed and **after** teryn@gigxo.com and pearlleashworldwide@gmail.com have signed up at least once:

```bash
npx tsx scripts/promote-admins.mts
```

Run from the repo with `DATABASE_URL` pointing at production (e.g. in `.env` or export). This sets `role: "admin"` for those two users.

---

## 5. Launch order of operations

1. **Set all production ENV VARS** (Section 2) in your hosting (e.g. Railway).
2. **Apply migrations** (Section 3) to the production database if not already applied.
3. **Commit and push** all launch-ready code and migrations (Section 1) so the deploy uses the correct version.
4. **Deploy** the application (build + release on Railway or your platform).
5. **Configure Google** — Redirect URI `https://www.gigxo.com/api/auth/google/callback` in Google Cloud Console.
6. **Configure Stripe** — Webhook URL and events; set `STRIPE_WEBHOOK_SECRET`.
7. **Run promote-admins** (Section 4) after the two admin users have signed up.
8. **Run post-deploy smoke tests** (Section 6).

---

## 6. Post-deploy smoke test list

- [ ] **Google login** — Open https://www.gigxo.com/login → Sign in with Google → choose account → confirm redirect to https://www.gigxo.com/dashboard (no blank or “not found” page).
- [ ] **Pro checkout** — Log in → Dashboard → “Pro & Unlock Packs” tab → “Go Pro” → complete Stripe Checkout ($49) → land on dashboard; optionally unlock a lead and confirm credits or charge.
- [ ] **Stripe webhooks** — In Stripe Dashboard → Developers → Webhooks → select endpoint → confirm recent events (`checkout.session.completed`, `invoice.payment_succeeded`, `payment_intent.succeeded`) return 200.
- [ ] **Pricing copy** — Homepage, https://www.gigxo.com/pricing, login, signup, and dashboard show: $1 first unlock, $7 standard, $15 premium, $49/mo Pro, 5 monthly credits.
- [ ] **Admin login** — Log in as teryn@gigxo.com and as pearlleashworldwide@gmail.com (after running `npx tsx scripts/promote-admins.mts`) → confirm /admin and admin features are accessible.
