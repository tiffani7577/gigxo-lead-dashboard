# Gigxo Monetization Engine — Implementation Plan

This document is the **Phase 7** minimal-change implementation plan. Implementation proceeds in small, logical steps while keeping the app deployable.

---

## 1. Schema changes

### 1.1 New columns on `gigLeads`

Add to `drizzle/schema.ts` in the gigLeads table (after venue intelligence block, before createdAt):

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `leadMonetizationType` | mysqlEnum | null | artist_unlock, venue_outreach, venue_subscription, direct_client_pipeline |
| `outreachStatus` | mysqlEnum | 'not_sent' | not_sent, queued, sent, replied, interested, not_interested, bounced |
| `outreachAttemptCount` | int | 0 | Number of outreach emails sent |
| `outreachLastSentAt` | timestamp | null | Last outreach send time |
| `outreachNextFollowUpAt` | timestamp | null | Scheduled follow-up |
| `venueClientStatus` | mysqlEnum | null | prospect, contacted, qualified, active_client, archived |
| `subscriptionVisibility` | boolean | false | Include in paid Venue Intelligence subscription product |
| `regionTag` | mysqlEnum | null | miami, fort_lauderdale, boca, west_palm, south_florida |
| `artistUnlockEnabled` | boolean | true | Admin toggle: sell as artist lead |
| `premiumOnly` | boolean | false | Admin: only premium-tier artists can unlock |

- All new columns **nullable** or with safe defaults so existing rows and code paths are unchanged.
- Artist visibility continues to be governed by existing `isApproved`, `isHidden`, `isReserved`, `leadType`, `leadCategory`. `artistUnlockEnabled` is an additional admin kill switch for "sell to artists" path.

### 1.2 New table: `outreachLog`

| Column | Type | Purpose |
|--------|------|---------|
| id | int, PK, autoincrement | |
| leadId | int, notNull | FK to gigLeads.id |
| sentAt | timestamp, defaultNow | When sent |
| templateId | varchar(64) | e.g. venue_intro, follow_up, performer_supply |
| subject | varchar(512) | Subject line used |
| bodyPreview | text | First ~500 chars of body (full body optional) |
| recipientEmail | varchar(320) | Email used |
| status | mysqlEnum | sent, failed, bounced |
| errorMessage | text | If failed |
| scheduledFollowUpAt | timestamp | Optional follow-up date set |
| createdAt | timestamp | |

Indexes: leadId, sentAt.

---

## 2. Backend procedure changes

### 2.1 New procedures (extend `admin` and add `monetization` or keep under admin)

- **admin.setLeadMonetization** — input: leadId, leadMonetizationType?, artistUnlockEnabled?, subscriptionVisibility?, venueClientStatus?, regionTag?, premiumOnly?. Update gigLeads; admin-only.
- **admin.setMonetizationBulk** — input: leadIds[], same fields. Batch update.
- **admin.sendOutreach** — input: leadId, templateId. Validate lead has contactEmail or venueEmail; send via Resend; insert outreachLog; increment outreachAttemptCount, set outreachLastSentAt, outreachStatus = 'sent'. Return success or "no outreachable email".
- **admin.sendOutreachBulk** — input: leadIds[], templateId. Loop with sendOutreach; return { sent, skipped, errors }.
- **admin.getOutreachTemplates** — return list of template ids and labels (venue_intro, follow_up, performer_supply) with subject/body from config.
- **admin.scheduleFollowUp** — input: leadId, outreachNextFollowUpAt. Update gigLeads.
- **admin.getOutreachLog** — input: leadId. Return outreachLog rows for that lead.

### 2.2 Changes to existing procedures

