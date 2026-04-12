/**
 * SEO Landing Page Configuration Generator
 * Generates dynamic page configs from services and cities arrays
 * Supports manual overrides for custom pages
 */
import { AV_WORK_MANUAL_OVERRIDES } from "./avWorkManualOverrides";

export interface FAQ {
  question: string;
  answer: string;
}

export interface ServiceConfig {
  id: string;
  name: string;
  plural: string;
  description: string;
  eventTypes: string[];
  keywords: string[];
}

export interface CityConfig {
  id: string;
  name: string;
  state: string;
  region: string;
}

export interface PageConfig {
  title: string;
  seoTitle: string;
  seoDescription: string;
  /** Single H1 for the page (keyword-focused). Defaults to "{service} Services in {city}". */
  seoH1: string;
  heading: string;
  subheading: string;
  defaultEventType: string;
  defaultCity: string;
  content: string;
  /**
   * Optional page type, used to switch between calculator-style
   * SEO pages, "hire performers" pages, and marina/venue pages.
   */
  pageType?: "calculator" | "hire" | "venue";
  /**
   * Optional calculator/landing variant identifier.
   * Used by SEOLandingPage to render specialized yacht/boat calculators.
   */
  calculatorVariant?: "yachtCost" | "boatEntertainment";
  /**
   * Optional FAQ entries for this page.
   */
  faq?: FAQ[];
  /** Optional primary CTA label for the quote form (e.g. pricing pages). */
  leadCTA?: string;
  /** Optional Open Graph / Twitter preview image URL (falls back to /og-default.png in meta-tags). */
  ogImage?: string;
  priority?: number;
  changefreq?: string;
}

// Master services list
export const SERVICES: ServiceConfig[] = [
  {
    id: "dj",
    name: "DJ",
    plural: "DJs",
    description: "Professional DJs, bands, and live performers for weddings, parties, and events",
    eventTypes: ["wedding", "party", "corporate", "private"],
    keywords: ["DJ", "disc jockey", "music", "entertainment"],
  },
  {
    id: "wedding-dj",
    name: "Wedding DJ",
    plural: "Wedding DJs",
    description: "Specialized DJs for wedding receptions",
    eventTypes: ["wedding"],
    keywords: ["wedding DJ", "reception DJ", "ceremony music"],
  },
  {
    id: "live-band",
    name: "Live Band",
    plural: "Live Bands",
    description: "Professional live bands and musicians",
    eventTypes: ["wedding", "corporate", "party"],
    keywords: ["live band", "live music", "musicians", "band"],
  },
  {
    id: "music-producer",
    name: "Music Producer",
    plural: "Music Producers",
    description: "Professional music production services",
    eventTypes: ["studio"],
    keywords: ["producer", "music production", "recording"],
  },
  {
    id: "podcast-editor",
    name: "Podcast Editor",
    plural: "Podcast Editors",
    description: "Professional podcast editing and production",
    eventTypes: ["podcast"],
    keywords: ["podcast", "audio editing", "production"],
  },
  {
    id: "photographer",
    name: "Photographer",
    plural: "Photographers",
    description: "Professional photographers for events",
    eventTypes: ["wedding", "corporate", "party"],
    keywords: ["photographer", "photography", "photos"],
  },
  {
    id: "videographer",
    name: "Videographer",
    plural: "Videographers",
    description: "Professional videography services",
    eventTypes: ["wedding", "corporate", "event"],
    keywords: ["videographer", "video", "filming"],
  },
  {
    id: "yacht-dj",
    name: "Yacht DJ",
    plural: "Yacht DJs",
    description: "DJs specialized in yacht and boat parties",
    eventTypes: ["party", "corporate"],
    keywords: ["yacht dj", "boat dj", "yacht party", "boat party"],
  },
  {
    id: "yacht-dj-cost",
    name: "Yacht Party DJ",
    plural: "Yacht Party DJs",
    description: "DJs specialized in yacht and boat parties",
    eventTypes: ["party", "corporate"],
    keywords: ["yacht DJ", "boat party DJ", "yacht entertainment", "miami yacht dj"],
  },
  {
    id: "boat-entertainment-package",
    name: "Boat Entertainment Package",
    plural: "Boat Entertainment Packages",
    description: "Curated DJ + musician entertainment packages for boats and yachts",
    eventTypes: ["party", "corporate"],
    keywords: ["boat entertainment", "yacht entertainment package", "dj + sax", "dj + percussion"],
  },
  { id: "band", name: "Band", plural: "Bands", description: "Live bands and musicians for events", eventTypes: ["wedding", "corporate", "party"], keywords: ["band", "live band", "musicians"] },
  {
    id: "dj-gigs",
    name: "DJ & Live Music Gig",
    plural: "DJ & Live Music Gigs",
    description: "Gig opportunities and bookings for DJs, bands, and live performers",
    eventTypes: ["wedding", "party", "corporate"],
    keywords: ["dj gigs", "dj jobs", "gig opportunities", "live music gigs", "band gigs"],
  },
  {
    id: "venues-hiring-djs",
    name: "Venues Hiring DJs",
    plural: "Venues Hiring DJs",
    description: "Venues and events looking for DJs, bands, and live performers",
    eventTypes: ["wedding", "party", "corporate", "club"],
    keywords: ["venues hiring djs", "dj bookings", "event entertainment", "live music booking"],
  },
  { id: "av-work", name: "AV Work", plural: "AV Work", description: "Audio visual crew jobs and AV staffing opportunities", eventTypes: ["corporate", "event"], keywords: ["av work", "av jobs", "audio visual crew"] },
  /** Pricing / calculator-style slugs (only whitelisted city combos in generateAllPageConfigs) */
  { id: "dj-cost", name: "DJ cost", plural: "DJ costs", description: "DJ pricing and cost guides by city", eventTypes: ["party", "wedding", "corporate"], keywords: ["dj cost", "dj prices", "how much is a dj"] },
  { id: "wedding-dj-cost", name: "Wedding DJ cost", plural: "Wedding DJ costs", description: "Wedding DJ pricing guides", eventTypes: ["wedding"], keywords: ["wedding dj cost", "wedding dj prices"] },
];

// FAQ template constants (auto-assigned by serviceId in generatePageConfig)
const DJ_FAQ: FAQ[] = [
  {
    question: "How much does a DJ cost in Miami?",
    answer:
      "DJ prices in Miami typically range from $400 to $2,500 depending on the event type, duration, and experience level. Wedding DJs average $800-$1,500, while club and corporate DJs can range higher. On Gigxo, you can browse verified DJs, bands, and live performers and unlock direct contact info starting from $7 — no commission, no middleman.",
  },
  { question: "How far in advance should I book a DJ in Miami?", answer: "For weddings and large events, book 3-6 months in advance. For corporate events and parties, 4-8 weeks is usually sufficient. Miami's peak season runs October through April, so demand is higher during those months. Use Gigxo to find available DJs quickly and contact them directly." },
  { question: "What's included in a typical DJ booking in Miami?", answer: "Most Miami DJ bookings include setup and breakdown time, sound system, lighting, MC services, and a music playlist consultation. Some DJs offer additional services like photo booths, LED uplighting, and custom monograms. Always confirm what's included when you contact a DJ directly through Gigxo." },
  { question: "How do I know if a DJ is right for my event?", answer: "Review their profile for past event types, music genres, and client reviews. Ask about their experience with similar events, their backup equipment policy, and whether they carry liability insurance. Gigxo lets you unlock direct contact info so you can interview DJs before committing." },
  { question: "Do Miami DJs travel to Fort Lauderdale and Boca Raton?", answer: "Yes, most South Florida DJs cover the entire tri-county area including Miami-Dade, Broward, and Palm Beach counties. Travel fees may apply for events outside their primary service area. Filter by location on Gigxo to find DJs closest to your venue." },
  { question: "What's the difference between a club DJ and a wedding DJ?", answer: "Club DJs specialize in high-energy mixing, beat matching, and reading a crowd for peak hours. Wedding DJs focus on timeline coordination, MC duties, ceremony music, and mixing across multiple genres for diverse guest ages. Many South Florida DJs are experienced in both formats." },
];

