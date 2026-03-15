# Gigxo Production Deploy Runbook

**Goal:** Deploy the new monetization system safely. No redesign, no new features.

---

## 1. Commit and push (launch files are currently uncommitted)

**Uncommitted launch-related files:**

**Modified (tracked):**
- client/src/App.tsx
- client/src/components/DashboardLayout.tsx
- client/src/components/SiteFooter.tsx
- client/src/lib/seoConfig.ts
- client/src/pages/AdminDashboard.tsx
- client/src/pages/AdminEventWindows.tsx
- client/src/pages/ArtistDashboard.tsx
- client/src/pages/ArtistProfile.tsx
- client/src/pages/Home.tsx
- client/src/pages/Login.tsx
- client/src/pages/SEOLandingPage.tsx
- client/src/pages/SharePage.tsx
- client/src/pages/Signup.tsx
- drizzle/schema.ts
- server/email.ts
- server/googleAuth.ts
- server/outreachTemplates.ts
- server/routers.ts
- server/stripeWebhook.ts

**New (untracked) — include for launch:**
- client/src/pages/Pricing.tsx
- drizzle/0021_lead_tier.sql
- drizzle/0022_user_credits_pro_monthly.sql
- drizzle/0023_artist_profile_image_url.sql
- scripts/promote-admins.mts
- scripts/run-migrations.mts
- server/proCredits.ts

**Do not commit:** `.env`, `gigxo env ` (env notes file), or any file containing secrets.

**Exact commands to run (from repo root):**

```bash
cd /Users/tiffanileblanc/Downloads/gigxo-lead-dashboard-main

# Stage all launch code and migrations (exclude env / secrets)
git add client/src/App.tsx client/src/components/DashboardLayout.tsx client/src/components/SiteFooter.tsx client/src/lib/seoConfig.ts
git add client/src/pages/AdminDashboard.tsx client/src/pages/AdminEventWindows.tsx client/src/pages/ArtistDashboard.tsx client/src/pages/ArtistProfile.tsx
git add client/src/pages/Home.tsx client/src/pages/Login.tsx client/src/pages/SEOLandingPage.tsx client/src/pages/SharePage.tsx client/src/pages/Signup.tsx
git add client/src/pages/Pricing.tsx
git add drizzle/schema.ts drizzle/0021_lead_tier.sql drizzle/0022_user_credits_pro_monthly.sql drizzle/0023_artist_profile_image_url.sql
git add server/email.ts server/googleAuth.ts server/outreachTemplates.ts server/routers.ts server/stripeWebhook.ts server/proCredits.ts
git add scripts/promote-admins.mts scripts/run-migrations.mts

# Optional: add docs
git add docs/DEPLOY_CHECKLIST.md docs/FINAL_DEPLOY_VERIFICATION.md docs/PRODUCTION_DEPLOY_RUNBOOK.md

# Commit and push (Railway deploys from main)
git commit -m "Launch: monetization ($1/$7/$15/$49 Pro), pricing page, OAuth fix, leadTier, profile image, migrations 0021-0023"
git push origin main
```

---

## 2. Env vars that must exist in production (Railway)

Set these **before** or at deploy. Do not commit values.

| Variable | Example / note |
|----------|----------------|
| APP_URL | `https://www.gigxo.com` |
| GOOGLE_REDIRECT_URI | `https://www.gigxo.com/api/auth/google/callback` |
| GOOGLE_CLIENT_ID | (from Google Cloud Console) |
| GOOGLE_CLIENT_SECRET | (from Google Cloud Console) |
| STRIPE_SECRET_KEY | `sk_live_...` or `sk_test_...` |
| STRIPE_WEBHOOK_SECRET | (from Stripe Dashboard → Webhooks) |
| VITE_STRIPE_PUBLISHABLE_KEY | `pk_live_...` or `pk_test_...` |
| DATABASE_URL | Production MySQL connection string |
| JWT_SECRET | Strong secret for auth |
| RESEND_API_KEY | (from Resend) |
| BUILT_IN_FORGE_API_URL | Forge storage URL |
| BUILT_IN_FORGE_API_KEY | Forge storage key |

---

## 3. Order of operations

1. **Migrations** — Run the three migrations against the **production** database (Step 4 below).
2. **Deploy** — Trigger deploy on Railway (push to `main` or use Railway dashboard). Ensure build completes and app is healthy.
3. **Admin promotion** — Run promote-admins once the two users have signed up (Step 5 below).
4. **Smoke tests** — Run post-deploy checks (Step 6 below).

---

## 4. Exact production migration command

Replace `YOUR_PRODUCTION_DATABASE_URL` with the real production MySQL URL (or use the same value as in Railway env).

```bash
cd /Users/tiffanileblanc/Downloads/gigxo-lead-dashboard-main
DATABASE_URL="YOUR_PRODUCTION_DATABASE_URL" npx tsx scripts/run-migrations.mts
```

Example (no spaces around `=`):

```bash
DATABASE_URL="mysql://user:password@host:3306/dbname" npx tsx scripts/run-migrations.mts
```

Run from the repo root. Expect: `OK: 0021_lead_tier.sql`, `OK: 0022_user_credits_pro_monthly.sql`, `OK: 0023_artist_profile_image_url.sql`, then `Migrations complete (0021, 0022, 0023).`

---

## 5. Exact admin promotion command

Run **after** deploy, and **after** teryn@gigxo.com and pearlleashworldwide@gmail.com have signed up at least once.

```bash
cd /Users/tiffanileblanc/Downloads/gigxo-lead-dashboard-main
DATABASE_URL="YOUR_PRODUCTION_DATABASE_URL" npx tsx scripts/promote-admins.mts
```

Example:

```bash
DATABASE_URL="mysql://user:password@host:3306/dbname" npx tsx scripts/promote-admins.mts
```

Expect log lines like: `Promoted teryn@gigxo.com (id=…) to admin`, `Promoted pearlleashworldwide@gmail.com (id=…) to admin`. If a user is not found, the script logs "Not found (sign up first): …".

---

## 6. Post-deploy smoke test list

- [ ] **Google login** — Open https://www.gigxo.com/login → Sign in with Google → choose account → confirm redirect to https://www.gigxo.com/dashboard (no blank or “not found” page).
- [ ] **/pricing** — Open https://www.gigxo.com/pricing → page loads; shows $1 first unlock, $7/$15 per lead, $49/mo Pro with 5 credits.
- [ ] **Pro checkout** — Log in → Dashboard → “Pro & Unlock Packs” tab → “Go Pro” → complete Stripe Checkout ($49) → land on dashboard with `?subscribed=1`.
- [ ] **Pro credits** — After Pro signup, open a lead and start unlock; confirm 5 credits appear (or one unlock uses a credit) and behavior is correct.
- [ ] **Admin access** — Log in as teryn@gigxo.com and as pearlleashworldwide@gmail.com (after running promote-admins) → confirm /admin and admin features are accessible.