- **admin.getVenueIntelligenceLeads** — Add to select: leadMonetizationType, outreachStatus, outreachAttemptCount, outreachLastSentAt, venueClientStatus, subscriptionVisibility, regionTag, artistUnlockEnabled, premiumOnly. Add to input filters: leadMonetizationType, outreachStatus, venueClientStatus, subscriptionVisibility, regionTag. Keep existing venueStatus/city/licenseType/searchText.
- **admin.getLeadsExplorer** — Add same new columns to select; add same filters to input. No change to artist visibility logic.
- **admin.updateLead** — Allow updating artistUnlockEnabled, premiumOnly, subscriptionVisibility, leadMonetizationType, venueClientStatus, regionTag, outreachNextFollowUpAt (and existing fields). Admin-only.
- **leads.getAvailable** — When building artist-visible list, additionally filter: artistUnlockEnabled !== false (treat null as true for backward compat). Respect premiumOnly when we have a subscription tier (existing premium check if any; else show all).
- **payments.createPaymentIntent** — Reject if lead.artistUnlockEnabled === false. If premiumOnly, require active premium subscription for the user before allowing unlock (check subscription tier).

### 2.3 Venue Intelligence subscription (new product)

- **venueIntel.getSubscriptionEligibility** — Check if user has subscription tier that includes venue intel (e.g. new tier "venue_intel" or reuse premium with a flag). Return { eligible: boolean, tier? }.
- **venueIntel.getVenues** — input: limit, offset, regionTag?, venueClientStatus?, searchText?. Query gigLeads where leadType = 'venue_intelligence' AND subscriptionVisibility = true. Return read-only list (no update/delete). Protected; require eligible subscription.
- **subscription** — If adding new tier: add tier 'venue_intel' or 'premium_venue' to subscriptions table enum; Stripe product for "South Florida Venue Intelligence"; webhook branch to set tier. Alternatively: use existing premium and add a flag hasVenueIntelAccess.

---

## 3. Frontend admin changes

### 3.1 Venue Intelligence page (`AdminVenueIntelligence.tsx`)

- Add filter dropdowns: Monetization type, Region, Outreach status, Client status, Subscription visible (Y/N). Wire to getVenueIntelligenceLeads new params.
- In table: show columns (or compact badges) for monetization type, outreach status, artist unlock (Y/N), subscription visible (Y/N), client status.
- In row actions or detail panel: buttons "Mark as Sell to Artists", "Send Outreach", "Add to Subscription Pool", "Convert to Client Pipeline". Each calls setLeadMonetization or setMonetizationBulk with appropriate flags.
- "Send Outreach" opens small modal: select template (venue_intro, follow_up, performer_supply), then Send. Show "No outreachable email" when contactEmail and venueEmail both null.
- Show outreach log for lead (e.g. expandable or side panel): last sent, template, status.
- Schedule follow-up: date picker + scheduleFollowUp.

### 3.2 Lead Explorer (`AdminLeadsExplorer.tsx`)

- Add same filters: monetization type, region, outreach status, client status, subscription visibility. Add columns/badges for monetization path, outreach status, artist unlock enabled, subscription visible.
- Same one-click actions in row/detail: Mark as Sell to Artists, Send Outreach, Add to Subscription Pool, Convert to Client Pipeline.
- Bulk: select rows, then "Bulk set monetization" or "Bulk send outreach" (with template picker).

### 3.3 Update lead form / detail

- Where admin edits a single lead (updateLead): add fields for unlock price, artist unlock enabled, premium only, subscription visibility, monetization type, venue client status, region tag. Optional: outreach next follow-up.

---

## 4. Frontend artist changes

### 4.1 Artist dashboard lead cards (`ArtistDashboard.tsx`)

- Keep existing unlock flow. Add:
  - Region badge (e.g. "Miami", "South Florida") from regionTag or location.
  - "New" badge already exists; ensure "fresh" (e.g. created in last 7 days) is clear.
  - Unlock price clearly shown (already present; reinforce).
  - Lead type badge (e.g. Wedding, Corporate) from eventType.
  - Intent score meaningfully displayed (e.g. "High intent" / "Medium" / "Low" from intentScore band).
- Do not remove contact badges (Email available, Phone available, Facebook Lead).

### 4.2 Admin control (already in updateLead)

- Admin can set per lead: unlockPriceCents, artistUnlockEnabled, premiumOnly, subscriptionVisibility. These are stored and enforced in getAvailable and createPaymentIntent.

---

## 5. Subscription product changes

### 5.1 Venue Intelligence subscription (new)