const WEDDING_DJ_FAQ: FAQ[] = [
  { question: "How much does a wedding DJ cost in Miami?", answer: "Wedding DJ prices in Miami range from $800 to $2,500 for a full reception. Ceremony-only packages start around $400. Factors affecting price include hours of coverage, equipment needs, travel distance, and peak season dates (December-April). Get direct quotes from verified wedding DJs on Gigxo starting from $7 per lead." },
  { question: "When should I book a wedding DJ in South Florida?", answer: "Book your wedding DJ 6-12 months in advance, especially for peak season (October-April) and popular Saturday dates. South Florida's busy wedding calendar means top DJs get booked quickly. Use Gigxo to find available DJs and contact them directly without paying platform commissions." },
  { question: "Do wedding DJs provide MC services?", answer: "Most professional wedding DJs in Miami offer MC services including introductions, timeline announcements, and crowd engagement. Confirm this when booking. A good DJ-MC combination eliminates the need to hire a separate emcee and keeps your reception flowing smoothly." },
  { question: "What music genres can Miami wedding DJs cover?", answer: "South Florida wedding DJs typically cover Top 40, Hip Hop, R&B, Latin (Salsa, Bachata, Reggaeton), EDM, and classic hits. Miami's diverse culture means DJs are experienced mixing across genres to satisfy multicultural guest lists. Request a sample playlist during your consultation." },
  { question: "Should I hire a DJ or a live band for my Miami wedding?", answer: "DJs offer more song variety, consistent sound quality, and lower cost ($800-2,500 vs $3,000-8,000 for bands). Live bands offer unique atmosphere and visual entertainment. Many couples choose a DJ for the reception and a live acoustic act for the ceremony. Both are available on Gigxo." },
  { question: "What questions should I ask a wedding DJ before booking?", answer: "Ask about: their wedding experience and references, backup equipment policy, music request process, MC experience, what happens if they're sick, contract terms, and exactly what equipment they'll bring. Gigxo lets you contact DJs directly so you can ask these questions before committing." },
  { question: "Do Miami wedding DJs require a deposit?", answer: "Yes, most professional wedding DJs require a 25-50% deposit to hold your date, with the balance due 1-2 weeks before the event. Always get a written contract. When you unlock a DJ's contact info on Gigxo, you negotiate directly — no platform fees on the actual booking." },
];

const LIVE_BAND_FAQ: FAQ[] = [
  { question: "How much does a live band cost in Miami?", answer: "Live band prices in Miami range from $1,500 for a small trio to $8,000+ for a full 8-piece band for weddings and corporate events. Factors include number of musicians, event duration, travel, and equipment requirements. Find and contact verified live bands directly on Gigxo." },
  { question: "What types of live bands are available in Miami?", answer: "Miami has a rich live music scene with bands covering Latin (Salsa, Merengue, Cumbia), Jazz, R&B, Top 40 cover bands, reggae, and classical ensembles. South Florida's multicultural market means you can find specialists for almost any musical genre or event type." },
  { question: "How far in advance should I book a live band in Miami?", answer: "Book 3-6 months ahead for weddings and large corporate events. Popular bands book quickly during peak season (November-April). For smaller events and parties, 4-6 weeks notice is usually sufficient. Contact bands directly through Gigxo to check availability." },
  { question: "Can live bands perform outdoors in Miami?", answer: "Yes, but outdoor performances require weatherproofing for equipment, appropriate power supply, and sometimes permits depending on the venue. Miami's climate is generally band-friendly, but summer rain and heat are factors. Always confirm outdoor capability when booking." },
  { question: "Do live bands in Miami also provide DJ services between sets?", answer: "Many Miami bands offer DJ services during breaks to keep the energy going. This combo package — live band plus DJ — is popular for weddings and corporate events. Ask about this option when you contact bands through Gigxo." },
  { question: "What's the difference between a cover band and a wedding band?", answer: "Cover bands perform popular songs across genres and are great for parties and corporate events. Wedding bands specialize in ceremony and reception flow, MC duties, and reading diverse crowds. Many South Florida bands do both. Review their event experience on their Gigxo profile." },
];

const PHOTOGRAPHER_FAQ: FAQ[] = [
  { question: "How much does an event photographer cost in Miami?", answer: "Event photographer rates in Miami range from $150-300/hour for parties to $2,000-5,000 for full wedding day coverage. Corporate event photography typically runs $800-2,000 for a half or full day. Find verified photographers and unlock their contact info directly on Gigxo." },
  { question: "How many photos will I receive from my Miami event?", answer: "Most event photographers deliver 50-100 edited photos per hour of coverage. A 4-hour event typically yields 200-400 final edited images. Raw photo counts are much higher but only the best edited shots are delivered. Confirm deliverables in your contract." },
  { question: "How long does it take to receive photos after an event in Miami?", answer: "Standard turnaround is 2-4 weeks for edited photos delivered via online gallery. Rush delivery (within 48-72 hours) is available from some photographers for an additional fee. Corporate clients often need faster turnaround — confirm timeline when booking." },
  { question: "Do Miami event photographers provide videography too?", answer: "Some Miami photographers offer photo and video packages, which can save money and simplify coordination. Dedicated videographers usually produce higher quality video than photographer-videographer combos. Browse both photographers and videographers on Gigxo to compare options." },
  { question: "What should I look for when hiring a Miami event photographer?", answer: "Review their portfolio for events similar to yours, check their equipment (full-frame camera, multiple lenses, flash), confirm backup equipment policy, and verify they carry liability insurance. Reading reviews and contacting them directly through Gigxo helps you vet them before committing." },
];

const VIDEOGRAPHER_FAQ: FAQ[] = [
  { question: "How much does a videographer cost in Miami?", answer: "Miami videographer rates range from $500-1,500 for event highlight videos to $2,500-6,000 for full wedding cinematography. Corporate video production runs $1,500-5,000 depending on scope. Find verified videographers on Gigxo and contact them directly for custom quotes." },
  { question: "What types of videos do Miami videographers produce?", answer: "Miami videographers produce wedding films, corporate event recaps, social media highlight reels, promotional videos, and live event streams. South Florida's locations — beaches, yachts, luxury venues — make for stunning visual content that videographers here are experienced capturing." },
  { question: "How long does video editing take after a Miami event?", answer: "Highlight reels (2-5 minutes) typically take 2-4 weeks. Full wedding films (30-90 minutes) can take 6-12 weeks. Corporate videos with client review rounds can take 4-8 weeks. Confirm turnaround time and revision rounds before booking." },
  { question: "Do I need both a photographer and videographer for my Miami event?", answer: "For weddings and major corporate events, having both is highly recommended since they capture different moments in different ways. For smaller events and parties, a good photographer may be sufficient. Some Miami videographers offer photo and video bundle packages." },
  { question: "What equipment should a professional Miami videographer use?", answer: "Look for 4K capable cameras, stabilization equipment (gimbal or steadicam), external microphones for audio quality, and drone capability for aerial shots if your venue permits. Miami's outdoor and waterfront venues make drone footage particularly stunning." },
];

// Master cities list
export const CITIES: CityConfig[] = [
  { id: "miami", name: "Miami", state: "FL", region: "South Florida" },
  { id: "fort-lauderdale", name: "Fort Lauderdale", state: "FL", region: "South Florida" },
  { id: "orlando", name: "Orlando", state: "FL", region: "Central Florida" },
  { id: "tampa", name: "Tampa", state: "FL", region: "Tampa Bay" },
  { id: "jacksonville", name: "Jacksonville", state: "FL", region: "North Florida" },
  { id: "boca-raton", name: "Boca Raton", state: "FL", region: "South Florida" },
  { id: "west-palm-beach", name: "West Palm Beach", state: "FL", region: "South Florida" },
  { id: "naples", name: "Naples", state: "FL", region: "Southwest Florida" },
  { id: "sarasota", name: "Sarasota", state: "FL", region: "Southwest Florida" },
  { id: "gainesville", name: "Gainesville", state: "FL", region: "North Florida" },
  { id: "tallahassee", name: "Tallahassee", state: "FL", region: "North Florida" },
  { id: "pensacola", name: "Pensacola", state: "FL", region: "Northwest Florida" },
  { id: "daytona-beach", name: "Daytona Beach", state: "FL", region: "Central Florida" },
  { id: "melbourne", name: "Melbourne", state: "FL", region: "Space Coast" },
  { id: "fort-myers", name: "Fort Myers", state: "FL", region: "Southwest Florida" },
  { id: "key-west", name: "Key West", state: "FL", region: "Florida Keys" },
  { id: "clearwater", name: "Clearwater", state: "FL", region: "Tampa Bay" },
  { id: "st-petersburg", name: "St Petersburg", state: "FL", region: "Tampa Bay" },
  { id: "ocala", name: "Ocala", state: "FL", region: "Central Florida" },
  { id: "palm-beach", name: "Palm Beach", state: "FL", region: "South Florida" },
];

/** Only these URLs are generated for dj-cost / wedding-dj-cost (avoid thin city×service spam). */
const PRICING_PAGE_SLUGS = new Set([
  "dj-cost-miami",
  "wedding-dj-cost-miami",
  "dj-cost-fort-lauderdale",
  "dj-cost-boca-raton",
]);

