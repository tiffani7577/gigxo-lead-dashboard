# Final Launch-Readiness Verification — Gigxo Monetization

## 1. Stripe Pro subscription

### Live/test product/price for $49/month
- **Code:** Checkout uses **dynamic `price_data`** in `server/routers.ts` (`subscription.startPremium`). No pre-created Stripe Product/Price ID is required; the session is created with `unit_amount: 4900` (cents) and `recurring: { interval: "month" }`.
- **Fix applied:** `unit_amount` was **1900 ($19)**; it is now **4900 ($49)**. Product name updated to "Gigxo Pro".
- **Conclusion:** No Dashboard product/price setup needed. First Pro checkout creates the product. Use **live** Stripe keys in production and **test** keys in development; the same code path works for both.

### Route/button that starts Pro checkout
- **Backend:** `subscription.startPremium` tRPC mutation (no input required; optional `origin` for success/cancel URL).
- **Frontend:** 
  - **Artist Dashboard** → "Pro & Unlock Packs" tab → "Go Pro" button (calls `startPremium()`; redirects to `session.url` when not in demo mode).
  - Scarcity banner "Go Pro" links to `/pricing`; Pricing and Signup pages link to `/signup`; after login, user can go to Dashboard → Pro & Unlock Packs → Go Pro.
- **Flow:** User clicks Go Pro → `startPremium` → Stripe Checkout Session created → redirect to Stripe → payment → redirect to `origin/dashboard?subscribed=1`.

### Webhook logic granting 5 credits after successful subscription
- **checkout.session.completed** → `fulfillSubscription(userId, session.subscription)`.
- **Fix applied:** `fulfillSubscription` now **retrieves the subscription from Stripe** and sets `currentPeriodStart` and `currentPeriodEnd` on the local `subscriptions` row. Previously these were not set, so `ensureProMonthlyCredits` (called on the next lead unlock via `createPaymentIntent`) would exit early and **never grant credits**. With the fix, the period is stored and the next unlock triggers `ensureProMonthlyCredits`, which grants up to 5 credits for that period.
- **Credits are granted lazily:** When the user hits "Unlock" on a lead, `payments.createPaymentIntent` runs and calls `ensureProMonthlyCredits(userId, db)`, which ensures the user has 5 `pro_monthly` credits for the current period; if fewer, it inserts the missing ones. So the first unlock after subscribing (or after renewal) tops them up to 5.

### Monthly renewal reset/credits
- **invoice.payment_succeeded** with `billing_reason === "subscription_cycle"` → `handleSubscriptionRenewal(stripeSubscriptionId)`.
- **Fix applied:** `handleSubscriptionRenewal` now **retrieves the subscription from Stripe** and updates the local row’s `currentPeriodStart` and `currentPeriodEnd`. Previously it only set `status: "active"`, so the period never advanced and `ensureProMonthlyCredits` would not grant a new set of 5 credits for the next month. With the fix, the new period is stored; on the user’s next unlock, `ensureProMonthlyCredits` sees the new period and grants up to 5 credits for it.
- **Fallback:** Invoice subscription ID is read from `invoice.subscription` (string) with a fallback for nested API shape.

---

## 2. Google login

### APP_URL behavior
- **Code:** `server/googleAuth.ts` callback uses:  
  `baseUrl = (state && state.startsWith("http") ? state : null) || process.env.APP_URL?.trim() || ""`  
  then `redirectTo = baseUrl ? \`${baseUrl.replace(/\/+$/, "")}/dashboard\` : "/dashboard"`.
- **Behavior:** If the user arrives with a valid `state` (origin from the login page), that origin is used. Otherwise **APP_URL** is used so the redirect goes to the canonical frontend (e.g. `https://www.gigxo.com/dashboard`) instead of a relative `/dashboard` on the callback host (which could 404).
- **Conclusion:** Correct. Set **APP_URL** in Railway to the canonical frontend origin (e.g. `https://www.gigxo.com`).

### Deployed callback route and www
- **Route:** `GET /api/auth/google/callback` is registered in `server/googleAuth.ts` and mounted in `server/_core/index.ts` **before** `serveStatic`, so the callback is served by the same app that serves the SPA.
- **Conclusion:** Callback works on whatever host the app is deployed on. To work with **www**: set **GOOGLE_REDIRECT_URI** to `https://www.gigxo.com/api/auth/google/callback` (if that’s the deployed URL) and add that exact URI in Google Cloud Console → Credentials → Authorized redirect URIs. No host mismatch if both app and frontend use the same canonical host (e.g. www).

### Host mismatch
- **Avoid:** Using `gigxo.com` in one place and `www.gigxo.com` in another for redirect URI or APP_URL. Use one canonical host everywhere (recommended: **www.gigxo.com**).
- **Conclusion:** No remaining host mismatch in code; correctness depends on env (GOOGLE_REDIRECT_URI, APP_URL) and Google Console matching that canonical host.

---

## 3. Launch blockers and deploy decision

### Safe to deploy now? **Yes.**

All identified code issues have been fixed:
- Pro price set to $49 (4900 cents).
- Fulfill and renewal webhooks set/update subscription period so 5 credits are granted on first unlock and after each renewal.

### Remaining (non-code) checks before/after deploy
- **Railway:** Set `APP_URL` (e.g. `https://www.gigxo.com`). Set `GOOGLE_REDIRECT_URI` to `https://www.gigxo.com/api/auth/google/callback` (or your canonical origin + path). Ensure Stripe env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (for production webhook signing).
- **Stripe Dashboard:** Add webhook endpoint `https://<your-api-host>/api/stripe/webhook` for live mode; subscribe to `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `payment_intent.succeeded`; use the signing secret in `STRIPE_WEBHOOK_SECRET`.
- **Google Cloud Console:** Authorized redirect URI = `GOOGLE_REDIRECT_URI` (e.g. `https://www.gigxo.com/api/auth/google/callback`).

---

## 4. Final test checklist after deploy

1. **Google login (production)**  
   - Open login on production (www).  
   - Sign in with Google → choose account → confirm redirect to `https://www.gigxo.com/dashboard` (or your APP_URL) with no blank/not-found page.

2. **Pro subscription (live or test)**  
   - As a logged-in user, go to Dashboard → Pro & Unlock Packs → click **Go Pro**.  
   - Complete Stripe Checkout ($49 in live, or test card in test mode).  
   - Land on dashboard with `?subscribed=1`.  
   - Unlock a lead (or open a lead and start unlock); confirm credits appear (e.g. 5 credits / $35 value) and that an unlock uses a credit or charges correctly.

3. **Webhook (production)**  
   - In Stripe Dashboard → Developers → Webhooks → select endpoint → confirm `checkout.session.completed` and `invoice.payment_succeeded` (and others) return 200.  
   - After a test Pro signup, confirm in your DB that `subscriptions` has `currentPeriodStart` and `currentPeriodEnd` set for that user.

4. **Pricing and copy**  
   - Homepage and `/pricing` show $1 first unlock, $7/$15 per lead, $49/mo Pro with 5 credits.  
   - Login/signup and dashboard copy match.

5. **Renewal (optional, can test later)**  
   - Use Stripe test clock or wait for first renewal; confirm `invoice.payment_succeeded` runs and that the subscription row’s period dates update; on next unlock, user receives the new period’s 5 credits.
