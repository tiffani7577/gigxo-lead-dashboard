/**
 * SEO Landing Page Configuration Generator
 * Generates dynamic page configs from services and cities arrays
 * Supports manual overrides for custom pages
 */

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
  priority?: number;
  changefreq?: string;
}

// Master services list
export const SERVICES: ServiceConfig[] = [
  {
    id: "dj",
    name: "DJ",
    plural: "DJs",
    description: "Professional DJs for weddings, parties, and events",
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
  { id: "dj-gigs", name: "DJ Gigs", plural: "DJ Gigs", description: "DJ gig opportunities and bookings", eventTypes: ["wedding", "party", "corporate"], keywords: ["dj gigs", "dj jobs", "gig opportunities"] },
  { id: "venues-hiring-djs", name: "Venues Hiring DJs", plural: "Venues Hiring DJs", description: "Venues and events looking for DJs", eventTypes: ["wedding", "party", "corporate", "club"], keywords: ["venues hiring djs", "dj bookings", "event entertainment"] },
];

// FAQ template constants (auto-assigned by serviceId in generatePageConfig)
const DJ_FAQ: FAQ[] = [
  { question: "How much does a DJ cost in Miami?", answer: "DJ prices in Miami typically range from $400 to $2,500 depending on the event type, duration, and experience level. Wedding DJs average $800-$1,500, while club and corporate DJs can range higher. On Gigxo, you can browse verified DJ profiles and unlock direct contact info starting from $7 — no commission, no middleman." },
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
  { id: "boca-raton", name: "Boca Raton", state: "FL", region: "South Florida" },
  { id: "west-palm-beach", name: "West Palm Beach", state: "FL", region: "South Florida" },
  { id: "orlando", name: "Orlando", state: "FL", region: "Central Florida" },
  { id: "tampa", name: "Tampa", state: "FL", region: "Tampa Bay" },
  { id: "jacksonville", name: "Jacksonville", state: "FL", region: "North Florida" },
  { id: "naples", name: "Naples", state: "FL", region: "Southwest Florida" },
  { id: "key-west", name: "Key West", state: "FL", region: "Florida Keys" },
  // Pseudo-city IDs for specific marinas / yacht venues, mapped to real cities
  { id: "bahia-mar-marina", name: "Bahia Mar Marina", state: "FL", region: "Fort Lauderdale" },
  { id: "pier-sixty-six-marina", name: "Pier Sixty-Six Marina", state: "FL", region: "Fort Lauderdale" },
  { id: "port-everglades-yacht", name: "Port Everglades Yacht", state: "FL", region: "Fort Lauderdale" },
];

// Manual overrides for specific pages (custom titles, descriptions, etc.)
const MANUAL_OVERRIDES: Record<string, Partial<PageConfig>> = {
  "dj-miami": {
    seoTitle: "Hire DJs in Miami | Club, Wedding & Event DJs",
    seoDescription:
      "Browse professional DJs in Miami for clubs, weddings, corporate events and yacht parties. Listen to sets, check availability and request a quote.",
    heading: "Hire DJs in Miami",
    subheading: "Club, wedding and event-ready DJs across Miami & South Florida",
    content:
      "Miami has one of the strongest DJ scenes in the world. Use this page to discover working DJs who play clubs, weddings, private villas and yacht parties across Miami and nearby neighborhoods. Filter by genre, experience and location, then send a quick request so we can match you with the right talent and pricing for your date.",
    pageType: "hire",
  },
  // General DJ hire page for Fort Lauderdale
  "dj-fort-lauderdale": {
    seoTitle: "Hire DJs in Fort Lauderdale | Yacht, Wedding & Event DJs",
    seoDescription:
      "Browse professional DJs in Fort Lauderdale for yacht parties, weddings and events. Listen to mixes, see locations and request a quick quote.",
    heading: "Hire DJs in Fort Lauderdale",
    subheading: "Fort Lauderdale DJs for yachts, marinas and city events",
    content:
      "Fort Lauderdale combines beach clubs, marinas and private venues—so the right DJ needs to be comfortable on land and on the water. Use this page to find working DJs near Fort Lauderdale who play yacht parties, weddings, corporate events and nightlife. Filter by genre and experience, then send a quick request with your date and location so we can recommend the strongest fits.",
    pageType: "hire",
  },
  // Wedding DJ hire page for Miami
  "wedding-dj-miami": {
    seoTitle: "Wedding DJ Miami | Hire Professional Wedding DJs",
    seoDescription:
      "Hire experienced wedding DJs in Miami for ceremonies, cocktail hours and receptions. Compare profiles, listen to mixes and request a custom quote.",
    heading: "Hire Wedding DJs in Miami",
    subheading: "Curated wedding DJs for ceremonies, cocktail hours and receptions",
    content:
      "A great wedding DJ keeps your entire night on track—from ceremony audio to the final dance. This page highlights wedding-focused DJs in Miami who can handle timelines, announcements and mixed-guest dance floors. Share a few details about your venue, guest count and music style and we’ll connect you with the right short list.",
    pageType: "hire",
  },
  // Live band example (kept as calculator/info page by default)
  "live-band-miami": {
    seoTitle: "Live Bands Miami | Professional Musicians for Weddings & Events",
    seoDescription: "Book live bands in Miami for weddings and events. Professional musicians and performers.",
    subheading: "Professional live music for your event",
    content: "Live bands bring an energy and elegance that DJs can't match. Miami's top live bands perform everything from classic standards to modern hits, perfect for weddings and upscale events.",
  },
  "yacht-dj-miami": {
    seoTitle: "Yacht DJs in Miami | Hire Boat-Ready DJs",
    seoDescription:
      "Browse yacht-ready DJs in Miami for boat parties and charters. See compact, on-water friendly setups and request a quick quote.",
    heading: "Hire Yacht DJs in Miami",
    subheading: "Miami & Fort Lauderdale yacht-ready DJs for on-water events",
    content:
      "These yacht-focused DJs understand how to perform on boats: compact setups, careful cable runs, and smooth, low-vibration stands. Tell us about your charter and we’ll match you with yacht-ready talent for Miami, Miami Beach, and Fort Lauderdale marinas.",
    pageType: "hire",
  },
  "yacht-dj-cost-miami": {
    seoTitle: "Yacht DJ Cost Miami | Luxury Yacht Party DJs",
    seoDescription:
      "Plan a yacht party in Miami or Fort Lauderdale with a professional DJ. Estimate pricing by duration and guest count, then request a custom quote.",
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
    seoTitle: "Yacht DJs in Fort Lauderdale | Hire Boat-Ready DJs",
    seoDescription:
      "Hire yacht-ready DJs in Fort Lauderdale for boat parties and intracoastal cruises. Discover compact, on-water friendly setups and request a quote.",
    heading: "Hire Yacht DJs in Fort Lauderdale",
    subheading: "Fort Lauderdale yacht DJs for marinas, cruises and intracoastal events",
    content:
      "Fort Lauderdale’s marinas and waterways are perfect for on-water events. This page highlights yacht-focused DJs who are used to tight decks, changing weather and noise considerations along the intracoastal. Tell us about your vessel, dock and timing window and we’ll recommend DJs who can bring a compact, yacht-safe setup that fits your charter.",
    pageType: "hire",
  },
  "boat-entertainment-package-miami": {
    seoTitle: "Boat Entertainment Packages Miami | DJ + Sax & More",
    seoDescription:
      "Build a custom boat entertainment package in Miami with DJ, saxophone, percussion, and compact yacht-ready setups. Get an instant estimate and request a quote.",
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
  // Venue / marina pages (pageType: "venue")
  "dj-bahia-mar-marina": {
    seoTitle: "DJ for Bahia Mar Marina | Fort Lauderdale Yacht & Dockside Events",
    seoDescription:
      "Book DJs for Bahia Mar Marina yacht parties and dockside events in Fort Lauderdale. Discover boat-friendly DJs and request a quick quote.",
    heading: "Hire DJs for Bahia Mar Marina",
    subheading: "Boat-friendly DJs for Bahia Mar Marina charters and dockside events",
    content:
      "Bahia Mar Marina sits right off Fort Lauderdale Beach and hosts everything from private yacht charters to marina-side celebrations. This page focuses on DJs who understand on-water events—compact rigs, careful cable runs and respectful volume along the intracoastal. Share your slip, timing and guest count so we can match you with Bahia Mar–ready DJs.",
    pageType: "venue",
  },
  "dj-pier-sixty-six-marina": {
    seoTitle: "DJ for Pier Sixty-Six Marina | Fort Lauderdale Yacht DJs",
    seoDescription:
      "Hire DJs for Pier Sixty-Six Marina yacht charters and events. Find yacht-ready, compact setups and request a quote for your Fort Lauderdale departure.",
    heading: "Hire DJs for Pier Sixty-Six Marina",
    subheading: "Yacht-ready DJs for Pier Sixty-Six Marina departures",
    content:
      "Pier Sixty-Six Marina is a launch point for high-end charters and private events. Use this page to find DJs who are comfortable loading in through marina access points, working around tight decks and keeping sound controlled for nearby vessels. Tell us about your yacht size, itinerary and preferred genres to see the best fits.",
    pageType: "venue",
  },
  "dj-orlando": {
    seoTitle: "Hire DJs in Orlando | Event & Wedding DJs",
    seoDescription: "Browse professional DJs in Orlando for weddings, events and parties. Request a quote.",
    heading: "Hire DJs in Orlando",
    subheading: "Event and wedding DJs across Orlando and Central Florida",
    content: "Find vetted DJs in Orlando for weddings, corporate events and parties. Compare profiles and request a quote.",
    pageType: "hire",
  },
  "band-miami": {
    seoTitle: "Hire Bands in Miami | Live Bands for Events",
    seoDescription: "Book live bands in Miami for weddings, corporate events and parties.",
    heading: "Hire Bands in Miami",
    subheading: "Live bands and musicians in Miami",
    content: "Miami's top live bands for weddings, corporate events and private parties. Browse and request a quote.",
    pageType: "hire",
  },
  "dj-gigs-miami": {
    seoTitle: "DJ Gigs in Miami | Gig Opportunities for DJs",
    seoDescription: "Find DJ gig opportunities in Miami. New gigs posted regularly.",
    heading: "DJ Gigs in Miami",
    subheading: "Gig opportunities for DJs in South Florida",
    content: "Gigxo surfaces real DJ gig opportunities in Miami and South Florida. New leads appear daily.",
    pageType: "hire",
  },
  "venues-hiring-djs-miami": {
    seoTitle: "Venues Hiring DJs in Miami | Event Entertainment",
    seoDescription: "Venues and events in Miami looking for DJs. Connect with bookers.",
    heading: "Venues Hiring DJs in Miami",
    subheading: "Miami venues and events looking for DJ entertainment",
    content: "Discover Miami venues and events actively looking for DJs. Unlock leads and connect with decision-makers.",
    pageType: "hire",
  },
  "dj-port-everglades-yacht": {
    seoTitle: "DJ for Port Everglades Yacht Charters | Fort Lauderdale DJs",
    seoDescription:
      "Hire DJs for Port Everglades yacht charters and corporate cruises. Boat-friendly, compact DJ setups with Fort Lauderdale departure coverage.",
    heading: "Hire DJs for Port Everglades Yacht Charters",
    subheading: "Corporate and private yacht DJs for Port Everglades departures",
    content:
      "Port Everglades is a starting point for corporate cruises, incentive trips and private yacht charters. This page highlights DJs who can handle early load-ins, strict timelines and compact, seaworthy setups. Share your vessel details, boarding window and vibe so we can recommend DJs who are a fit for Port Everglades operations.",
    pageType: "venue",
  },
};

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

  // Generate default config (all required fields always set)
  const defaultConfig: PageConfig = {
    title: `Hire ${service.plural} in ${city.name} | Gigxo`,
    seoTitle: `${service.name} ${city.name} | Professional ${service.plural} for Events`,
    seoDescription: `Hire ${service.plural.toLowerCase()} in ${city.name}, ${city.state}. Browse profiles, read reviews, and book instantly.`,
    heading: `Hire ${service.plural} in ${city.name}`,
    subheading: `Professional ${service.plural.toLowerCase()} for every occasion`,
    defaultEventType: service.eventTypes[0] || "party",
    defaultCity: `${city.name}, ${city.state}`,
    content: `${city.name}'s top ${service.plural.toLowerCase()} are ready to bring energy and professionalism to your event. From intimate gatherings to large celebrations, find the perfect ${service.name.toLowerCase()} for your needs.`,
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
    serviceId === "wedding-dj"
      ? WEDDING_DJ_FAQ
      : serviceId === "live-band" || serviceId === "band"
        ? LIVE_BAND_FAQ
        : serviceId === "photographer"
          ? PHOTOGRAPHER_FAQ
          : serviceId === "videographer"
            ? VIDEOGRAPHER_FAQ
            : (serviceId === "dj" || serviceId === "dj-gigs" || serviceId === "venues-hiring-djs" ? DJ_FAQ : DJ_FAQ);

  // Normalize so no critical field is undefined for SEOLandingPage
  return {
    ...merged,
    title: merged.title ?? defaultConfig.title,
    seoTitle: merged.seoTitle ?? merged.heading ?? defaultConfig.seoTitle,
    seoDescription: merged.seoDescription ?? defaultConfig.seoDescription,
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
      const config = generatePageConfig(service.id, city.id);
      if (config) {
        configs[slug] = config;
      }
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