// Manual overrides for specific pages (custom titles, descriptions, etc.)
const MANUAL_OVERRIDES: Record<string, Partial<PageConfig>> = {
  "dj-miami": {
    seoTitle: "Miami DJs, Bands & Live Music for Hire — Weddings, Clubs & Yacht Parties | Gigxo",
    seoDescription:
      "Find verified Miami DJs, bands, and live performers for weddings, yacht charters, clubs and private events. Compare real profiles, see availability, and get direct contact — no commission, ever. Leads from $7.",
    heading: "Hire DJs, Bands & Live Acts in Miami",
    subheading: "Club, wedding and event-ready DJs, bands, and live acts across Miami & South Florida",
    content:
      "Miami has one of the strongest DJ and live music scenes in the world. Use this page to discover working DJs, bands, and live acts who play clubs, weddings, private villas and yacht parties across Miami and nearby neighborhoods. Filter by genre, experience and location, then send a quick request so we can match you with the right talent and pricing for your date.",
    pageType: "hire",
  },
  "dj-cost-miami": {
    seoTitle: "DJ Cost in Miami: Real Price Ranges for 2026 | Gigxo",
    seoDescription:
      "Miami DJ prices run $500–$2,500+ depending on event type, hours, and gear. Weddings typically land $900–$2,500+; private parties from $500. See what drives pricing and get itemized quotes from verified DJs, bands, and live performers — no middleman markup.",
    heading: "How Much Does a DJ Cost in Miami?",
    subheading: "Realistic Miami DJ price ranges—then match with verified talent",
    content:
      "Miami DJ pricing depends on event length, sound and lighting needs, travel, season (peak winter/spring is pricier), and whether you need MC or ceremony support. Use the short form to share your date, neighborhood, and vibe—we’ll connect you with DJs, bands, and live performers whose rates fit your budget.",
    pageType: "calculator",
    leadCTA: "Get My Free Quote from Verified DJs & Live Acts",
    faq: [
      {
        question: "How much does a DJ cost in Miami for a wedding?",
        answer:
          "Most Miami wedding DJs quote roughly $900–$2,500+ for reception coverage (often 4–6 hours), with add-ons for ceremony audio, uplighting, or extended time. Premium weekends and holidays trend higher; always confirm hours, equipment, and MC duties in writing.",
      },
      {
        question: "What’s a typical DJ price for a house party or birthday in Miami?",
        answer:
          "Smaller private events often fall around $500–$1,200 for a standard PA, DJ, and basic lighting, assuming a 3–5 hour window. Late nights, outdoor setups, or extra subs and wireless mics can move the quote up.",
      },
      {
        question: "Do Miami DJs charge hourly or flat packages?",
        answer:
          "Most use flat packages (e.g. up to 5 hours + setup) with clear overtime rates. Hourly billing exists but is less common for private events. Ask what’s included: sound system size, backup gear, lighting, and breakdown time.",
      },
      {
        question: "What makes a Miami DJ quote go up or down?",
        answer:
          "Peak season (Oct–Apr), Saturdays, holidays, load-in difficulty (high-rises, valet, long cable runs), larger guest counts, extra speakers or subs, ceremony coverage, and early arrival or late finish all affect price. Weeknights and flexible dates usually save money.",
      },
      {
        question: "Are travel fees common for Miami-area events?",
        answer:
          "DJs often include a radius from their base; longer drives to the Keys, northern Broward, or cross-county gigs may add a travel or logistics fee. Disclose your venue early so the quote includes load-in constraints.",
      },
      {
        question: "How can I compare DJ prices without hidden fees?",
        answer:
          "Request an itemized quote: hours of performance, setup/strike, equipment list, backup plan, overtime rate, and cancellation terms. On Gigxo you unlock direct contact with verified DJs, bands, and live performers so you negotiate transparently—no platform commission on the booking.",
      },
    ],
  },
  "wedding-dj-cost-miami": {
    seoTitle: "Wedding DJ Cost in Miami: What to Expect in 2026 | Gigxo",
    seoDescription:
      "Miami wedding DJ packages typically run $900–$2,500+ for ceremony and reception coverage. See exactly what's included, what drives pricing up, and compare quotes from verified wedding DJs and live acts with no booking fees.",
    heading: "How Much Does a Wedding DJ Cost in Miami?",
    subheading: "Typical Miami wedding DJ packages and what you’re paying for",
    content:
      "Your wedding DJ quote reflects timeline coordination, sound for ceremony and reception, MC skills, dance-floor energy, and equipment quality. Share your venue, guest count, and must-have moments—we’ll help you compare vetted wedding DJs and live acts at clear price points.",
    pageType: "calculator",
    leadCTA: "Get My Free Wedding DJ Quotes",
    faq: [
      {
        question: "How much does a wedding DJ cost in Miami on average?",
        answer:
          "Plan around $900–$2,500+ for a full reception (commonly 4–6 hours), depending on experience, production level, and date. Ceremony-only or cocktail-hour coverage may start lower; ask for a package that lists each segment.",
      },
      {
        question: "What’s usually included in a Miami wedding DJ package?",
        answer:
          "Most packages include sound for the reception, wireless mics for toasts, basic dance-floor lighting, music planning, and professional MC announcements. Ceremony sound, uplighting, cold sparks, or subwoofers are often add-ons—confirm line by line.",
      },
      {
        question: "Do Miami wedding DJs charge more for peak season?",
        answer:
          "Yes—October through April and holiday weekends see higher demand. Saturday prime dates book first; Friday or Sunday events can sometimes reduce rates slightly. Book early once you love a DJ’s style and reviews.",
      },
      {
        question: "How many hours should I book a wedding DJ for?",
        answer:
          "Many Miami weddings book 5–7 hours total when ceremony, cocktail, and reception are on one property. If venues differ or you need a long after-party, ask about overtime rates and whether a meal break is required for the DJ team.",
      },
      {
        question: "Can I save money without cutting quality?",
        answer:
          "Bundle smart: choose a realistic end time, avoid redundant lighting you won’t use, and be flexible on minor details if the DJ recommends a simpler rig for your room size. The biggest savings come from comparing multiple verified pros—not skipping insurance or backup gear.",
      },
      {
        question: "How do I get accurate wedding DJ quotes fast?",
        answer:
          "Send your date, venues (with addresses), guest count, start/end times, and must-play/do-not-play notes. Gigxo connects you with verified wedding DJs so you can compare apples-to-apples quotes directly.",
      },
    ],
  },
  "dj-cost-fort-lauderdale": {
    seoTitle: "DJ Cost in Fort Lauderdale: 2026 Price Guide | Gigxo",
    seoDescription:
      "Fort Lauderdale DJ rates run $500–$2,200+ for private events. Yacht parties and waterfront weddings typically start at $900+. Compare itemized quotes from verified DJs, bands, and live performers — direct contact, zero commission.",
    heading: "How Much Does a DJ Cost in Fort Lauderdale?",
    subheading: "Fort Lauderdale DJ rates—from intracoastal parties to wedding receptions",
    content:
      "Fort Lauderdale events span beach hotels, marinas, and downtown rooftops; load-in, parking, and weather backup can affect quotes. Tell us your neighborhood and hours so we can match you with DJs, bands, and live performers who price fairly for Broward County gigs.",
    pageType: "calculator",
    leadCTA: "Get My Free Quote from Verified DJs & Live Acts",
    faq: [
      {
        question: "How much does a DJ cost in Fort Lauderdale for a wedding?",
        answer:
          "Many Fort Lauderdale wedding DJs quote approximately $900–$2,200+ for standard reception coverage, with ceremony sound and lighting as extras. Waterfront and marina venues sometimes need compact or weather-conscious setups—disclose dock or deck access up front.",
      },
      {
        question: "What’s a typical Fort Lauderdale DJ price for a corporate or yacht-adjacent event?",
        answer:
          "Corporate receptions and marina-area parties often land around $700–$1,800+ for 3–5 hours with a professional PA. Tighter decks, generator or battery needs, or extended timelines can increase the investment.",
      },
      {
        question: "Do Fort Lauderdale DJs charge travel from Miami?",
        answer:
          "Many South Florida DJs cover Miami–Fort Lauderdale–Boca as a region, but cross-county gigs during peak hours may include a modest travel or time block fee. Share your exact address and load-in path for an accurate quote.",
      },
      {
        question: "What affects DJ pricing most in Broward County?",
        answer:
          "Date (Saturday vs weekday), season, guest count and room size, lighting add-ons, ceremony coverage, overtime, and technical complexity (high-rise load-ins, long cable runs) move numbers more than small playlist tweaks.",
      },
      {
        question: "Is a DJ cheaper than a live band in Fort Lauderdale?",
        answer:
          "Usually yes—DJs typically cost less than multi-piece live bands for the same hours while offering broader song variety. If budget is tight, prioritize sound quality, reliability, and experience over the lowest bid.",
      },
      {
        question: "How do I compare Fort Lauderdale DJ quotes fairly?",
        answer:
          "Ask each DJ for the same scope: hours, equipment list, lighting, MC duties, backup gear, overtime rate, and cancellation policy. Gigxo helps you reach verified DJs, bands, and live performers directly so you can compare line items without middleman markups.",
      },
    ],
  },
  "dj-cost-boca-raton": {
    seoTitle: "DJ Cost in Boca Raton: Country Club to Private Party Pricing | Gigxo",
    seoDescription:
      "Boca Raton DJ prices range from $550–$2,300+ depending on venue and event type. Country club and upscale weddings typically run $1,000–$2,300+. Get transparent, itemized quotes from verified DJs, bands, and live performers with no booking fees.",
    heading: "How Much Does a DJ Cost in Boca Raton?",
    subheading: "Boca Raton and Palm Beach County DJ pricing—clubs, homes, and venues",
    content:
      "Boca events often mean higher-end venues, longer cocktail flows, and detailed timelines. DJs price for production expectations and guest experience, not just hours behind the decks. Share your venue and schedule to get quotes that match Palm Beach standards.",
    pageType: "calculator",
    leadCTA: "Get My Free Quote from Verified DJs & Live Acts",
    faq: [
      {
        question: "How much does a DJ cost in Boca Raton for a country club or hotel wedding?",
        answer:
          "Upscale Boca weddings commonly see DJ packages around $1,000–$2,300+ for reception coverage, depending on hours, lighting design, and ceremony support. Venues with strict vendor rules or union load-ins can add time and cost—mention those details early.",
      },
      {
        question: "What’s a typical DJ price for a private home party in Boca?",
        answer:
          "Backyard and estate parties often range roughly $550–$1,400 for a few hours with a solid PA and basic lighting, assuming standard power. Larger guest counts, pool-deck setups, or noise considerations may require upgraded sound or directional speakers.",
      },
      {
        question: "Do Boca Raton DJs include lighting in their packages?",
        answer:
          "Many offer dance-floor washes or uplighting as bundles or add-ons. For elegant receptions, ask for photos of past setups and whether lighting is LED (heat-friendly for Florida). Spell out exactly which rooms are covered.",
      },
      {
        question: "Why are Palm Beach County DJ rates sometimes higher than nearby cities?",
        answer:
          "Higher-end venues, longer events, insurance expectations, and production standards can lift averages. You’re often paying for experience with formal timelines, dress code, and seamless MC work—not just a playlist.",
      },
      {
        question: "When should I book a DJ for a Boca Raton peak-season event?",
        answer:
          "For winter and spring Saturdays, booking 6–12 months ahead is wise. Last-minute dates can work but limit your choices. Lock your DJ after venue confirmation so sound and timeline planning stay aligned.",
      },
      {
        question: "How can I get an accurate Boca Raton DJ quote?",
        answer:
          "Provide the venue name, guest count, event start/end, indoor vs outdoor areas needing sound, and any ceremony needs. Gigxo connects you with verified DJs, bands, and live performers so you receive comparable, transparent pricing.",
      },
    ],
  },
  // General DJ hire page for Fort Lauderdale
  "dj-fort-lauderdale": {
    seoTitle: "Fort Lauderdale DJs, Bands & Live Music for Hire — Yachts, Weddings & Events | Gigxo",
    seoDescription:
      "Find verified Fort Lauderdale DJs, bands, and live performers for yacht parties, waterfront weddings, and corporate events. Get direct contact with talent — no commission, no middleman. Leads from $7.",
    heading: "Hire DJs, Bands & Live Acts in Fort Lauderdale",
    subheading: "Fort Lauderdale DJs, bands, and live acts for yachts, marinas and city events",
    content:
      "Fort Lauderdale combines beach clubs, marinas and private venues—so the right entertainment needs to work on land and on the water. Use this page to find working DJs, bands, and live acts near Fort Lauderdale who play yacht parties, weddings, corporate events and nightlife. Filter by genre and experience, then send a quick request with your date and location so we can recommend the strongest fits.",
    pageType: "hire",
  },
  // Wedding DJ hire page for Miami
  "wedding-dj-miami": {
    seoTitle: "Miami Wedding DJs for Hire — Ceremony to Last Dance | Gigxo",
    seoDescription:
      "Hire Miami wedding DJs (and live acts when you want them) who handle ceremony audio, cocktail hours, and reception from start to finish. Compare verified profiles and get direct quotes — no booking commission.",
    heading: "Hire Wedding DJs in Miami",
    subheading: "Curated wedding DJs and live entertainment for ceremonies, cocktail hours and receptions",
    content:
      "A great wedding DJ keeps your entire night on track—from ceremony audio to the final dance. This page highlights wedding-focused DJs and live performers in Miami who can handle timelines, announcements and mixed-guest dance floors. Share a few details about your venue, guest count and music style and we’ll connect you with the right short list.",
    pageType: "hire",
  },
  // Live band pages — rich content to compete with GigSalad/The Bash
  "live-band-miami": {
    seoTitle: "Live Bands for Hire in Miami — Weddings, Parties & Corporate Events | Gigxo",
    seoDescription:
      "Hire verified live bands in Miami for weddings, private parties, and corporate events. Cover bands, jazz ensembles, Latin bands, and more. Get direct quotes from $1,500 — no booking fees, no middleman.",
    heading: "Live Bands for Hire in Miami",
    subheading: "Verified Miami live bands for weddings, corporate events, and private parties",
    content:
      "Miami's live music scene is one of the most diverse in the country — from high-energy cover bands and Latin ensembles to jazz quartets and acoustic duos. Whether you need a 10-piece band for a waterfront wedding at Vizcaya or a compact jazz trio for a Brickell cocktail hour, the right talent is available and bookable without a middleman.\n\nMost Miami live bands quote between $1,500 and $7,000+ depending on the number of musicians, event length, and production requirements. A standard 4–5 piece cover band for a 4-hour wedding reception typically runs $3,000–$5,000. Smaller acoustic acts and duos start around $800–$1,500. Premium 8–12 piece bands with choreography and full production can reach $10,000+.\n\nOn Gigxo, event clients submit their details and verified bands respond directly — no platform commission on the booking, no middleman markup. You get transparent pricing and direct communication with the musicians.",
    pageType: "hire",
    leadCTA: "Get My Free Quote from Verified Bands",
    faq: [
      {
        question: "How much does it cost to hire a live band in Miami?",
        answer:
          "Live band prices in Miami typically range from $1,500 for a small trio or duo to $7,000+ for a full 8-piece wedding or corporate band. The average quote on platforms like The Bash is around $1,500. Premium multi-piece bands with production run $5,000–$10,000+. Factors include number of musicians, event length, genre, and whether you need sound equipment included.",
      },
      {
        question: "What types of live bands are available for hire in Miami?",
        answer:
          "Miami has an exceptionally diverse live music market. You can find Top 40 cover bands, Latin bands (salsa, merengue, cumbia), jazz quartets and trios, R&B and soul bands, acoustic duos, string quartets, Afrobeats and reggae acts, and hybrid DJ-band combos. South Florida's multicultural scene means you can find specialists for almost any genre or cultural tradition.",
      },
      {
        question: "How far in advance should I book a live band in Miami?",
        answer:
          "For weddings and large corporate events, book 3–6 months in advance. Miami's peak season runs October through April — popular bands fill up quickly during this window. For smaller private parties and birthday events, 4–6 weeks notice is usually sufficient. Submit your request early to lock in availability.",
      },
      {
        question: "Can live bands perform outdoors in Miami?",
        answer:
          "Yes, but outdoor performances require weatherproofing for equipment, adequate power supply, and sometimes venue permits. Miami's summer heat and afternoon rain are real factors — always confirm outdoor capability and ask about backup plans. Most professional Miami bands have experience with outdoor waterfront and rooftop setups.",
      },
      {
        question: "Do Miami live bands also provide a DJ between sets?",
        answer:
          "Many Miami bands offer a DJ or curated playlist during breaks to keep energy levels up. This combo — live band plus DJ — is especially popular for weddings and corporate galas. Ask about this option when you submit your quote request.",
      },
      {
        question: "What's the difference between a cover band and a wedding band in Miami?",
        answer:
          "Cover bands perform popular songs across genres and are great for parties, corporate events, and birthdays. Wedding bands specialize in ceremony and reception flow, MC duties, first dance coordination, and reading diverse crowds. Many South Florida bands do both — review their event history before booking.",
      },
    ],
  },
  "band-for-private-party-miami": {
    seoTitle: "Bands for Private Parties in Miami — Hire Live Music for Your Event | Gigxo",
    seoDescription:
      "Find live bands for private parties in Miami. Birthday parties, house parties, villa events, and waterfront gatherings. Verified talent, direct contact, no booking fees. Quotes from $800.",
    heading: "Live Bands for Private Parties in Miami",
    subheading: "Hire live music for your Miami private party — birthdays, villa events, and more",
    content:
      "A live band transforms a private party from a gathering into an event. Miami's private event scene — from Coconut Grove villa parties to Star Island celebrations and Brickell rooftop birthdays — demands performers who can read a crowd, adapt their setlist, and deliver energy without a rigid setlist.\n\nFor private parties, most clients hire 3–5 piece cover bands or acoustic duos depending on the venue size and vibe. Smaller acoustic acts and duos start around $800–$1,500 for a 2–3 hour performance. A full 4–5 piece party band for a 4-hour birthday event typically runs $2,500–$4,500. Latin bands and specialty acts may quote differently based on instrumentation.\n\nSubmit your event details on Gigxo and get direct quotes from verified Miami bands — no platform commission on the booking.",
    pageType: "hire",
    leadCTA: "Get My Free Quote for My Party",
    faq: [
      {
        question: "How much does a band cost for a private party in Miami?",
        answer:
          "Private party band pricing in Miami varies widely. Acoustic duos and small trios start around $800–$1,500 for a 2–3 hour set. A 4–5 piece cover band for a 4-hour birthday party typically runs $2,500–$4,500. Specialty acts (Latin bands, jazz ensembles, DJ-band hybrids) may quote differently. Always get an itemized quote covering hours, setup, equipment, and overtime rates.",
      },
      {
        question: "What size band do I need for a private party in Miami?",
        answer:
          "For intimate gatherings of 20–50 guests, a duo or trio works well and fits most indoor spaces. For parties of 50–150 guests, a 4–5 piece band is the sweet spot — enough presence without overwhelming the room. Larger events of 150+ guests benefit from a 6–10 piece band with full PA. Your venue size and layout matter more than guest count alone.",
      },
      {
        question: "Can I hire a band for a house party or villa event in Miami?",
        answer:
          "Yes. Many Miami musicians specialize in residential and villa events. Key considerations are load-in access, noise ordinances (especially in residential neighborhoods), power availability, and outdoor vs. indoor setup. Mention these details when you submit your quote request so bands can advise on feasibility.",
      },
      {
        question: "How do I find a live band for a private party in Miami without a booking agency?",
        answer:
          "On Gigxo, you submit your event details and verified bands contact you directly — no agency middleman, no commission on the booking. You get transparent pricing and direct communication with the musicians. Leads start from $7 for artists, and event clients submit their request for free.",
      },
    ],
  },
  "private-event-band-miami": {
    seoTitle: "Private Event Bands for Hire in Miami — Verified Live Music | Gigxo",
    seoDescription:
      "Hire live bands for private events in Miami. Weddings, corporate galas, birthday parties, and exclusive gatherings. Verified musicians, direct contact, no booking fees. Get quotes from $1,500.",
    heading: "Private Event Bands in Miami",
    subheading: "Live music for Miami's most exclusive private events",
    content:
      "Miami's private event circuit — from Fisher Island galas to Coral Gables estate parties — demands musicians who are professional, punctual, and capable of performing across genres for diverse, high-expectation crowds. Whether you need a jazz quartet for a cocktail hour, a high-energy cover band for a birthday celebration, or a Latin ensemble for a cultural event, Gigxo connects you directly with verified talent.\n\nPrivate event bands in Miami typically quote $1,500–$8,000+ depending on the number of musicians, event length, and production requirements. Submit your event details and receive direct quotes from bands who specialize in private events — no booking agency markup.",
    pageType: "hire",
    leadCTA: "Get My Free Quote from Verified Bands",
    faq: [
      {
        question: "What's the average cost of a band for a private event in Miami?",
        answer:
          "Private event bands in Miami typically run $1,500–$5,000 for a standard 3–4 hour performance with a 4–5 piece band. High-end production bands for exclusive galas can reach $8,000–$15,000+. Acoustic duos and trios for more intimate settings start around $800–$1,500.",
      },
      {
        question: "What genres do Miami private event bands cover?",
        answer:
          "Miami's multicultural market means you can find bands covering virtually any genre: Top 40, R&B, Latin (salsa, merengue, cumbia, bachata), jazz, classic rock, Motown, Afrobeats, reggae, and classical ensembles. Many bands offer multi-genre setlists to keep diverse crowds engaged throughout the event.",
      },
      {
        question: "How do I book a band for a private event without paying agency fees?",
        answer:
          "Submit your event details on Gigxo and receive direct quotes from verified bands. There's no booking agency commission — you negotiate directly with the musicians and pay them directly. Gigxo charges a small per-lead fee to artists, not a percentage of your booking.",
      },
    ],
  },
  "yacht-dj-miami": {
    seoTitle: "Miami Yacht DJs for Hire — On-Water Setups & Charter Parties | Gigxo",
    seoDescription:
      "Hire Miami yacht DJs who know compact setups, deck logistics, and on-water performance. Verified talent for boat parties and charters — direct contact, no commission.",
    heading: "Hire Yacht DJs in Miami",
    subheading: "Miami & Fort Lauderdale yacht-ready DJs for on-water events",
    content:
      "These yacht-focused DJs understand how to perform on boats: compact setups, careful cable runs, and smooth, low-vibration stands. Tell us about your charter and we’ll match you with yacht-ready talent for Miami, Miami Beach, and Fort Lauderdale marinas.",
    pageType: "hire",
  },
  "yacht-dj-cost-miami": {
    seoTitle: "Yacht DJ Cost in Miami: What Charters Actually Pay | Gigxo",
    seoDescription:
      "Miami yacht DJ bookings typically run $800–$2,500 depending on duration, date, and production. Estimate your cost by charter length and guest count, then get direct quotes from verified on-water talent.",
    heading: "Yacht DJ Cost in Miami",
    subheading: "Plan a luxury yacht party soundtrack for Miami & Fort Lauderdale charters",
    content:
      "Yacht parties in Miami and Fort Lauderdale need a DJ who understands boats: compact setups, battery or generator power, low-vibration stands, and smooth genre transitions for mixed VIP crowds. Most yacht DJ bookings in South Florida range from 2–6 hours, with pricing influenced by date, duration, and the level of production you need on the water.",
    calculatorVariant: "yachtCost",
    faq: [
      {
        question: "How much does a yacht DJ cost in Miami?",
        answer:
          "Most private yacht DJ bookings in Miami fall between $800 and $2,500 depending on duration, date, and production needs. Smaller weekday cruises with a compact setup are on the lower end; peak weekend charters with full sound and lighting are on the higher end.",
      },
      {
        question: "Can the DJ bring a compact or battery-powered setup?",
        answer:
          "Yes. Many yacht-friendly DJs can bring compact speaker rigs, battery-powered systems, and stands designed to stay stable on the water. Tell us if shore power is limited so we can match you with the right gear profile.",
      },
      {
        question: "Do you cover Fort Lauderdale marinas as well as Miami?",
        answer:
          "Yes. We regularly serve Miami Beach, Downtown Miami, the Miami River, and Fort Lauderdale marinas. Use the form to tell us where your charter departs and we’ll match you with local yacht-ready talent.",
      },
    ],
  },
  // Yacht DJ hire page for Fort Lauderdale
  "yacht-dj-fort-lauderdale": {
    seoTitle: "Fort Lauderdale Yacht DJs — Intracoastal & Marina Parties | Gigxo",
    seoDescription:
      "Hire yacht-ready DJs in Fort Lauderdale for intracoastal cruises, marina events, and boat charters. Compact setups, verified talent, direct contact — no commission.",
    heading: "Hire Yacht DJs in Fort Lauderdale",
    subheading: "Fort Lauderdale yacht DJs for marinas, cruises and intracoastal events",
    content:
      "Fort Lauderdale’s marinas and waterways are perfect for on-water events. This page highlights yacht-focused DJs who are used to tight decks, changing weather and noise considerations along the intracoastal. Tell us about your vessel, dock and timing window and we’ll recommend DJs who can bring a compact, yacht-safe setup that fits your charter.",
    pageType: "hire",
  },
  "boat-entertainment-package-miami": {
    seoTitle: "Miami Boat Entertainment Packages — DJ, Sax & Live Music | Gigxo",
    seoDescription:
      "Build a custom Miami boat entertainment package: DJ, live sax, percussion, or full production for yacht charters. Get an instant estimate and direct quotes from verified on-water performers.",
    heading: "Boat Entertainment Packages in Miami",
    subheading: "Design a yacht-ready DJ + musician package for Miami & Fort Lauderdale waters",
    content:
      "For higher-touch yacht charters and VIP groups, a DJ-only setup isn’t always enough. Combine a DJ with live sax, percussion, or compact roaming instruments that work well in tight boat layouts. Packages are built around sound limits, boarding logistics, and how interactive you want the performance to be.",
    calculatorVariant: "boatEntertainment",
    faq: [
      {
        question: "What’s included in a boat entertainment package?",
        answer:
          "Typical packages include a DJ with a yacht-safe sound system and one or more live musicians such as saxophone or percussion. We can optionally include compact lighting, wireless microphones, and battery-powered elements depending on your vessel.",
      },
      {
        question: "Can I book DJ + sax for a small boat?",
        answer:
          "Yes. Many of our musicians specialize in compact footprints and can perform safely on smaller decks. Tell us your vessel size and layout in the quote form so we can design something that fits.",
      },
      {
        question: "Do you offer packages for Fort Lauderdale and nearby marinas?",
        answer:
          "Yes. Packages can be set up for both Miami and Fort Lauderdale departures. Share your marina and timing so we can quote travel, load-in, and on-water performance time accurately.",
      },
    ],
  },
  "dj-orlando": {
    seoTitle: "Orlando DJs, Bands & Live Music for Hire — Weddings, Events & Private Parties | Gigxo",
    seoDescription:
      "Find verified DJs, bands, and live performers in Orlando for weddings, corporate events, and private parties. Direct contact with talent, no booking commission. Get quotes from $7.",
    heading: "Hire DJs, Bands & Live Acts in Orlando",
    subheading: "Event and wedding DJs, bands, and live acts across Orlando and Central Florida",
    content:
      "Find vetted DJs, bands, and live performers in Orlando for weddings, corporate events and parties. Compare profiles and request a quote.",
    pageType: "hire",
  },
  "band-miami": {
    seoTitle: "Miami Bands for Hire — Live Music for Weddings, Parties & Corporate Events | Gigxo",
    seoDescription:
      "Book verified live bands in Miami for weddings, corporate events, and private parties. Cover bands, Latin ensembles, jazz trios, and more. Direct contact, no booking fees. Quotes from $1,500.",
    heading: "Hire a Band in Miami",
    subheading: "Verified live bands for every Miami event — weddings, parties, and corporate",
    content:
      "Miami is home to one of the most vibrant live music markets in the US. From high-energy Top 40 cover bands and Latin ensembles to jazz quartets and acoustic duos, there's a band for every event type and budget.\n\nMost Miami bands quote between $1,500 and $7,000+ depending on the size of the group, event length, and whether sound equipment is included. A 4–5 piece cover band for a 4-hour event typically runs $3,000–$5,000. Smaller acts start around $800.\n\nGigxo connects event clients directly with verified Miami bands — no booking agency, no commission on the booking. Submit your event details and receive direct quotes from musicians who specialize in your event type.",
    pageType: "hire",
    leadCTA: "Get My Free Quote from Verified Bands",
    faq: [
      {
        question: "How much does it cost to hire a band in Miami?",
        answer:
          "Band hire in Miami ranges from $800 for a small acoustic duo to $7,000+ for a full 8-piece band. The average quote for a live band in Miami is around $1,500 (The Bash, 2026 data). Wedding bands and corporate event bands typically run $3,000–$6,000 for a 4-hour performance with a 4–5 piece group.",
      },
      {
        question: "What types of bands can I hire in Miami?",
        answer:
          "Miami offers an exceptionally diverse range: Top 40 cover bands, Latin bands (salsa, merengue, cumbia), jazz ensembles, R&B and soul bands, acoustic duos, string quartets, Afrobeats acts, reggae bands, and hybrid DJ-band combos. The multicultural South Florida market means you can find specialists for almost any genre.",
      },
      {
        question: "How far in advance should I book a band in Miami?",
        answer:
          "Book 3–6 months ahead for weddings and large corporate events, especially during peak season (October–April). For smaller parties and birthdays, 4–6 weeks notice is usually enough. Popular bands fill up fast during the winter season.",
      },
      {
        question: "Do Miami bands provide their own sound equipment?",
        answer:
          "Most professional Miami bands include a PA system in their quote. Confirm what's included: speakers, monitors, microphones, and mixing. For larger venues (200+ guests), you may need a venue-grade PA that the band can plug into. Always clarify equipment details before signing a contract.",
      },
      {
        question: "Can I hire a band and a DJ for the same event in Miami?",
        answer:
          "Yes — the DJ-band hybrid is very popular in Miami for weddings and corporate events. The band performs live sets while the DJ handles transitions, cocktail hour, and after-party. Many Miami acts offer this as a combined package. Ask about it when you submit your quote request.",
      },
    ],
  },
  "corporate-event-band-miami": {
    seoTitle: "Corporate Event Bands for Hire in Miami — Live Music for Business Events | Gigxo",
    seoDescription:
      "Hire professional live bands for corporate events in Miami. Galas, product launches, conferences, and holiday parties. Verified talent, direct contact, no booking fees. Quotes from $2,000.",
    heading: "Corporate Event Bands in Miami",
    subheading: "Professional live music for Miami corporate events, galas, and conferences",
    content:
      "Corporate events in Miami demand performers who are professional, adaptable, and capable of entertaining diverse audiences — from cocktail hour background music to high-energy post-dinner entertainment. Miami's corporate event band market spans jazz trios for networking receptions, Latin bands for multicultural galas, and full cover bands for holiday parties and product launches.\n\nCorporate event bands in Miami typically quote $2,000–$6,000+ for a standard 3–4 hour performance. Jazz trios and acoustic acts for cocktail hours start around $1,200–$2,500. Full production cover bands for large galas run $4,000–$8,000+. Most quotes include setup, performance, and basic sound equipment.\n\nGigxo connects corporate event planners directly with verified Miami bands — no agency middleman, no commission on the booking. Submit your event details and receive direct quotes from bands who specialize in corporate entertainment.",
    pageType: "hire",
    leadCTA: "Get My Free Corporate Event Quote",
    faq: [
      {
        question: "How much does a band cost for a corporate event in Miami?",
        answer:
          "Corporate event bands in Miami typically run $2,000–$6,000 for a 3–4 hour performance with a 4–5 piece band. Jazz trios and acoustic acts for cocktail hours start around $1,200–$2,500. Large production bands for galas and award ceremonies can reach $8,000–$15,000+. Bay Kings Band lists corporate event packages starting from $2,020.",
      },
      {
        question: "What type of band works best for a corporate event in Miami?",
        answer:
          "For cocktail hours and networking receptions, jazz trios, acoustic duos, or string quartets create an elegant background. For dinner entertainment, a 4–5 piece band covering jazz, R&B, and light pop works well. For post-dinner dancing and high-energy entertainment, a full cover band or Latin band keeps diverse corporate crowds engaged.",
      },
      {
        question: "Can live bands perform at hotel ballrooms and conference centers in Miami?",
        answer:
          "Yes. Most professional Miami corporate bands have experience with hotel ballrooms, convention centers, and rooftop venues. They're familiar with load-in logistics, union requirements at certain venues, and sound restrictions. Always disclose your venue when requesting quotes so bands can factor in any specific requirements.",
      },
      {
        question: "How do I book a band for a corporate event without going through an agency?",
        answer:
          "Submit your event details on Gigxo and receive direct quotes from verified corporate event bands. No agency commission — you negotiate directly with the musicians. This typically saves 15–30% compared to traditional booking agencies that charge a percentage of the talent fee.",
      },
      {
        question: "Do corporate event bands in Miami provide their own sound and lighting?",
        answer:
          "Most professional corporate bands include a PA system in their quote. For larger events (200+ guests), venue-grade sound may be required — ask whether the band can integrate with the venue's existing system. Lighting is often quoted separately; confirm what's included upfront.",
      },
    ],
  },
  "wedding-band-miami": {
    seoTitle: "Wedding Bands for Hire in Miami — Live Music for Your Reception | Gigxo",
    seoDescription:
      "Hire verified wedding bands in Miami for your ceremony and reception. Cover bands, Latin ensembles, jazz quartets, and more. Direct contact, no booking fees. Packages from $1,500.",
    heading: "Wedding Bands in Miami",
    subheading: "Live music for Miami weddings — ceremony, cocktail hour, and reception",
    content:
      "A live band at your Miami wedding creates an atmosphere that no playlist can replicate. From an acoustic duo during the ceremony at Vizcaya to a high-energy 8-piece band for the reception at the Fontainebleau, Miami's wedding band market covers every style and budget.\n\nMiami wedding band pricing typically runs $1,500–$7,000+ depending on the number of musicians, hours of performance, and whether ceremony coverage is included. A standard 4–5 piece wedding band for a 4-hour reception runs $3,000–$5,000. Premium bands with choreography and full production reach $7,000–$12,000+. Acoustic ceremony acts start around $800–$1,500.\n\nOn Gigxo, couples submit their wedding details and verified bands respond directly — no booking agency commission, no middleman markup on the talent fee.",
    pageType: "hire",
    leadCTA: "Get My Free Wedding Band Quotes",
    faq: [
      {
        question: "How much does a wedding band cost in Miami?",
        answer:
          "Miami wedding band packages typically run $1,500–$7,000+ for ceremony and reception coverage. WeddingWire data shows an average cost of $2,190 with a range of $603–$6,750. LIV Entertainment lists premium 5-piece wedding bands starting at $7,000. Budget-friendly acoustic acts and duos start around $800–$1,500 for ceremony coverage.",
      },
      {
        question: "Should I hire a DJ or a live band for my Miami wedding?",
        answer:
          "DJs offer more song variety, consistent sound quality, and lower cost ($800–$2,500 vs $3,000–$7,000+ for bands). Live bands offer a unique atmosphere, visual entertainment, and an energy that recordings can't replicate. Many Miami couples choose a live band for the reception and a DJ or acoustic act for the ceremony. Both options are available through Gigxo.",
      },
      {
        question: "What genres do Miami wedding bands cover?",
        answer:
          "Miami wedding bands cover a wide range: Top 40 hits, classic rock, Motown, R&B, Latin (salsa, merengue, cumbia), jazz standards, and contemporary pop. Many bands offer multi-genre setlists to accommodate diverse guest lists. South Florida's multicultural market means you can also find specialists in Persian, Hebrew, Russian, and other cultural music traditions.",
      },
      {
        question: "How far in advance should I book a wedding band in Miami?",
        answer:
          "Book 6–12 months in advance for peak season dates (October–April, especially Saturdays). Popular Miami wedding bands fill their calendars quickly during the winter season. For off-peak dates and weekdays, 3–4 months notice is usually sufficient.",
      },
      {
        question: "Can Miami wedding bands perform at outdoor venues?",
        answer:
          "Yes, but outdoor performances require weatherproofing for equipment, adequate power supply, and sometimes permits. Miami's summer heat and afternoon rain are real considerations. Always confirm outdoor capability and ask about backup plans when requesting quotes. Most professional Miami wedding bands have experience with outdoor waterfront venues.",
      },
    ],
  },
  "live-music-miami": {
    seoTitle: "Live Music for Hire in Miami — Bands, Musicians & Performers | Gigxo",
    seoDescription:
      "Find live music for your Miami event. Bands, soloists, jazz ensembles, Latin acts, and more. Verified performers, direct contact, no booking fees. Get quotes from $800.",
    heading: "Live Music for Hire in Miami",
    subheading: "Bands, soloists, and ensembles for every Miami event",
    content:
      "Miami's live music market is one of the most diverse in the US. Whether you're planning a waterfront wedding, a corporate gala in Brickell, a private villa party in Coconut Grove, or a birthday celebration in South Beach, there's a live music option for your event and budget.\n\nFrom solo acoustic guitarists and jazz trios to full 10-piece cover bands and Latin ensembles, Gigxo connects event clients directly with verified Miami musicians — no booking agency, no commission on the booking. Submit your event details and receive direct quotes from performers who specialize in your event type.",
    pageType: "hire",
    leadCTA: "Get My Free Live Music Quote",
    faq: [
      {
        question: "How much does live music cost for an event in Miami?",
        answer:
          "Live music pricing in Miami ranges from $500 for a solo acoustic act to $10,000+ for a full production band. Solo guitarists and acoustic duos typically run $500–$1,500. Jazz trios and quartets run $1,200–$3,000. Full cover bands and Latin ensembles run $2,500–$7,000+. The average live band quote in Miami is around $1,500 according to The Bash.",
      },
      {
        question: "What types of live music are available for events in Miami?",
        answer:
          "Miami offers an exceptionally diverse range: solo acoustic guitarists, jazz trios and quartets, Latin bands (salsa, merengue, cumbia, bachata), Top 40 cover bands, R&B and soul bands, string quartets, Afrobeats acts, reggae bands, classical ensembles, and hybrid DJ-band combos. The multicultural South Florida market means you can find specialists for almost any genre or cultural tradition.",
      },
      {
        question: "How do I find live music for my Miami event without paying agency fees?",
        answer:
          "Submit your event details on Gigxo and receive direct quotes from verified Miami musicians. No booking agency commission — you negotiate directly with the performers. Gigxo charges a small per-lead fee to artists, not a percentage of your booking.",
      },
    ],
  },
  "live-bands-corporate-event-miami": {
    seoTitle: "Live Bands for Corporate Events in Miami — Hire Entertainment | Gigxo",
    seoDescription:
      "Find live bands for corporate events in Miami. Galas, conferences, holiday parties, and product launches. Verified talent, direct contact, no booking fees. Quotes from $2,000.",
    heading: "Live Bands for Corporate Events in Miami",
    subheading: "Professional live entertainment for Miami corporate events",
    content:
      "Corporate events in Miami require performers who are polished, professional, and capable of entertaining diverse audiences. From jazz trios for networking receptions to high-energy cover bands for holiday parties, Miami's corporate entertainment market has options for every event type and budget.\n\nCorporate event bands in Miami typically quote $2,000–$6,000+ for a 3–4 hour performance. Jazz and acoustic acts for cocktail hours start around $1,200. Full production bands for large galas run $4,000–$8,000+.\n\nSubmit your event details on Gigxo and receive direct quotes from verified bands — no agency commission, no middleman markup.",
    pageType: "hire",
    leadCTA: "Get My Free Corporate Event Quote",
    faq: [
      {
        question: "What kind of band should I hire for a corporate event in Miami?",
        answer:
          "For cocktail hours: jazz trios, acoustic duos, or string quartets. For dinner entertainment: 4–5 piece bands covering jazz, R&B, and light pop. For post-dinner dancing: high-energy cover bands or Latin bands. The right choice depends on your guest demographics, venue, and event flow.",
      },
      {
        question: "How much does a band cost for a corporate event in Miami?",
        answer:
          "Corporate event bands in Miami run $2,000–$6,000 for a standard 3–4 hour performance. Jazz trios start around $1,200. Large production bands for galas can reach $8,000–$15,000+. Always get an itemized quote covering hours, equipment, setup/strike time, and overtime rates.",
      },
      {
        question: "How do I book corporate entertainment without going through an agency?",
        answer:
          "Submit your event details on Gigxo and receive direct quotes from verified corporate event bands. No agency commission — you save 15–30% compared to traditional booking agencies. You negotiate directly with the musicians and pay them directly.",
      },
    ],
  },
  "miami-wedding-music-band": {
    seoTitle: "Miami Wedding Music Bands — Live Entertainment for Your Reception | Gigxo",
    seoDescription:
      "Find live wedding music bands in Miami. Cover bands, Latin ensembles, jazz quartets, and acoustic acts for ceremonies and receptions. Direct contact, no booking fees.",
    heading: "Wedding Music Bands in Miami",
    subheading: "Live wedding music for Miami ceremonies, cocktail hours, and receptions",
    content:
      "The right wedding band sets the tone for your entire reception. Miami's wedding music scene spans intimate acoustic duos for beachside ceremonies to full 10-piece bands for grand ballroom receptions. Whatever your vision — classic elegance, high-energy dancing, Latin flair, or a mix of everything — there's a Miami wedding band that fits.\n\nWedding music bands in Miami typically quote $1,500–$7,000+ depending on the number of musicians and hours of coverage. Submit your wedding details on Gigxo and receive direct quotes from verified wedding bands — no booking agency commission.",
    pageType: "hire",
    leadCTA: "Get My Free Wedding Music Quote",
    faq: [
      {
        question: "How much does wedding music cost in Miami?",
        answer:
          "Wedding music in Miami ranges from $500 for a solo acoustic act for the ceremony to $7,000+ for a full wedding band covering ceremony, cocktail hour, and reception. A typical 4–5 piece wedding band for a 4-hour reception runs $3,000–$5,000. The average wedding band cost in Miami is around $2,190 according to WeddingWire.",
      },
      {
        question: "What's the most popular type of wedding band in Miami?",
        answer:
          "Top 40 cover bands and Latin-influenced bands are the most popular choices for Miami weddings, reflecting the city's multicultural demographics. Many couples also choose jazz ensembles for ceremony and cocktail hour, then switch to a high-energy cover band for the reception.",
      },
      {
        question: "Can I hire a band for just the ceremony in Miami?",
        answer:
          "Yes. Many Miami musicians offer ceremony-only packages — typically a solo acoustic act, duo, or string quartet for 30–60 minutes. These typically run $500–$1,500 depending on the number of musicians and travel. Submit your ceremony details for a direct quote.",
      },
    ],
  },
  "dj-gigs-miami": {
    seoTitle: "Miami DJ & Live Music Gigs — Verified Private DJ & Live Music Leads | Gigxo",
    seoDescription:
      "Browse real gig opportunities in Miami for DJs, bands, and live performers. Verified private event leads posted daily — weddings, yacht parties, corporate events. Unlock direct contact from $7, no commission.",
    heading: "Find DJ & Live Music Gigs in Miami",
    subheading: "Gig opportunities for DJs, bands, and live performers in South Florida",
    content:
      "Gigxo surfaces real gig opportunities in Miami and South Florida for DJs, bands, and live performers. New leads appear daily.",
    pageType: "hire",
  },
  "venues-hiring-djs-miami": {
    seoTitle: "Miami Venues Hiring DJs & Live Acts — Connect with Event Bookers | Gigxo",
    seoDescription:
      "Discover Miami venues and events actively looking for DJs, bands, and live performers. Unlock direct contact with bookers — no middleman, no commission. New leads added daily.",
    heading: "Venues Hiring DJs & Live Performers in Miami",
    subheading: "Miami venues and events looking for DJ and live music entertainment",
    content:
      "Discover Miami venues and events actively looking for DJs, bands, and live performers. Unlock leads and connect with decision-makers.",
    pageType: "hire",
  },
};

