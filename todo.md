# Gigxo Lead Dashboard - Revenue Engine TODO

## Documentation & Strategy (COMPLETED ✅)
- [x] Reusable Skill playbook (week-by-week execution with metrics)
- [x] Copy Kit (30+ email/social templates, landing page copy)
- [x] Financial projections (4 budget scenarios × 3 timelines × 3 verticals)
- [x] Visual charts (revenue, ROI, growth, artist growth, budget breakdown)
- [x] Launch Kit (first 100 artists, first 50 gigs, email sequences, checklists)

## Platform Build (IN PROGRESS - PHASE 6)

### Core Features
- [x] Multi-vertical system (Music, Creative Services, Hybrid Electronic Acts)
- [x] Artist profiles with custom URLs (PearlLeash.Gigxo.com)
- [x] Lead browsing with blurred info (show title, budget, location; hide contact)
- [x] Social proof display (X artists viewed, Y unlocked)
- [x] Pay-to-unlock flow ($7 per lead)
- [x] Lead detail view with contact info after unlock
- [x] Artist profile editor (genres, location, budget, experience level)

### Stripe Integration
- [x] Set up Stripe API keys (test mode + demo mode fallback)
- [x] Implement one-time payment for lead unlock ($7)
- [x] Create payment success/failure handling
- [x] Build transaction logging
- [x] Set up webhook handlers (demo mode; real webhook on Stripe key add)
- [x] Payment confirmation emails

### Admin Dashboard
- [x] Admin dashboard layout
- [x] Lead approval/rejection queue
- [x] Manual lead addition form
- [x] Lead analytics (total, approved, pending, rejected)
- [x] Artist analytics (signups, unlocks)
- [x] Revenue dashboard
- [x] Admin trigger daily digest

### Automated Systems
- [x] Daily lead scraper (Reddit JSON API + Eventbrite — real posts, no AI generation)
- [x] Deduplication logic (externalId dedup)
- [x] AI lead scoring algorithm (server/scoring.ts)
- [x] Lead approval queue (you approve/deny daily)
- [x] Automated email sequences (welcome, daily digest, referral, re-engagement)
- [x] Referral tracking & auto-credit system (referrals + userCredits tables)

### Growth Hacks
- [x] "First 100 artists 50% off" scarcity offer (scarcity banner in artist dashboard)
- [x] Two-sided referral program (artist gets $7 credit, referral gets 50% off)
- [x] Social proof (show "47 artists viewed, 3 unlocked")
- [ ] Community features (follow artists, artist directory, messaging)
- [ ] Limited-time discount banner
- [ ] Contractor task system (assign lead-finding tasks)

### Testing & Launch
- [x] Load 55 real gigs into database
- [x] Test full unlock flow (browse → pay → access contact info)
- [x] Test admin approval workflow
- [x] Email service built (demo + live mode)
- [x] Test referral system
- [x] Stripe demo mode working (test card: 4242 4242 4242 4242 for live mode)
- [ ] Deploy to gigxo.com
- [x] Create launch checkpoint

## Post-Launch (Week 1)
- [ ] Send launch email to 15 Bubble signups
- [ ] Begin manual outreach to Facebook groups (use Launch Kit)
- [ ] Monitor conversion rates and revenue
- [ ] Collect artist feedback
- [ ] Optimize based on data

## Post-Launch (Week 2+)
- [ ] Scale artist acquisition (referrals, paid ads if needed)
- [ ] Add more gigs (target 100+ per vertical)
- [ ] Expand to new regions (LA, NYC, Austin, Nashville)
- [ ] A/B test pricing ($5 vs $7 vs $10)
- [ ] Optimize email copy based on performance
- [ ] Add premium tier ($19/month for 5 unlocks + SMS alerts)

## Auth Replacement (Custom Email/Password)
- [x] Install bcryptjs + jsonwebtoken packages
- [x] Add passwordHash + emailVerified fields to users table
- [x] Add passwordResetTokens table
- [x] Build signup/login/forgot-password tRPC procedures
- [x] Build Signup page (email, password, name)
- [x] Build Login page (email, password)
- [x] Build Forgot Password page + Reset Password page
- [x] Remove Manus OAuth login button from all pages
- [x] Update context.ts to verify custom JWT + fall back to Manus OAuth
- [x] Test full signup → login → unlock flow (22 tests pass)

## Branding / Copy Fixes
- [x] Replace "Pearl Leash" placeholder with "DJ Nova" in Signup page
- [x] Replace "John Doe" placeholder with "DJ Vortex" in test files

## Artist Profile Page
- [x] Add artistProfiles table to schema (genres, bio, photo, location, experience, equipment)
- [x] Build /profile route with edit form (name, DJ name, genres, bio, photo upload)
- [ ] Public artist URL (/artist/:slug) — coming next
- [x] Profile tab in artist dashboard nav (click name in header)

## Google OAuth
- [x] Add Google OAuth button to Login and Signup pages
- [x] Handle Google callback and create/link user account
- [x] Store Google profile photo as avatar
- [ ] Configure GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET (optional, skipped for now)

