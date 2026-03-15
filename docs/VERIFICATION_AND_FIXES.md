# Verification and Bug-Fix Pass (No New Features)

This document summarizes the focused verification and fixes applied. No architecture redesign and no new features.

---

## 1. Google Login Production Bug

### Root cause
After Google account selection, the callback redirect could send the user to the **wrong host**, resulting in a small blank "not found" page:

- Login/Signup pass `origin=${window.location.origin}` as `state` (e.g. `https://www.gigxo.com`).
- Callback redirect was: `res.redirect(\`${origin}/dashboard\`)`.
- When `state` was missing or invalid, `origin` was `""`, so the redirect became **relative**: `res.redirect("/dashboard")`.
- The browser then requested `/dashboard` on **whatever host served the callback**. If the callback runs on `gigxo.com` (no www) or an API host, and the SPA is only on `www.gigxo.com`, that host may not serve the app → "not found".

### Files involved
- **`server/googleAuth.ts`** — callback handler and redirect logic; env documentation.

### Fix applied
- **Redirect logic:** Use a configured frontend base URL when `state` is missing or not an absolute URL:
  - `baseUrl = state (if starts with "http") || process.env.APP_URL || ""`
  - `redirectTo = baseUrl ? \`${baseUrl}/dashboard\` : "/dashboard"`
- **Docs:** Header comment updated to document:
  - `GOOGLE_REDIRECT_URI` must match Google Cloud Console exactly (e.g. `https://www.gigxo.com/api/auth/google/callback` if the app is on www).
  - `APP_URL` is the frontend origin used as redirect fallback when `state` is missing (e.g. `https://www.gigxo.com`).

### Railway environment variable
- **Add (recommended):** `APP_URL=https://www.gigxo.com` (or the canonical frontend URL you use).
- **Check:** `GOOGLE_REDIRECT_URI` must be the **exact** URL where the callback is served. If users use `https://www.gigxo.com`, set `GOOGLE_REDIRECT_URI=https://www.gigxo.com/api/auth/google/callback`.

### Google Cloud OAuth setting
- In Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client → **Authorized redirect URIs**, ensure there is exactly:
  - `https://www.gigxo.com/api/auth/google/callback` (if that’s the URL that serves the callback; use the same host as your app).
- Avoid mixing `gigxo.com` and `www.gigxo.com` unless both are intended; use one canonical host and set `GOOGLE_REDIRECT_URI` and `APP_URL` to match it.

---

## 2. Broken Links / Route Verification

### Audit
- **Client routes:** `/login`, `/signup`, `/privacy`, `/terms`, `/dashboard`, `/:slug` (SEO), etc. are defined in `client/src/App.tsx`. Links to these use `<Link href="...">` (wouter).
- **Production serving:** In `server/_core/index.ts`, API routes (including `/api/auth/google/*`) are registered **before** `serveStatic(app)`. In `server/_core/vite.ts`, `serveStatic` uses `express.static` then a catch-all that sends `index.html`, so all non-API paths get the SPA and the client router handles them.

### Conclusion
- **Login/signup:** Point to `/api/auth/google/login?origin=...` (correct). Client routes `/login`, `/signup` exist and are served by the SPA fallback.
- **Privacy/terms:** `/privacy` and `/terms` are defined and linked; they are served by the same SPA fallback.
- **SEO routes:** `/:slug` (SEOLandingPage) is the last route; it correctly catches SEO slugs and is served by the same fallback.
- No broken client-side routes were found. If a specific URL still 404s in production, it may be due to hosting/proxy (e.g. not sending that path to this server); the app code is consistent.

### Fixes applied
- No code changes for routes; audit only. If you have a specific broken URL, share it for targeted fix.

---

## 3. Email Template Editability

### Current state
- **Two separate systems:**
  1. **Code-based templates (one-click send):** Used by Venue Intelligence and Lead Explorer “Send outreach”. Defined in `server/outreachTemplates.ts` (`OUTREACH_TEMPLATES`: venue_intro, follow_up, performer_supply, venue_outreach, performer_outreach). Exposed via `admin.getOutreachTemplates` / `automation.getOutreachTemplates`. **Not editable in the admin UI.**
  2. **DB-backed templates:** Stored in the `templates` table (e.g. targetType: venue_new, venue_existing, performer). Used by the **Admin Outreach Templates** page (`/admin/outreach/templates`) via `admin.getLeadOutreachTemplates` and `admin.updateLeadOutreachTemplate`. **Editable in the admin UI** (create/edit/delete rows).

### Answer
- The **one-click send** templates (Venue Intelligence / Lead Explorer) are **not** editable through the admin UI; they exist in code only.
- **Smallest next step** to make them editable without building a full new system: add a small admin-only view that lists the five code template IDs and allows editing subject/body, persisting to the existing `templates` table (or a small config table), and have the one-click send flow prefer DB/config over code when present. Alternatively, keep them in code and document that copy changes require a code deploy.

---

## 4. States Selector (“3 states stay there and cannot be changed”)

### Search
- Searched the repo for: “states”, “state” (form/selector), “region”, location filters, multi-select, “FL”, “3 state”, etc.
- **Findings:**
  - **ArtistDirectory:** Single-select **Location** chips (Miami FL, Fort Lauderdale FL, etc.) — one at a time; clear by clicking again or “Clear all”.
  - **AdminLeadsExplorer / AdminVenueIntelligence:** **Region** dropdown (single-select).
  - **AdminEventWindows:** **Region** text field (free text).
- No “states” multi-select or “3 states” control was found in performer profile, directory, or onboarding.

### Conclusion
- The “3 states” selector was **not** found in this codebase. It may live under a different name (e.g. “regions”, “locations”), in another app, or the user may be referring to a different control.
- **Recommendation:** If you can specify the exact page or feature (or share a screenshot), we can target that component and fix the update/clear logic.

---

## 5. Final Verification Summary

### Files changed
| File | Change |
|------|--------|
| `server/googleAuth.ts` | Callback redirect uses `APP_URL` when `state` is missing; normalized `baseUrl` and trim trailing slash; updated header comment for `GOOGLE_REDIRECT_URI` and `APP_URL`. |

### Issues confirmed fixed
- **Google OAuth production “not found”:** Addressed by redirecting to an absolute frontend URL using `APP_URL` when `state` is empty, and by documenting correct `GOOGLE_REDIRECT_URI` and `APP_URL` usage.

### Issues still unresolved / no change
- **Routes:** No broken routes identified in code; production 404s would need to be verified per URL (and possibly hosting/proxy).
- **Email templates:** One-click send templates remain code-only; smallest path to editability is documented above (no implementation in this pass).
- **States selector:** “3 states” control not found in repo; need exact page or feature to fix.

### Migrations / environment
- **No DB migrations** from this pass.
- **Environment:** Set `APP_URL` in Railway to your canonical frontend URL (e.g. `https://www.gigxo.com`). Ensure `GOOGLE_REDIRECT_URI` and Google Cloud redirect URI match the host that serves the callback.