for (const [slug, override] of Object.entries(AV_WORK_MANUAL_OVERRIDES)) {
  MANUAL_OVERRIDES[slug] = {
    ...override,
    faq: override.faq ?? override.faqs,
  } as Partial<PageConfig>;
}

/**
 * Generate page config from service + city combination.
 * Normalizes the result so SEOLandingPage never receives undefined critical fields.
 */
export function generatePageConfig(serviceId: string, cityId: string): PageConfig | null {
  const service = SERVICES.find((s) => s.id === serviceId);
  const city = CITIES.find((c) => c.id === cityId);

  if (!service || !city) return null;

  const slug = `${serviceId}-${cityId}`;
  const override = MANUAL_OVERRIDES[slug];

  const djInclusiveDescription = `Find verified DJs, bands, and live performers in ${city.name}, ${city.state} for weddings, private events, and corporate bookings. Get direct contact with talent — no booking fees, no middleman. Leads from $7.`;
  const djGigsDescription = `Browse real gig opportunities in ${city.name} for DJs, bands, and live performers. Verified private event leads — unlock direct contact from $7. No commission, no middleman.`;
  const venuesHiringDescription = `Discover ${city.name} venues and events looking for DJs, bands, and live performers. Unlock direct contact with bookers — no middleman, no commission. New leads added daily.`;

  const isDjGigs = serviceId === "dj-gigs";
  const isVenuesHiring = serviceId === "venues-hiring-djs";
  const isDjService = serviceId === "dj";

  let seoDescription: string;
  if (isDjService) {
    seoDescription = djInclusiveDescription;
  } else if (isDjGigs) {
    seoDescription = djGigsDescription;
  } else if (isVenuesHiring) {
    seoDescription = venuesHiringDescription;
  } else {
    seoDescription = `Find verified ${service.plural.toLowerCase()} in ${city.name}, ${city.state} for weddings, private events, and corporate bookings. Get direct contact with talent — no booking fees, no middleman. Leads from $7.`;
  }

  const titleDefault = isDjGigs
    ? `Find DJ & Live Music Gigs in ${city.name} | Gigxo`
    : `Hire ${service.plural} in ${city.name} | Gigxo`;
  const seoTitleDefault = isDjGigs
    ? `${city.name} DJ & Live Music Gigs — Verified Private DJ & Live Music Leads | Gigxo`
    : `${city.name} ${service.plural} for Hire — Verified Talent, No Commission | Gigxo`;
  const headingDefault = isDjGigs
    ? `Find DJ & Live Music Gigs in ${city.name}`
    : isVenuesHiring
      ? `Venues Hiring DJs & Live Performers in ${city.name}`
      : `Hire ${service.plural} in ${city.name}`;
  const subheadingDefault = isDjService
    ? "Professional DJs, bands, and live performers for weddings, parties, and corporate events"
    : isDjGigs
      ? `Gig opportunities for DJs, bands, and live performers in ${city.region}`
      : `Professional ${service.plural.toLowerCase()} for every occasion`;
  const contentDefault = isDjService
    ? `${city.name}'s top DJs, bands, and live performers are ready to bring energy and professionalism to your event. From intimate gatherings to large celebrations, find the right talent for your needs.`
    : isDjGigs
      ? `Gigxo surfaces real gig opportunities in ${city.name} for DJs, bands, and live performers. New leads appear regularly — unlock direct contact from $7, no commission.`
      : `${city.name}'s top ${service.plural.toLowerCase()} are ready to bring energy and professionalism to your event. From intimate gatherings to large celebrations, find the perfect ${service.name.toLowerCase()} for your needs.`;

  // Generate default config (all required fields always set)
  const defaultConfig: PageConfig = {
    title: titleDefault,
    seoTitle: seoTitleDefault,
    seoDescription,
    seoH1: headingDefault,
    heading: headingDefault,
    subheading: subheadingDefault,
    defaultEventType: service.eventTypes[0] || "party",
    defaultCity: `${city.name}, ${city.state}`,
    content: contentDefault,
    priority: 0.8,
    changefreq: "weekly",
  };

  // Merge overrides (override may contain undefined; we normalize below)
  const merged: PageConfig = {
    ...defaultConfig,
    ...override,
  };

  // Auto-assign FAQ by serviceId when override doesn't provide faq
  const faqForService =
    serviceId === "wedding-dj" || serviceId === "wedding-dj-cost"
      ? WEDDING_DJ_FAQ
      : serviceId === "live-band" || serviceId === "band"
        ? LIVE_BAND_FAQ
        : serviceId === "photographer"
          ? PHOTOGRAPHER_FAQ
          : serviceId === "videographer"
            ? VIDEOGRAPHER_FAQ
            : serviceId === "dj" || serviceId === "dj-gigs" || serviceId === "venues-hiring-djs" || serviceId === "dj-cost"
              ? DJ_FAQ
              : DJ_FAQ;

  // Normalize so no critical field is undefined for SEOLandingPage
  return {
    ...merged,
    title: merged.title ?? defaultConfig.title,
    seoTitle: merged.seoTitle ?? merged.heading ?? defaultConfig.seoTitle,
    seoDescription: merged.seoDescription ?? defaultConfig.seoDescription,
    seoH1: merged.seoH1 ?? defaultConfig.seoH1,
    heading: merged.heading ?? defaultConfig.heading,
    subheading: merged.subheading ?? defaultConfig.subheading,
    defaultEventType: merged.defaultEventType ?? defaultConfig.defaultEventType,
    defaultCity: merged.defaultCity ?? defaultConfig.defaultCity,
    content: merged.content ?? defaultConfig.content,
    faq: Array.isArray(merged.faq) ? merged.faq : faqForService,
  };
}