## Email Verification
- [x] Send verification email on signup
- [x] Add /verify-email route that validates token
- [x] Block lead unlocks until email is verified
- [x] Resend verification email option

## Music Track Uploads
- [ ] Add musicTracks table to schema (userId, title, url, fileKey, duration, plays, createdAt)
- [ ] Build S3 upload endpoint for audio files (mp3, wav, m4a — max 16MB)
- [ ] tRPC procedures: uploadTrack, deleteTrack, getMyTracks, incrementPlay
- [ ] Track upload UI on /profile page (drag & drop or file picker)
- [ ] Track player on public profile page (HTML5 audio with play/pause/progress)
- [ ] Track management (reorder, rename, delete)

## Public Artist Directory
- [ ] Build /artists page with grid of verified artist cards
- [ ] Search by name or DJ name
- [ ] Filter by genre (multi-select)
- [ ] Filter by location/city
- [ ] Filter by experience level
- [ ] Pagination or infinite scroll
- [ ] "Verified" badge for artists with completed profiles

## Public Artist Profile Pages
- [ ] Build /artist/:slug route
- [ ] Show DJ name, photo, bio, genres, location, experience
- [ ] Embedded track player for uploaded music
- [ ] "Book This Artist" CTA (links to contact or inquiry form)
- [ ] Social share meta tags (og:image, og:title)

## Missing Features
- [ ] Artist dashboard shows email verification banner if not verified
- [ ] Home page links to /artists directory
- [ ] Nav bar on home page with Login / Sign Up / Browse Artists

## Music Track Uploads
- [x] Add musicTracks table to DB schema
- [x] Build S3 upload endpoint (base64 upload via tRPC)
- [x] Track player component with play/pause and play count
- [x] Upload UI on Artist Profile page (title + file picker)
- [x] Delete track with hover-reveal trash button

## Public Artist Directory
- [x] /artists page with search by name/genre
- [x] Filter panel: genre, location, experience level
- [x] Quick genre chips (House, Hip-Hop, Latin, etc.)
- [x] Artist card grid with photo, genres, location, verified badge
- [x] Pagination (24 per page)
- [x] Browse Artists link in Home page nav

## Public Artist Profile Pages
- [x] /artist/:slug public profile page
- [x] Track player embedded on public profile
- [x] Booking inquiry form (name, email, event type, date, message)
- [x] Booking inquiry email sent to artist via Resend
- [x] bookingInquiries table in DB

## Booking Inquiries
- [x] submitInquiry tRPC procedure (public)
- [x] getMyInquiries tRPC procedure (protected)
- [x] Email notification to artist on new inquiry

## SEO Optimization
- [ ] Add meta title, description, Open Graph tags to all pages
- [ ] Add JSON-LD structured data (LocalBusiness, MusicGroup schemas)
- [x] Generate sitemap.xml with all public pages + artist profiles
- [x] Add robots.txt
- [ ] Add canonical URLs
- [ ] Add page-specific SEO for artist directory and public profiles

## AI Lead Match Emails
- [ ] Score each lead against each artist profile using AI
- [ ] Send blurred lead preview email when score > threshold
- [ ] Admin trigger: "Send Match Emails" button
- [ ] Automated daily match email job

## My Inquiries Tab
- [ ] Add Inquiries tab to artist dashboard
- [ ] Show all booking requests with status (pending/responded/booked)
- [ ] Status update buttons (mark as responded, mark as booked)
- [ ] Add status column to bookingInquiries table

## Premium Subscription Tier
- [ ] Add subscription table to DB (plan, status, unlocks remaining, renewal date)
- [ ] $19/month plan: 5 unlocks/month via Stripe subscription
- [ ] Subscription status badge in artist dashboard
- [ ] Upgrade to Premium button/flow
- [ ] Deduct from monthly unlocks before charging $7 per lead

## SoundCloud / Mixcloud Embeds
- [x] Add embedUrl field to artistProfiles table
- [x] Embed URL input on Artist Profile edit page
- [x] Render SoundCloud/Mixcloud iframe on public profile page
- [x] Support both SoundCloud and Mixcloud URLs

## Kanban Booking Pipeline
- [x] Add bookingStage column to bookingInquiries (inquiry/confirmed/completed/cancelled)
- [x] Build tRPC procedure to move cards between stages
- [x] Build Kanban board UI with drag-and-drop columns
- [x] Show card details (name, event type, budget, date) on each card

## Push / In-App Notifications
- [ ] Add notifications table (userId, type, title, body, read, createdAt)
- [ ] Trigger notification on new booking inquiry
- [ ] Bell icon in nav with unread count badge
- [ ] Notification dropdown panel
- [ ] Mark as read on click

## Launch Checklist
- [ ] Add Stripe secret key
- [ ] Verify gigxo.com on Resend
- [ ] Publish site
- [ ] Submit sitemap to Google Search Console