- New route or section: `/venue-intel` or under `/dashboard` for eligible users (e.g. "Venue Intelligence" tab or link). Gated: if no venue_intel subscription, show upgrade CTA.
- Page: searchable/filterable list from venueIntel.getVenues (region, status, search). Read-only cards: venue name, location, type, status, last contacted (optional). No approve/reject, no send outreach.
- Optional: Export button (CSV placeholder or simple client-side export of current page).

### 5.2 Subscription tier

- Option A: Add new Stripe product "South Florida Venue Intelligence" and tier `venue_intel` in subscriptions; webhook sets tier; venueIntel.getSubscriptionEligibility checks tier.
- Option B: Extend existing premium to include venue intel (hasVenueIntelAccess = true for premium); no new Stripe product. Simpler; less revenue segmentation.

Recommendation: Option B for first release; add dedicated tier later if needed.

---

## 6. Migration / backfill plan

### 6.1 Drizzle

- Add new columns to gigLeads in schema.ts. Add outreachLog table.
- Run `pnpm db:generate` to generate migration (or use push if project uses push).
- Run migration on dev/staging first, then production.

### 6.2 Backfill (one-time script or inline migration)

- For all rows where leadType = 'venue_intelligence' (or leadCategory = 'venue_intelligence'):
  - Set leadMonetizationType = 'venue_outreach' (or 'venue_subscription' if we want them in pool by default).
  - Set outreachStatus = 'not_sent'.
  - Set outreachAttemptCount = 0.
  - Set venueClientStatus = 'prospect'.
  - Set subscriptionVisibility = false (opt-in to subscription pool).
  - Set regionTag from location: if location contains "Miami" -> miami; "Fort Lauderdale" / "Broward" -> fort_lauderdale; "Boca" -> boca; "West Palm" -> west_palm; else south_florida.
  - artistUnlockEnabled = false for venue intel (they are not sold as artist leads today).
- Existing artist-facing leads: leave new columns null/false; artistUnlockEnabled default true so behavior unchanged.

### 6.3 Outreach templates (code/config)

- Add server/outreachTemplates.ts (or in config): array of { id, label, subject, body } for venue_intro, follow_up, performer_supply. Body can use placeholders like {{venueName}}, {{location}}.

---

## 7. Risks / things that might break

- **Artist visibility:** If artistUnlockEnabled is not defaulted correctly, some leads could disappear from artist list. Mitigation: default true; backfill only venue_intelligence to false.
- **Payment flow:** Rejecting createPaymentIntent when artistUnlockEnabled === false must be tested; ensure error message is clear.
- **Premium-only leads:** If premiumOnly is true, non-premium users must see a clear "Premium lead" or upgrade CTA instead of unlock button. Implement after subscription check is reliable.
- **Outreach rate limits:** Resend has limits. Bulk send should throttle (e.g. 1 req/sec) or batch size cap to avoid bounce.
- **Schema push vs migrate:** If production uses manual SQL, provide additive SQL for new columns and outreachLog table so deploy doesn’t fail.

---

## 8. Deployment order

1. **Schema + migration:** Add columns and outreachLog; run migration; deploy backend that still ignores new columns (no behavior change).
2. **Backfill:** Run backfill for venue_intelligence leads (defaults).
3. **Backend procedures:** Add setLeadMonetization, setMonetizationBulk, sendOutreach, sendOutreachBulk, getOutreachTemplates, getOutreachLog, scheduleFollowUp. Extend getVenueIntelligenceLeads and getLeadsExplorer (select + filters). Extend updateLead. Add artistUnlockEnabled filter in getAvailable; add createPaymentIntent rejection for artistUnlockEnabled === false.
4. **Outreach templates + email:** Add templates config; implement sendOutreach using Resend (reuse server/email.ts pattern).
5. **Admin UI:** Venue Intelligence filters and actions; Lead Explorer filters and actions; outreach modal and log.
6. **Artist UI:** Badges and labels (region, intent, price); no change to unlock flow yet.
7. **Venue Intel subscription:** venueIntel.getVenues, eligibility check, new page for subscribers.
8. **South Florida copy:** Replace generic labels with "South Florida" and sub-regions in marketplace/positioning only; leave SEO slugs as-is.

---

*Next: implement Phase 1 (schema + backfill), then Phase 2–6 in order.*
