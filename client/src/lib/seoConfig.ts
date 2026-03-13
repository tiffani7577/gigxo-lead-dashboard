/**
 * SEO Landing Page Configuration Generator
 * Generates dynamic page configs from services and cities arrays
 * Supports manual overrides for custom pages
 */

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
  faq?: { question: string; answer: string }[];
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
 * Generate page config from service + city combination
 */
export function generatePageConfig(serviceId: string, cityId: string): PageConfig | null {
  const service = SERVICES.find((s) => s.id === serviceId);
  const city = CITIES.find((c) => c.id === cityId);

  if (!service || !city) return null;

  const slug = `${serviceId}-${cityId}`;
  const override = MANUAL_OVERRIDES[slug];

  // Generate default config
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

  // Apply manual overrides
  return {
    ...defaultConfig,
    ...override,
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