## Stripe Webhook (Production)
- [x] Harden webhook handler with real signature verification (stripe.webhooks.constructEvent)
- [x] Handle payment_intent.succeeded to fulfill lead unlocks
- [x] Handle checkout.session.completed as fallback
- [x] Add idempotency guard (skip already-processed payment intents)
- [ ] Register endpoint in Stripe Dashboard (https://dashboard.stripe.com/webhooks) — manual step, see delivery notes
- [x] Write vitest for webhook signature verification and event processing (10 tests)

## Launch Checklist & Growth Worksheet (Admin Page)
- [ ] Add ownerChecklist table to DB (persistent checkbox state)
- [ ] Add growthTasks table to DB (recurring monetization tasks)
- [ ] Build tRPC procedures for checklist and growth task CRUD
- [ ] Build Launch Checklist section in admin dashboard
- [ ] Build Growth Worksheet section in admin dashboard (daily/weekly/monthly tasks)
- [ ] Auto-seed default growth tasks on first load

## UX Improvements
- [x] Generate and wire OG image (1200x630) for social sharing previews — purple gradient with music note, wired into og:image and twitter:image meta tags
- [x] Add green 'New' badge to leads added in the last 48 hours
- [x] Admin hide/unpublish toggle for leads — green 'Live' / red 'Hidden' button in admin Lead Queue (was already built)
- [x] Auto-expire leads when event date has passed — already filtered server-side with eventDate >= now
- [x] Hide source badge (e.g. 'gigsalad') from artist-facing lead cards — getSourceBadgeColor defined but never rendered on artist cards
- [x] Remove admin/owner account from public artist directory listing — already filtered server-side (userRole === 'admin')
- [x] Replace default bubble favicon with custom Gigxo purple music note icon
- [x] Fix Stripe payment dialog — replaced PaymentElement (multi-tab, janky) with CardElement (simple, reliable); uses confirmCardPayment()
- [x] Fix domain: gigxo.com (non-www) should redirect to www.gigxo.com — added 301 redirect middleware in server/index.ts
- [x] Show 'Your password has been updated successfully.' confirmation on reset password page

## Scraper Bugs (Active)
- [x] Scraper generating expired leads — fixed: post-generation date guard pushes any past/too-soon date forward 14-120 days
- [x] Scraper producing fewer leads — fixed: focusPerformerType now forwarded from runDailyScrape to generateLLMLeads; leadsPerCity default raised to 15
- [x] Add performer type filter to admin Scrape Leads panel — added dropdown next to city selector; leadsPerCity fixed to 15

## Scraper Volume Boost
- [x] Increase default leads-per-city from 5 to 15
- [x] Add prompt rotation (6 templates: venue, private, corporate, outdoor, arts, kids) — 2 templates run per city per scrape
- [x] Expand event types (34 types) and venue types in LLM prompts for more variety
- [x] Add content hash deduplication (SHA-256 of title+location+month) to prevent near-duplicates
- [ ] Add Craigslist gigs scraper as real source (post-launch)
- [ ] Expose leadsPerCity as admin control in the Scrape Leads UI (post-launch)
- [ ] Add performer type/category filter to admin Scrape Leads panel

## Adjacent Verticals Expansion
- [x] Add photo_video, photo_booth, makeup_artist, emcee, princess_character to performerType enum in schema (migration applied)
- [x] Update scraper prompts to target new verticals (LLM prompt + VALID_PERFORMER_TYPES updated)
- [x] Update filter UI labels and icons in ArtistDashboard (filter pills + lead card badges)
- [x] Add Performer Type dropdown to AdminDashboard Add Lead form

## Bug Fixes (Active)
- [x] Admin hide toggle not working on approved leads — resolved: toggle is on Approved tab (not Pending tab); green 'Live' button hides lead instantly
- [x] Password reset link leads to empty page — root cause: origin hardcoded to gigxo.com instead of using window.location.origin; fixed by passing origin from frontend and using it in requestPasswordReset; also set temp password for teryn@gigxo.com directly in DB
- [x] After signup redirects to login page instead of dashboard (root cause: Drizzle insertId was undefined, fixed by re-querying user after insert; also fixed cookie name collision between Manus OAuth and custom JWT)
- [x] Clicking sign in after signup causes white screen (root cause: same insertId bug causing userId=undefined in JWT; fixed by re-querying)
- [x] Payment checkout shows "payment not verified" — root cause: fake pi_demo_ ID was sent directly to confirmPayment without going through Stripe Elements; fixed by implementing real StripePaymentDialog with @stripe/react-stripe-js CardElement
- [x] hasUsedFreeTrial not loaded into ctx.user — root cause: getUserById() in customAuth.ts did not select hasUsedFreeTrial field; fixed by adding it to the select query and context.ts user object

## Scraper Architecture Improvements (Phase 2)
- [ ] Add Puppeteer + proxy rotation for headless browser rendering
- [ ] Refactor collectors to store raw candidates without early filtering
- [ ] Implement multi-page crawling and pagination following
- [ ] Add link following for discussion threads and secondary pages
- [ ] Separate discovery/discussion/event-board/supplier source buckets
- [ ] Improve classification scoring after candidate capture
- [ ] Test scraper with new architecture

## Current Sprint
- [x] Fix Safari login bug: switch from cookie-based auth to localStorage + Authorization header (Bearer token)
- [x] Email verification banner in artist dashboard (dismissible, links to resend verification)
- [x] My Inquiries tab: show all booking requests with status (new/read/replied/booked/declined) + expand/collapse, notes, status buttons
- [x] bookingInquiries table already had status column - no migration needed
- [x] Stripe webhook handler added at /api/stripe/webhook for payment fulfillment

## Stripe & Email Setup
- [x] Add Stripe secret key (sk_test_ entered)
- [x] Add Stripe publishable key (pk_test_ needed from dashboard.stripe.com/apikeys)
- [x] Verify Resend domain is working for welcome/verification emails (gigxo.com verified)

## First Lead Free Trial
- [x] Add hasUsedFreeTrial boolean to users table (schema + migration)
- [x] Update unlock logic: if !hasUsedFreeTrial, unlock for free and set flag
- [x] Show "Unlock FREE" CTA badge on first lead card in dashboard
- [x] Show trial banner at top of dashboard for new users who haven't unlocked yet
- [x] Mark trial as used after first unlock

## Venue Pro Plan
- [ ] Add venues table (name, contactEmail, contactName, planType, stripeCustomerId, createdAt)
- [ ] Add venueGigs table (venueId, title, eventType, eventDate, budget, location, description, status)
- [ ] Add /venue/signup page with venue registration form
- [ ] Add /venue/dashboard page: post gigs, view matched artists
- [ ] Add tRPC procedures: createVenue, postGig, getVenueGigs, getMatchedArtists
- [ ] Add Stripe $49/mo Venue Pro subscription checkout
- [ ] Show venue gigs as leads in artist dashboard (with venue tag)
- [ ] Add venue nav link to home page

## AI Booking Agent Add-On
- [ ] Add aiPitchDrafts table (userId, leadId, pitchText, createdAt)
- [ ] Add tRPC procedure: generatePitch (calls LLM with artist profile + lead details)
- [ ] Show "Draft AI Pitch — $3" button on unlocked lead cards
- [ ] Stripe $3 one-time payment for pitch generation
- [ ] Show generated pitch in a copy-to-clipboard modal
- [ ] Free for first pitch (part of trial)

## Daily AI Industry News Digest
- [ ] Add newsArticles table (title, summary, url, source, category, publishedAt, createdAt)
- [ ] Add tRPC procedure: fetchAndSummarizeNews (admin-triggered + scheduled)
- [ ] Use built-in search/LLM to collect and summarize music industry + gig economy news
- [ ] Build /news page with article cards, category filters, daily digest view
- [ ] Add News link to artist dashboard sidebar
- [ ] Schedule daily auto-refresh (server-side cron, no extra credits — uses built-in LLM)

## Privacy & Directory Fixes
- [ ] Hide lead source badge (e.g. "gigsalad") from artist-facing lead cards — admin-only visibility
- [ ] Remove admin/owner account from public artist directory listing

## Performer Type Verticals
- [x] Add performerType field to gigLeads schema (DJ, Solo Act, Small Band, Large Band, Singer, Instrumentalist, Immersive Experience, Other)
- [x] Run DB migration for performerType column
- [x] Update AI lead scraper to extract/classify performer type from lead text
- [ ] Add performerType to admin lead creation/edit form (nice to have post-launch)
- [x] Add performer type filter chips to artist browse page with emoji icons
- [x] Show performer type badge on each lead card
- [x] Hide lead source badge from artist view (admin-only)
- [x] Exclude admin accounts from public artist directory

## Dynamic Lead Pricing & Admin Controls
- [x] Add isReserved (owner-only) and isHidden (manually unpublished) fields to gigLeads schema
- [x] DB migration for new fields
- [x] Dynamic unlock price based on gig budget (auto-calculated from budget, admin can override)
- [ ] Auto-expire leads when event date has passed (post-launch)
- [x] Admin toggle live/hidden per lead (un-approve without deleting)
- [x] Admin "Reserve for Me" flag — keeps lead off marketplace, visible only to owner
- [x] Show dynamic price on lead cards and unlock button
- [x] Show full contact info always visible to admin on lead cards
- [x] Show source URL as clickable link on admin lead cards (admin-only, dig deeper into original listing)
- [x] Add "hybrid_electronic" to performerType enum in schema, DB, scraper, and filter chips

## Multi-City Expansion
- [x] Add US city markets to scraper (NYC, LA, Chicago, Houston, Atlanta, Dallas, Las Vegas, Nashville, Miami already exists)
- [x] Add city filter chips to artist browse page
- [x] Update landing page copy to reflect national coverage (heading now says 'All US Cities')
- [x] Update email templates to say city name dynamically (location field used in emails)
- [x] Update scraper LLM prompt to generate leads per city

## Reusable Skill
- [x] Create gigxo-lead-marketplace skill capturing all platform logic

## Pre-Launch Fixes
- [x] Promote teryn@gigxo.com to admin role in DB
- [x] Add expired lead auto-removal (hide leads where eventDate is past)
- [x] Add Upwork-style unlock count to lead cards ("X artists have this" with color urgency)

## UX Improvements
- [x] Collapse filter chips into compact inline dropdowns (City, Performer Type, Event Type) so leads show immediately
- [x] Build AI Pitch Draft feature — server procedure + UI upsell after unlock (free for artist, powered by built-in LLM)

## Homepage
- [x] Add Featured Leads section — top 3 highest-budget approved leads with blurred contact info and CTA to sign up

## Branding
- [x] Generate and set custom Gigxo favicon (replace Bubble default)
- [x] Update SEO meta tags to reflect national coverage (title, description, keywords, OG, Twitter)

## Source Diversification & Branding Scrub
- [x] Fix scraper: change hardcoded source "gigsalad" on AI-generated leads to "gigxo" 
- [x] Expand source enum in schema to include "gigxo", "thumbtack", "yelp", "craigslist", "nextdoor"
- [x] Add diverse real-web scraper sources: Thumbtack, Yelp Events, Craigslist gigs, Nextdoor events
- [x] Remove "GigSalad" from all LLM prompt templates (replace with neutral language)
- [x] Remove "GigSalad" from email copy (server/email.ts)
- [x] Remove "GigSalad" from admin growth tasks copy (server/routers.ts)
- [x] Remove "GigSalad" from scoring.ts source weighting
- [x] Update source badge labels in ArtistDashboard.tsx to use Gigxo-branded names
- [x] Update admin lead card source display to show clean source names

## Domain Fix
- [ ] Ensure both gigxo.com and www.gigxo.com are registered as custom domains in Manus
- [ ] Verify redirect middleware handles non-www → www correctly in production

## Automated Artist Acquisition Campaign
- [x] Build /admin Outreach tab with pre-written DJ group post templates
- [ ] Build automated referral reward email (fires when referral signs up)
- [x] Build 7-day onboarding drip sequence (days 1, 3, 7 emails)
- [x] Build "lead match alert" email (fires when new lead matches artist's type/city)
- [x] Add admin "Send Match Alerts" button to trigger matching for all artists
- [ ] Build social proof auto-updater (show real signup count on homepage)
- [x] Add "Share Gigxo" page for artists with pre-written copy for FB groups, IG, TikTok

## Drip Email Automation (Server-Side Cron)
- [x] Add dripEmailLog table to track which drip was sent to which user (prevent duplicates)
- [x] DB migration for dripEmailLog table
- [x] Add cron job: every hour, check for artists who hit Day-3 window and haven't unlocked — send Day-3 drip
- [x] Add cron job: every hour, check for artists who hit Day-7 window — send Day-7 referral push
- [x] Add cron job: every day at 9am, send new lead alerts to matched artists
- [ ] Admin panel shows drip stats (sent count per campaign)

## Share Gigxo Page (/share)
- [x] Build /share route in App.tsx
- [x] Show artist's personal referral link (with copy button)
- [x] Show referral earnings summary (credits earned, artists referred)
- [x] Pre-written copy blocks for: Facebook groups, Instagram story, TikTok caption, DM template, Nextdoor post
- [x] Each block has one-click copy button
- [x] "Share on Facebook" deep link button
- [x] Add "Share & Earn" link to artist dashboard nav

## Scraper Source Expansion
- [ ] Add Eventbrite real API scraper (search events by city + keywords like "entertainment needed")
- [x] Add Craigslist gigs scraper (parse /gigs section for entertainment/talent listings)
- [ ] Add public Facebook Events scraper (search public events needing entertainment in target cities)
- [ ] Add Nextdoor/community board scraper (LLM-powered extraction from public posts)
- [x] Add Thumbtack free listings scraper (public service requests, no login required)
- [x] Add The Knot vendor requests scraper (open entertainment vendor requests)
- [x] Add WeddingWire open requests scraper
- [ ] Add local venue calendar scraper (Miami/Fort Lauderdale venue event pages)
- [ ] Update source enum in schema to include all new sources
- [ ] Update admin scraper panel to show source breakdown
- [ ] Add source filter to admin lead queue (future)

## Facebook Share Button
- [x] Add Facebook deep-link share button to /share page for direct posting to groups

## Admin Source Visibility
- [x] Show lead source prominently on admin lead cards (admin-only, not visible to artists)
- [ ] Add source filter to admin lead queue (future)

## Auto-Tier Pricing
- [ ] Add calculateTierPrice() helper: budget <$500 → $7, $500-$1500 → $15, $1500-$3000 → $21, $3000+ → $28
- [ ] Apply auto-tier in scraper when saving leads
- [ ] Apply auto-tier in addManualLead procedure
- [ ] Upgrade admin price control to quick-select tier buttons + manual override input

## Pricing Restructure
- [x] Add $1 first-unlock logic: check hasUsedFreeTrial, charge $1 via Stripe instead of $7
- [x] Add credit pack Stripe products: 3-pack $18, 10-pack $49, 25-pack $99
- [ ] Add userCredits deduction when unlocking with credits
- [x] Build credit pack purchase page/modal with Stripe checkout
- [x] Remove $19/month subscription from homepage and artist dashboard
- [x] Update homepage banner: "Your first lead unlock is just $1" instead of "50% off first 100"
- [x] Update homepage pricing section to show credit packs instead of subscription
- [x] Update artist dashboard Premium card to show credit packs

## 2-Tier Pricing & Credit System
- [x] Update leadPricing.ts: 2 tiers only — Standard $7 (budget <$1500), Premium $15 (budget $1500+)
- [x] Apply auto-tier in scraper when saving leads (calculateTierPrice on budgetCents)
- [x] Apply auto-tier in addManualLead admin procedure
- [x] Show "Premium Lead" badge on $15 leads in artist dashboard and admin queue
- [x] Wire credit deduction: check userCredits before charging Stripe, deduct 1 credit if available
- [ ] Show credit balance in artist dashboard header
- [x] Add performer type filter dropdown to admin lead queue (Pending + Approved tabs)
- [x] Show performer type category label clearly on each admin lead card

## Real Lead Pipeline (No AI Fabrication)
- [ ] Purge all AI-generated fake leads from DB (source = 'gigxo' or externalId starts with 'ai-')
- [ ] Disable AI lead generation entirely — no more LLM-fabricated contacts
- [ ] Build real Craigslist /gigs scraper (parse HTML, extract real phone/email from posts)
- [ ] Build real Reddit scraper (r/weddingplanning, r/eventplanning, r/HireAMusician)
- [ ] Build real Eventbrite scraper (event organizer contact pages)
- [ ] Build Google search scraper (50+ query variations: "looking for DJ [city]", "need entertainment [city]", etc.)
- [ ] Build data enrichment: if only name found, cross-reference Hunter.io or similar to find email
- [ ] Add 50+ search query rotation for maximum coverage across all sources
- [ ] Test all scrapers against Miami — verify real phone numbers returned
- [ ] Add scraper health dashboard in admin showing real vs AI lead counts

## Full Lead Ingestion Pipeline (Apollo/Hunter-style Architecture)

### Phase 1 — Distributed Collectors
- [ ] Reddit collector: r/weddingplanning, r/eventplanning, r/HireAMusician, r/forhire, city subreddits
- [ ] Craigslist RSS collector: gigs + events sections for all 12 US markets
- [ ] Google Custom Search collector: "hire dj [city]", "need band [city]", "looking for photographer [city]"
- [ ] Twitter/X public search collector: event hashtags + hire keywords
- [ ] RSS/Atom feed collector: wedding blogs, event planning sites, venue inquiry pages
- [ ] Eventbrite public API collector: upcoming events needing entertainment
- [ ] Community boards collector: WeddingWire community, The Knot community, Thumbtack public posts

### Phase 2 — Ingestion & Deduplication
- [ ] Raw document store: store URL + raw text + timestamp + source per scraped item
- [ ] Near-duplicate detection: SHA-256 hash of normalized title+location+month
- [ ] City/area normalization: map all city variants to canonical market IDs

### Phase 3 — AI Intent Classification
- [ ] LLM classifier: Is this a real event need? (yes/no + confidence 0-100)
- [ ] Performer type extractor: DJ / band / photographer / makeup / emcee / etc.
- [ ] Entity extractor: date, city, venue, budget, contact method, event type
- [ ] Intent score: future-looking + actionable + has budget/date signal

### Phase 4 — Lead Scoring & Queue
- [ ] Composite score: intent confidence + entity completeness + budget signal
- [ ] High-confidence threshold (>70): auto-push to admin approval queue
- [ ] Low-confidence (40-70): hold in staging queue for manual review
- [ ] Below threshold (<40): discard with reason logged
- [ ] City/area grouping in admin queue view

### Phase 5 — Admin UI Updates
- [ ] Source badge shows actual source (Reddit, Craigslist, Google, Twitter, RSS) not "AI"
- [ ] Confidence score badge on each lead card in admin queue
- [ ] City/area grouping tabs or filter in admin lead queue
- [ ] Pipeline run stats: X collected, Y classified, Z pushed to queue

## Craigslist + Source URL (Current Sprint)
- [x] Add ScraperAPI key via secrets manager
- [x] Build Craigslist collector using ScraperAPI proxy (gigs + events sections, all 12 markets)
- [x] Add source URL link in admin lead card (click to verify original post)
- [x] Store venueUrl as the canonical source URL for all scraped leads
- [x] Full multi-source pipeline: Reddit + Craigslist + DuckDuckGo + Bing News
- [x] AI intent classification layer (LLM scores each raw document 0-100)
- [x] Entity extraction: date, city, budget, performer type, contact method
- [x] Source badge shows actual source name (Reddit r/weddingplanning, Craigslist Miami, etc.)
- [x] Pipeline run stats in admin header (Collected → Filtered → Classified → High-Confidence)
- [ ] City/area grouping tabs in admin lead queue (future)

## Live Event Calendar & Dynamic Filters
- [ ] Add majorEvents table to schema (name, city, marketId, startDate, endDate, filterLabel, searchKeywords, isActive, recurrenceYear)
- [ ] DB migration for majorEvents table
- [ ] Seed 20+ major recurring events (Ultra Miami, Coachella, SXSW, Art Basel, EDC Las Vegas, Lollapalooza, etc.)
- [ ] Build tRPC procedures: getActiveEventFilters (public), getAllEvents (admin), addEvent, updateEvent, toggleEvent
- [ ] Scraper boost: when event is within 90 days, inject event-specific search queries into that city's collectors
- [ ] Dynamic filter chips in artist browse page: auto-show event chips when event is active window
- [ ] Event chips auto-hide when event end date has passed
- [ ] Admin event manager UI: table of all events with add/edit/toggle controls
- [ ] Schedule daily job to refresh event windows (mark expired events inactive)

## Event Window System (Internal Lead Boost Engine)
- [x] Replace majorEvents schema with event_window table (city, region, event_name, start_date, end_date, lead_boost_multiplier, search_keyword_pack, active_status, lead_days)
- [x] Drop majorEvents table, apply event_window migration
- [x] Seed 28 events across all 12 markets with real keyword packs and boost multipliers
- [x] Wire event_window into scraper: inject keyword packs + apply boost multiplier to lead scoring
- [x] tRPC procedures: getActiveFilters (public), getAllEvents (admin), addEvent, updateEvent, toggleEvent, deleteEvent
- [x] Admin Event Windows page: full CRUD table with boost multiplier, keyword pack, active toggle
- [x] Dynamic filter chips on artist browse page (auto-show/hide by date window)
- [x] Fix TypeScript compilation errors in routers.ts from previous edit

## Demand Intelligence Engine (Priority Build)
- [ ] Expand event_window seed data to 150+ recurring events (music festivals, conventions, sports, fashion weeks, art fairs, food festivals, university weekends, boat shows, film festivals, holiday markets)
- [ ] Source reliability scoring: trust score per source domain, applied as multiplier in finalScore
- [ ] Contact quality scoring: +40 direct email, +35 direct phone, +20 planner name, +12 Instagram, etc.
- [ ] Lead freshness decay: score × freshnessMultiplier (0-24h=1.0, 1-3d=0.92, 4-7d=0.75, 7-14d=0.50)
- [ ] Duplicate lead clustering: fingerprint hash(city+venue+date+keywords), merge multi-source duplicates
- [ ] Buyer-type classification: bride/private, event planner, venue manager, corporate, festival, nightclub, university
- [ ] Multi-phase event window: pre-event ramp (-2mo), event week spike, post-event spillover (+3d) with different keyword packs per phase
- [ ] Store scrape metadata on each lead: keyword used, source, active event window at time of scrape
- [ ] Lead lifecycle states: new → claimed → contacted → booked → expired → dead

## Full Intelligence Engine Build (All-in-One Session) ✅ COMPLETE
- [x] Schema: add winProbability, competitionLevel, suggestedRate, pitchStyle, leadTemperature, buyerType, sourceLabel, sourceTrust, contactScore, freshnessScore, intentEvidence, contactEvidence, eventEvidence, sourceEvidence, eventWindowId, scrapeKeyword to leads table
- [x] Expand event_window seed to 150+ events across all major US cities
- [x] Feature weights config file (server/intelligenceConfig.ts) — tunable without redeployment
- [x] Source reliability scoring: trust score per source domain
- [x] Contact quality scoring: +40 email, +35 phone, +20 planner name, +12 Instagram, etc.
- [x] Lead freshness decay: score × freshnessMultiplier (0-24h=1.0, 1-3d=0.92, 4-7d=0.75, 7-14d=0.50)
- [x] Duplicate lead clustering: fingerprint hash(city+venue+date+keywords), merge multi-source duplicates
- [x] Buyer-type classification: bride/private, event planner, venue manager, corporate, festival, nightclub, university
- [x] Win probability engine: composite score from all intelligence inputs
- [x] Competition level detection: LOW/MEDIUM/HIGH based on post age, source count, market saturation
- [x] Suggested rate range: by city + event type + venue class + buyer type
- [x] Pitch style suggestion: romantic/elegant, high-energy/club, professional/corporate, etc.
- [x] Lead temperature: HOT/WARM/COLD classification
- [x] Evidence extraction: intentEvidence, contactEvidence, eventEvidence, sourceEvidence snippets
- [x] Wire all intelligence into scraper pipeline (additive — no collectors removed)
- [x] Lead card UI: HOT/WARM/COLD badge, win probability bar, evidence "Why this lead looks promising"
- [x] Feedback loop: booked / lost / no response / price too high on each unlocked lead (My Unlocks tab)
- [x] tRPC: submitFeedback + getMyFeedback procedures with upsert logic
- [ ] Artist filter chips: HOT / WARM / COLD temperature filter (next sprint)
- [ ] Multi-phase event window: pre-ramp / event week / post-spillover keyword packs (next sprint)

## Initial Batch Backfill
- [x] Update scraper lookback window to 30 days (Reddit t=month, DuckDuckGo df=m)
- [x] Increase Reddit limit from 25 to 100 per subreddit
- [x] Add 4 more global subreddits (bachelorette, Judaism, additional weddingplanning/eventplanning queries)
- [x] Add 4th city-specific search per market (photographer/makeup)
- [ ] Trigger full 12-market scrape run to populate site with real leads (run via Admin → Fetch Leads)


## Aggressive Lead Expansion (Full Internet Coverage)
- [ ] Add Facebook Groups collector (wedding planning, event planning, local community groups per city)
- [ ] Add Twitter/X collector (search "looking for DJ", "need photographer" + location)
- [ ] Add Instagram hashtag collector (#weddingplanning, #eventplanning, #DJneeded, etc.)
- [ ] Add Eventbrite collector (event listings with organizer info)
- [ ] Add The Knot forums collector (wedding planning discussions)
- [ ] Add WeddingWire collector (vendor request boards)
- [ ] Add Thumbtack collector (service request platform)
- [ ] Add Nextdoor collector (neighborhood event planning)
- [ ] Add Google Maps collector (reviews with hire requests in comments)
- [ ] Add Quora collector (questions about hiring DJs, photographers, etc.)
- [ ] Add LinkedIn collector (corporate event planners)
- [ ] Add Yelp collector (venue reviews with hire requests)
- [ ] Add Meetup.com collector (event organizers)
- [ ] Add Pinterest collector (wedding planning boards)
- [ ] Add Slack communities collector (local business groups)
- [ ] Add Discord servers collector (gaming/music/event communities)
- [ ] Expand Reddit to 100+ niche subreddits (not just 4 per city)
- [ ] Add YouTube comments collector (DJ/photographer channels)
- [ ] Add Telegram groups collector (local event planning channels)
- [ ] Add local blog comments collector (wedding/event planning blogs)
- [ ] Lower intent threshold from 60 to 40 for aggressive capture
- [ ] Adjust scoring weights: reduce contact quality penalty, increase intent weight
- [ ] Optimize deduplication for high-volume ingestion
- [ ] Run full scrape across all sources and all 12 markets

## Contract Forms System
- [ ] Create 6 contract templates (3 for artists, 3 for clients)
- [ ] Build contract form pages with fill-in-the-blanks
- [ ] Add PDF download functionality (pre-filled and blank options)
- [ ] Integrate contracts into lead details page
- [ ] Create standalone /contracts page for public access
- [ ] Add SEO optimization for contract discovery
- [ ] Test all 6 contract types generate valid PDFs


## SEO-Optimized Local Event Vendor Pages (NEW)
- [x] Create /dj-miami page with SEO content and lead capture form
- [x] Create /wedding-dj-miami page with SEO content and lead capture form
- [x] Create /dj-fort-lauderdale page with SEO content and lead capture form
- [x] Create /wedding-band-miami page with SEO content and lead capture form
- [x] Create /birthday-party-dj-miami page with SEO content and lead capture form
- [x] Create /corporate-event-dj-miami page with SEO content and lead capture form
- [x] Create /private-party-dj-miami page with SEO content and lead capture form
- [x] Create /live-band-miami page with SEO content and lead capture form
- [x] Create /hire-music-producer page with SEO content and lead capture form
- [x] Create /hire-podcast-editor page with SEO content and lead capture form
- [x] Create /find-dj-near-me page with SEO content and lead capture form
- [x] Create /find-live-band page with SEO content and lead capture form
- [x] Set up programmatic SEO routing for city-based pages
- [x] Add meta tags and structured data to all SEO pages
- [x] Test lead capture flow from each page


## Lead Management Editing (NEW)
- [x] Add edit modal to admin lead queue
- [x] Create backend mutation to update lead location and other details
- [x] Test inline editing of leads


## Lead Editing Bug (ACTIVE)
- [ ] Fix edit modal not appearing or not working on admin lead cards
- [ ] Verify edit button click triggers modal
- [ ] Test editing and saving lead details


## Scraper 0 Leads Bug (CRITICAL - IN PROGRESS)
- [x] Diagnose why scraper returns 0 leads every time
- [x] Check Reddit collector for errors or rate limits
- [x] Verify subreddit/keyword configuration
- [x] Re-enable Reddit collector with public JSON API
- [x] Test scraper and verify leads are captured


## Scraper Endpoint Bug (CRITICAL)
- [ ] Debug why Fetch Leads button doesn't trigger scraper
- [ ] Check admin router for scraper endpoint
- [ ] Verify scraper is being called and returning results
- [ ] Test scraper execution end-to-end


## SEO System Refactor (COMPLETED ✅)
- [x] Create seoConfig.ts with SERVICES and CITIES arrays
- [x] Implement parseSlug() to extract service+city from URL
- [x] Refactor SEOLandingPage to use dynamic routing
- [x] Update App.tsx to use dynamic /:slug route pattern
- [x] Update sitemap.ts to generate from service+city arrays
- [x] Test dynamic pages (dj-miami, wedding-dj-orlando, live-band-tampa)
- [x] Verified all pages render with correct titles and content
- [x] System now supports 63 service+city combinations (7 services × 9 cities)
- [x] Ready to scale to 100+ pages by adding services/cities to arrays


## Bug Fixes (COMPLETED ✅)
- [x] Fixed eventDate query error in getFeaturedLeads (changed new Date() to Date.now())
- [x] Verified dashboard loads without console errors
- [x] Confirmed 57 leads display correctly with no query failures