/**
 * Generate all page configs (for sitemap, preloading, etc.)
 */
export function generateAllPageConfigs(): Record<string, PageConfig> {
  const configs: Record<string, PageConfig> = {};
  for (const service of SERVICES) {
    for (const city of CITIES) {
      const slug = `${service.id}-${city.id}`;
      if (
        (service.id === "dj-cost" || service.id === "wedding-dj-cost") &&
        !PRICING_PAGE_SLUGS.has(slug)
      ) {
        continue;
      }
      const config = generatePageConfig(service.id, city.id);
      if (config) {
        configs[slug] = config;
      }
    }
  }
  // Also include manual-only overrides that don't match a service+city pattern
  for (const [slug, override] of Object.entries(MANUAL_OVERRIDES)) {
    if (!configs[slug] && override.seoTitle) {
      configs[slug] = {
        title: override.heading ?? override.seoTitle ?? slug,
        seoTitle: override.seoTitle ?? override.heading ?? slug,
        seoDescription: override.seoDescription ?? "",
        seoH1: override.seoH1 ?? override.heading ?? "",
        heading: override.heading ?? "",
        subheading: override.subheading ?? "",
        defaultEventType: override.defaultEventType ?? "party",
        defaultCity: override.defaultCity ?? "Miami, FL",
        content: override.content ?? "",
        priority: override.priority ?? 0.7,
        changefreq: override.changefreq ?? "weekly",
        pageType: override.pageType ?? "hire",
        leadCTA: override.leadCTA,
        faq: override.faq ?? [],
        ...override,
      } as PageConfig;
    }
  }
  return configs;
}

/**
 * Get all page slugs for routing/sitemap
 */
export function getAllPageSlugs(): string[] {
  const slugs: string[] = [];

  for (const service of SERVICES) {
    for (const city of CITIES) {
      slugs.push(`${service.id}-${city.id}`);
    }
  }

  return slugs;
}

/**
 * Parse slug into service and city IDs
 */
export function parseSlug(slug: string): { serviceId: string; cityId: string } | null {
  // Handle slugs like "dj-miami", "wedding-dj-miami", "live-band-fort-lauderdale"
  // Strategy: find the longest matching service ID, remainder is city ID

  let bestMatch: { serviceId: string; cityId: string } | null = null;
  let longestServiceId = "";

  for (const service of SERVICES) {
    if (slug.startsWith(service.id + "-")) {
      const potentialCityId = slug.substring(service.id.length + 1);
      // Check if this city exists
      if (CITIES.find((c) => c.id === potentialCityId)) {
        if (service.id.length > longestServiceId.length) {
          longestServiceId = service.id;
          bestMatch = {
            serviceId: service.id,
            cityId: potentialCityId,
          };
        }
      }
    }
  }

  return bestMatch;
}
