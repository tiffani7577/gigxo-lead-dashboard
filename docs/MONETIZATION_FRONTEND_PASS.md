# Front-End Monetization Audit + Implementation Pass

## 1. What was already present

- **Homepage:** Hero, featured leads, “How it works” (3 steps), and a pricing section existed but showed **outdated** pricing (10-Pack $49, 25-Pack $99 instead of Pro $49/mo + 5 credits).
- **Login/Signup:** Basic CTAs and short copy; no mention of $1 first unlock, $7/$15, or Pro.
- **Artist Dashboard:** Scarcity banner (“first unlock $1”), credits display (dollar value), referral copy, and a “Buy Packs” tab with 3-Pack / 10-Pack / 25-Pack. No Pro subscription CTA or pricing page link.
- **No dedicated pricing page** and no Pricing link in nav or footer.
- **Welcome email:** Mentioned “$7” only; no $1 first unlock, $7/$15, or Pro.
- **Numeric inputs:** ArtistProfile already had the min budget / max travel fix (string state + blur sync). AdminEventWindows had raw `value={form.eventYear}` / `value={form.leadDays}` with `parseInt(e.target.value)`, which can cause sticky/unclearable values when the user clears the field.

---

## 2. What was missing and is now implemented

### Public monetization

- **Pricing page** at `/pricing`: Three plans — First Unlock $1, Pay as you go $7/$15, Pro $49/mo (5 credits). Same structure as homepage pricing; nav and footer link to it.
- **Homepage pricing section** updated to match current model: First Unlock $1, Pay as you go $7/$15, Pro $49/mo with 5 credits. “Best value” on Pro. Section id `#pricing` for deep links.
- **Nav:** “Pricing” link added to homepage nav (and Pricing page has Sign In / Sign Up).
- **Footer:** “Pricing” link added in SiteFooter (before Privacy and Terms).
- **Pro subscription CTA** on Artist Dashboard:
  - Scarcity banner now includes “Go Pro for $49/mo and get 5 credits” with link to `/pricing`.
  - “Buy Packs” tab renamed to “Pro & Unlock Packs”; top card is “Pro — $49/month” with “Go Pro” button (only when user is not already Pro). Copy explains 5 credits/month and cancel anytime.
- **Login page:** Card description updated to mention “$1 first unlock, $7/$15 per lead” and “Pro subscription”.
- **Signup page:** Card description updated to “First unlock $1 — then $7 standard or $15 premium leads. Go Pro for 5 credits/month.”
- **Homepage hero and CTA:** Hero line updated to “performer lead marketplace powered by better intelligence” and to list $1 first unlock, $7/$15, $49/mo Pro with 5 credits. Step 3 and footer CTA copy updated to match.

### Messaging / copy

- **Homepage:** Hero, “How it works” step 3, pricing cards, and footer CTA now consistently describe: $1 first unlock, $7 standard, $15 premium, $49/mo Pro, 5 included credits. Positioning: “performer lead marketplace powered by better intelligence.”
- **Login/Signup:** Subtitle and card descriptions updated to reflect the same model.
- **Dashboard:** Scarcity banner and “Pro & Unlock Packs” tab copy updated; Pro card explains 5 credits/month and optional pay-per-lead.

### Email / template

- **Welcome email:** “How it works” list updated: first unlock $1, then $7 standard or $15 premium, or Pro $49/mo with 5 credits. Intro line updated to “performer lead marketplace powered by better intelligence.” Daily digest CTA text changed from “Unlock for $7” to “Unlock from $7”.

### Numeric input bug (sticky “3” / unclearable number)

- **AdminEventWindows:** “Event Year” and “Lead Days (visible before start)” were controlled with `value={form.eventYear}` and `value={form.leadDays}` and `onChange` using `parseInt(e.target.value)`. Clearing the field produced `NaN` and could leave a digit stuck or make the field hard to edit.
- **Fix:** Same pattern as ArtistProfile (min budget / max travel): separate string state `eventYearInput` and `leadDaysInput`; `value` and `onChange` use these strings; `onBlur` parses, clamps, and writes back to `form` and to the string state. Add/Edit open flows set the string state from the window’s values so the inputs display and clear correctly.

---

## 3. Exact files changed

| File | Changes |
|------|--------|
| `client/src/pages/Home.tsx` | Hero copy; Pricing nav link; How it works step 3; pricing section (3 plans: $1 first, $7/$15, Pro $49 + 5 credits); footer CTA; featured “Unlock from $” button text. |
| `client/src/pages/Pricing.tsx` | **New.** Dedicated pricing page with same three plans, nav, and footer. |
| `client/src/App.tsx` | Import Pricing; route `/pricing` before `/:slug`. |
| `client/src/components/SiteFooter.tsx` | “Pricing” link before Privacy/Terms. |
| `client/src/pages/Login.tsx` | Card description: $1 first unlock, $7/$15, Pro. |
| `client/src/pages/Signup.tsx` | Card description: first unlock $1, $7/$15, Pro 5 credits/month. |
| `client/src/pages/ArtistDashboard.tsx` | Scarcity banner: “Go Pro” link to `/pricing` and $49/mo + 5 credits; “Buy Packs” tab → “Pro & Unlock Packs” with Pro card and “Go Pro” button; tab intro copy. |
| `server/email.ts` | Welcome email: intro and “How it works” (first unlock $1, $7/$15, Pro $49 + 5 credits); daily digest “Unlock from $7”. |
| `client/src/pages/AdminEventWindows.tsx` | String state for Event Year and Lead Days; `onBlur` parse/clamp and sync to form; set string state when opening Add/Edit. |
| `docs/MONETIZATION_FRONTEND_PASS.md` | **New.** This summary. |

---

## 4. Deploy readiness

- **Frontend:** Monetization copy, pricing section, Pricing page, Pro CTAs, and login/signup/dashboard messaging are aligned with the current model ($1 first unlock, $7 standard, $15 premium, $49/mo Pro, 5 credits). No new env vars or feature flags.
- **Sitemap:** `client/public/sitemap.xml` already includes `https://www.gigxo.com/pricing`.
- **Design:** Reused existing components and styles; no redesign.

---

## 5. Remaining blockers / notes

- **None required for deploy.** Optional follow-ups:
  - **Outreach templates** (venue/performer one-click send): Still code-only in `server/outreachTemplates.ts`; not editable in admin. Documented in `docs/VERIFICATION_AND_FIXES.md`.
  - **Stripe:** Ensure production Stripe has the correct Pro product/price ($49/mo) and that `subscription.startPremium` and the webhook grant 5 monthly credits as in `server/proCredits.ts` and `server/stripeWebhook.ts`.
  - **Google OAuth:** Keep `APP_URL` and `GOOGLE_REDIRECT_URI` set in Railway as in `docs/VERIFICATION_AND_FIXES.md`.

---

## 6. Quick verification checklist

- [ ] Homepage: hero, pricing section, and footer match $1 / $7 / $15 / $49 Pro / 5 credits.
- [ ] `/pricing`: loads and shows same three plans; nav and footer link work.
- [ ] Login and Signup: card copy mentions first unlock $1 and Pro.
- [ ] Dashboard: scarcity banner has “Go Pro” link; “Pro & Unlock Packs” shows Pro card and “Go Pro” when not subscribed.
- [ ] Welcome email: first unlock $1, $7/$15, Pro $49 + 5 credits.
- [ ] Admin Event Windows: Event Year and Lead Days can be cleared and re-entered without a digit sticking.
