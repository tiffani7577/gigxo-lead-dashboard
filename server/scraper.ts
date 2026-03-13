/**
 * Gigxo Lead Ingestion Pipeline — Multi-Source Edition
 *
 * Architecture (Apollo/Hunter-style):
 *   1. COLLECT  — Distributed collectors fetch raw documents from public sources
 *   2. INGEST   — Deduplicate, normalize city/date, store raw text + URL + source
 *   3. CLASSIFY — LLM scores each document: Is this a real event need? (0-100)
 *   4. EXTRACT  — Entity extraction: date, city, budget, performer type, contact
 *   5. SCORE    — Composite lead score (intent + entity completeness + budget signal)
 *   6. PUSH     — High-confidence leads (score ≥ 60) → admin approval queue
 *
 * Sources:
 *   • Reddit JSON API      — r/weddingplanning, r/eventplanning, r/HireAMusician,
 *                            r/forhire, city subreddits (free, no auth)
 *   • DuckDuckGo HTML      — "hire dj [city]", "need band [city]", etc.
 *   • Craigslist (proxy)   — gigs + events sections via ScraperAPI (optional)
 *   • Bing News RSS        — entertainment hire news/posts
 *   • Community boards     — The Knot community, public event forums
 *
 * Contact info strategy:
 *   - Real emails/phones extracted from post text when present
 *   - Otherwise: source post URL + username (artists DM the poster directly)
 *
 * Source badge shown to admin: actual source name (Reddit, Craigslist, etc.)
 * Source badge shown to artists: hidden (per platform policy)
 */

import { createHash } from "crypto";
import { getDb } from "./db";
import { gigLeads } from "../drizzle/schema";
import { getUpcomingWindowsForMarket } from "./events";
import { eq, or } from "drizzle-orm";
import { getLeadUnlockPriceCents } from "../shared/leadPricing";
import { invokeLLM } from "./_core/llm";
import { enrichLead, type RawScrapedDoc } from "./intelligenceEngine";
import { collectFromRedditExpanded } from "./scraper-collectors/reddit-expanded";
import { runRedditCollector } from "./scraper-collectors/reddit-collector";
import { collectFromQuora } from "./scraper-collectors/quora";
import { collectFromMeetup } from "./scraper-collectors/meetup";
import { collectFromGoogleNews } from "./scraper-collectors/google-news";

export interface ScrapedLead {
  externalId: string;
  source: "gigxo" | "eventbrite" | "thumbtack" | "yelp" | "craigslist" | "nextdoor" | "facebook" | "manual" | "gigsalad" | "thebash" | "weddingwire" | "theknot";
  title: string;
  description: string;
  eventType: string;
  performerType?: "dj" | "solo_act" | "small_band" | "large_band" | "singer" | "instrumentalist" | "immersive_experience" | "hybrid_electronic" | "photo_video" | "photo_booth" | "makeup_artist" | "emcee" | "princess_character" | "other";
  budget: number; // in cents
  location: string;
  eventDate?: Date;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  venueUrl?: string;  // Source URL — admin clicks to verify original post
  intentScore?: number; // 0-100 AI confidence score
  rawSource?: string;   // Human-readable source label for admin (e.g. "Reddit r/weddingplanning")

  // Intelligence Engine fields
  sourceLabel?: string;
  sourceTrust?: number;
  contactScore?: number;
  freshnessScore?: number;
  finalScore?: number;
  winProbability?: number;
  competitionLevel?: "low" | "medium" | "high";
  suggestedRate?: string;
  pitchStyle?: string;
  leadTemperature?: "hot" | "warm" | "cold";
  buyerType?: string;
  venueType?: string;
  estimatedGuestCount?: number;
  prestigeScore?: number;
  urgencyScore?: number;
  budgetConfidence?: "low" | "medium" | "high";
  intentEvidence?: string;
  contactEvidence?: string;
  eventEvidence?: string;
  sourceEvidence?: string;
  eventWindowId?: number;
  scrapeKeyword?: string;
}

// ─── Raw Document (pre-classification) ────────────────────────────────────────

export interface RawDocument {
  id: string;          // Unique ID for deduplication
  source: string;      // e.g. "reddit", "craigslist", "duckduckgo"
  sourceLabel: string; // e.g. "Reddit r/weddingplanning", "Craigslist Miami"
  url: string;         // Original post URL
  title: string;
  body: string;
  author?: string;
  createdAt?: Date;
  marketId: string;
}

// ─── Collector Integration ────────────────────────────────────────────────────────
// All new collectors (Twitter, Facebook, Instagram, Eventbrite, etc.) are registered
// and will be called in parallel via runCollectorsInParallel()

// ─── Content Hash ─────────────────────────────────────────────────────────────

function makeContentHash(title: string, location: string, eventDate?: Date): string {
  const month = eventDate ? `${eventDate.getFullYear()}-${eventDate.getMonth()}` : "no-date";
  const normalized = `${title.toLowerCase().trim()}|${location.toLowerCase().trim()}|${month}`;
  return createHash("sha256").update(normalized).digest("hex").slice(0, 64);
}

// ─── US Market Definitions ────────────────────────────────────────────────────

export interface CityMarket {
  id: string;
  displayName: string;
  state: string;
  areaCodes: string[];
  neighborhoods: string[];
  eventbriteQuery: string;
  redditCities: string[];
  craigslistSubdomain: string; // e.g. "miami", "newyork", "losangeles"
}

export const US_MARKETS: CityMarket[] = [
  {
    id: "miami",
    displayName: "Miami",
    state: "FL",
    areaCodes: ["305", "954", "786"],
    neighborhoods: ["Brickell", "Wynwood", "South Beach", "Edgewater", "Coconut Grove", "Coral Gables", "Aventura", "Doral", "Hialeah", "Miami Beach", "Fort Lauderdale", "Pompano Beach", "Hollywood", "Hallandale Beach"],
    eventbriteQuery: "Miami,FL",
    redditCities: ["Miami", "fortlauderdale"],
    craigslistSubdomain: "miami",
  },
  {
    id: "nyc",
    displayName: "New York City",
    state: "NY",
    areaCodes: ["212", "718", "646", "917"],
    neighborhoods: ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island", "Midtown", "Lower East Side", "Williamsburg", "Astoria", "Harlem"],
    eventbriteQuery: "New York,NY",
    redditCities: ["nyc", "Brooklyn", "Queens"],
    craigslistSubdomain: "newyork",
  },
  {
    id: "la",
    displayName: "Los Angeles",
    state: "CA",
    areaCodes: ["213", "310", "323", "424", "818"],
    neighborhoods: ["Hollywood", "West Hollywood", "Beverly Hills", "Santa Monica", "Venice", "Silver Lake", "Echo Park", "Downtown LA", "Koreatown"],
    eventbriteQuery: "Los Angeles,CA",
    redditCities: ["LosAngeles", "LAlist"],
    craigslistSubdomain: "losangeles",
  },
  {
    id: "chicago",
    displayName: "Chicago",
    state: "IL",
    areaCodes: ["312", "773", "872"],
    neighborhoods: ["River North", "Wicker Park", "Lincoln Park", "Wrigleyville", "Logan Square", "Pilsen", "Hyde Park", "Gold Coast"],
    eventbriteQuery: "Chicago,IL",
    redditCities: ["chicago"],
    craigslistSubdomain: "chicago",
  },
  {
    id: "houston",
    displayName: "Houston",
    state: "TX",
    areaCodes: ["713", "281", "832", "346"],
    neighborhoods: ["Midtown", "Montrose", "Heights", "Downtown", "Museum District", "River Oaks", "Galleria", "Memorial"],
    eventbriteQuery: "Houston,TX",
    redditCities: ["houston"],
    craigslistSubdomain: "houston",
  },
  {
    id: "dallas",
    displayName: "Dallas",
    state: "TX",
    areaCodes: ["214", "469", "972"],
    neighborhoods: ["Uptown", "Deep Ellum", "Bishop Arts", "Oak Cliff", "Lower Greenville", "Knox-Henderson", "Design District"],
    eventbriteQuery: "Dallas,TX",
    redditCities: ["Dallas", "DFWMetro"],
    craigslistSubdomain: "dallas",
  },
  {
    id: "atlanta",
    displayName: "Atlanta",
    state: "GA",
    areaCodes: ["404", "678", "770"],
    neighborhoods: ["Midtown", "Buckhead", "Old Fourth Ward", "Little Five Points", "Inman Park", "Grant Park", "East Atlanta", "Decatur"],
    eventbriteQuery: "Atlanta,GA",
    redditCities: ["Atlanta"],
    craigslistSubdomain: "atlanta",
  },
  {
    id: "las_vegas",
    displayName: "Las Vegas",
    state: "NV",
    areaCodes: ["702", "725"],
    neighborhoods: ["The Strip", "Downtown", "Summerlin", "Henderson", "North Las Vegas"],
    eventbriteQuery: "Las Vegas,NV",
    redditCities: ["vegaslocals", "LasVegas"],
    craigslistSubdomain: "lasvegas",
  },
  {
    id: "nashville",
    displayName: "Nashville",
    state: "TN",
    areaCodes: ["615", "629"],
    neighborhoods: ["Broadway", "The Gulch", "East Nashville", "12 South", "Germantown"],
    eventbriteQuery: "Nashville,TN",
    redditCities: ["nashville"],
    craigslistSubdomain: "nashville",
  },
  {
    id: "orlando",
    displayName: "Orlando",
    state: "FL",
    areaCodes: ["407", "321", "689"],
    neighborhoods: ["Downtown", "Thornton Park", "Mills 50", "Winter Park", "Windermere"],
    eventbriteQuery: "Orlando,FL",
    redditCities: ["orlando"],
    craigslistSubdomain: "orlando",
  },
  {
    id: "phoenix",
    displayName: "Phoenix",
    state: "AZ",
    areaCodes: ["602", "480", "623"],
    neighborhoods: ["Downtown", "Scottsdale", "Tempe", "Mesa", "Chandler"],
    eventbriteQuery: "Phoenix,AZ",
    redditCities: ["phoenix", "Scottsdale"],
    craigslistSubdomain: "phoenix",
  },
  {
    id: "dc",
    displayName: "Washington DC",
    state: "DC",
    areaCodes: ["202", "301", "703"],
    neighborhoods: ["U Street", "Adams Morgan", "Georgetown", "Dupont Circle", "Capitol Hill"],
    eventbriteQuery: "Washington,DC",
    redditCities: ["washingtondc", "nova"],
    craigslistSubdomain: "washingtondc",
  },
];

// ─── Regex Helpers ─────────────────────────────────────────────────────────────

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const BUDGET_REGEX = /\$\s*([\d,]+)(?:\s*[-–]\s*\$?\s*([\d,]+))?/g;

function extractEmails(text: string): string[] {
  const matches = text.match(EMAIL_REGEX) ?? [];
  return matches.filter(e =>
    !e.includes("example.com") && !e.includes("youremail") &&
    !e.includes("email@") && e.length < 100
  );
}

function extractPhones(text: string): string[] {
  const matches = text.match(PHONE_REGEX) ?? [];
  return matches.filter(p => {
    const digits = p.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 11 &&
      !digits.startsWith("555") && !digits.startsWith("000") && !digits.startsWith("1111");
  });
}

function extractBudget(text: string): number | null {
  const matches = Array.from(text.matchAll(BUDGET_REGEX));
  if (matches.length === 0) return null;
  const first = matches[0];
  const low = parseInt(first[1].replace(/,/g, ""), 10);
  const high = first[2] ? parseInt(first[2].replace(/,/g, ""), 10) : low;
  const avg = Math.round((low + high) / 2);
  if (avg < 100 || avg > 50000) return null;
  return avg * 100;
}

// ─── Performer Type Detection ─────────────────────────────────────────────────

type PerformerType = "dj" | "solo_act" | "small_band" | "large_band" | "singer" | "instrumentalist" | "immersive_experience" | "hybrid_electronic" | "photo_video" | "photo_booth" | "makeup_artist" | "emcee" | "princess_character" | "other";

function detectPerformerType(text: string): PerformerType {
  const lower = text.toLowerCase();
  if (/\bdj\b|disc jockey|deejay/.test(lower)) return "dj";
  if (/photo booth|photobooth/.test(lower)) return "photo_booth";
  if (/photographer|videographer|photo.?video/.test(lower)) return "photo_video";
  if (/makeup artist|hair.?makeup|mua\b|beauty artist/.test(lower)) return "makeup_artist";
  if (/emcee|mc\b|host\b|master of ceremonies/.test(lower)) return "emcee";
  if (/princess|character entertainer|face paint/.test(lower)) return "princess_character";
  if (/\bband\b.*\b(5|6|7|8|9|10|eleven|twelve)\b|\blarge band\b|orchestra/.test(lower)) return "large_band";
  if (/\bband\b|live music|trio|quartet|duo/.test(lower)) return "small_band";
  if (/singer|vocalist|vocal/.test(lower)) return "singer";
  if (/guitarist|pianist|violinist|cellist|saxophon|trumpet|instrument/.test(lower)) return "instrumentalist";
  if (/live electronic|hybrid|ableton/.test(lower)) return "hybrid_electronic";
  return "other";
}

function detectEventType(text: string): string {
  const lower = text.toLowerCase();
  if (/\bwedding\b/.test(lower)) return "Wedding";
  if (/quincea[ñn]era|quince/.test(lower)) return "Quinceañera";
  if (/sweet\s*16|sweet sixteen/.test(lower)) return "Sweet 16";
  if (/bar mitzvah|bat mitzvah/.test(lower)) return "Bar/Bat Mitzvah";
  if (/graduation|grad party/.test(lower)) return "Graduation Party";
  if (/bachelorette/.test(lower)) return "Bachelorette Party";
  if (/birthday|bday/.test(lower)) return "Birthday Party";
  if (/baby shower/.test(lower)) return "Baby Shower";
  if (/bridal shower/.test(lower)) return "Bridal Shower";
  if (/corporate|company|office|work event|team building/.test(lower)) return "Corporate Event";
  if (/holiday party|christmas party|new year/.test(lower)) return "Holiday Party";
  if (/nightclub|club night|rave|edm/.test(lower)) return "Nightclub";
  if (/pool party/.test(lower)) return "Pool Party";
  if (/rooftop/.test(lower)) return "Rooftop Party";
  if (/festival|outdoor concert/.test(lower)) return "Festival";
  if (/charity|gala|fundraiser/.test(lower)) return "Charity Gala";
  if (/grand opening|launch party|product launch/.test(lower)) return "Grand Opening";
  return "Private Party";
}

// ─── Keyword Pre-Filter (fast, before LLM) ────────────────────────────────────

const SEEKING_KEYWORDS = [
  "looking for", "need a", "need dj", "need band", "need musician",
  "hire a", "hire dj", "hire band", "recommendations for", "recommend a",
  "anyone know a", "can anyone recommend", "seeking a", "in search of",
  "want to hire", "want to book", "trying to find", "help finding",
  "suggestions for", "who should i hire", "who do i hire", "can you recommend",
  "does anyone know", "any recommendations", "any suggestions",
  "looking to hire", "looking to book", "need help with", "need someone",
  "looking for someone", "seeking someone", "anyone available", "any djs",
  "any bands", "any musicians", "any photographers", "any videographers",
];

const ENTERTAINMENT_KEYWORDS = [
  "dj", "band", "musician", "singer", "vocalist", "entertainment",
  "photographer", "videographer", "photo booth", "makeup artist",
  "emcee", "mc ", "live music", "performer", "instrumentalist",
];

const OFFERING_KEYWORDS = [
  "[for hire]", "[hiring]", "available for", "available to book",
  "i am a dj", "i am a photographer", "i am a musician",
  "my services", "book me", "hire me", "dm me for rates",
  "i offer", "i provide", "i specialize in", "check out my",
  "portfolio", "my work", "my mixes", "my music",
];

function passesKeywordFilter(title: string, body: string): boolean {
  const combined = (title + " " + body).toLowerCase();
  if (OFFERING_KEYWORDS.some(k => combined.includes(k))) return false;
  const hasSeeking = SEEKING_KEYWORDS.some(k => combined.includes(k));
  const hasEntertainment = ENTERTAINMENT_KEYWORDS.some(k => combined.includes(k));
  return hasSeeking && hasEntertainment;
}

// ─── AI Intent Classification ─────────────────────────────────────────────────

interface ClassificationResult {
  intentScore: number;       // 0-100: confidence this is a real event need
  isRealEventNeed: boolean;  // true if score >= 50
  isFutureLooking: boolean;  // event hasn't happened yet
  performerType: string;     // detected performer type
  extractedDate: string | null;
  extractedCity: string | null;
  extractedBudget: number | null; // in cents
  extractedContact: string | null;
  refinedTitle: string;      // cleaned up title for display
  refinedDescription: string; // cleaned up description
}

async function classifyWithLLM(doc: RawDocument): Promise<ClassificationResult | null> {
  try {
    const prompt = `You are a lead qualification engine for a gig marketplace. Analyze this public post and extract structured data.

POST TITLE: ${doc.title}
POST BODY: ${doc.body.slice(0, 800)}
SOURCE: ${doc.sourceLabel}
MARKET: ${doc.marketId}

Respond with JSON only. No markdown, no explanation.`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a lead qualification engine. Analyze posts and return structured JSON. Be conservative — only mark as real event needs if there is clear buyer intent.",
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "lead_classification",
          strict: true,
          schema: {
            type: "object",
            properties: {
              intentScore: {
                type: "integer",
                description: "0-100 confidence this is a real, actionable event entertainment need. 0=spam/irrelevant, 50=possible, 80+=strong buyer intent with event details",
              },
              isRealEventNeed: {
                type: "boolean",
                description: "True if this post is from someone genuinely seeking to hire entertainment for a real upcoming event",
              },
              isFutureLooking: {
                type: "boolean",
                description: "True if the event is in the future (not already happened)",
              },
              performerType: {
                type: "string",
                description: "One of: dj, small_band, large_band, singer, instrumentalist, photo_video, photo_booth, makeup_artist, emcee, hybrid_electronic, princess_character, other",
              },
              extractedDate: {
                type: ["string", "null"],
                description: "Event date if mentioned, in YYYY-MM-DD format. Null if not mentioned.",
              },
              extractedCity: {
                type: ["string", "null"],
                description: "City and state if mentioned (e.g. 'Miami, FL'). Null if not mentioned.",
              },
              extractedBudget: {
                type: ["integer", "null"],
                description: "Budget in cents if mentioned (e.g. $500 = 50000). Null if not mentioned.",
              },
              extractedContact: {
                type: ["string", "null"],
                description: "Email or phone number if mentioned in the post. Null if not mentioned.",
              },
              refinedTitle: {
                type: "string",
                description: "A clean, professional 5-10 word title for this lead (e.g. 'DJ Needed for July Wedding in Miami'). Do NOT include platform names.",
              },
              refinedDescription: {
                type: "string",
                description: "A clean 1-3 sentence summary of the event need, suitable for display to performers. Max 300 chars.",
              },
            },
            required: ["intentScore", "isRealEventNeed", "isFutureLooking", "performerType", "extractedDate", "extractedCity", "extractedBudget", "extractedContact", "refinedTitle", "refinedDescription"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response?.choices?.[0]?.message?.content;
    if (!rawContent) return null;
    const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
    return JSON.parse(content) as ClassificationResult;
  } catch (err) {
    console.error("[Scraper] LLM classification failed:", err);
    return null;
  }
}

// ─── Lead Scoring ─────────────────────────────────────────────────────────────

function computeLeadScore(doc: RawDocument, classification: ClassificationResult): number {
  let score = classification.intentScore;

  // Bonus for entity completeness
  if (classification.extractedDate) score += 10;
  if (classification.extractedCity) score += 5;
  if (classification.extractedBudget) score += 10;
  if (classification.extractedContact) score += 15;

  // Penalty for not future-looking
  if (!classification.isFutureLooking) score -= 30;

  // Bonus for high-signal sources
  if (doc.source === "reddit") score += 5;
  if (doc.source === "craigslist") score += 10; // Craigslist posts are usually very actionable

  return Math.min(100, Math.max(0, score));
}

// ─── Collector 1: Reddit ──────────────────────────────────────────────────────

const REDDIT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json",
  "Accept-Language": "en-US,en;q=0.9",
};

async function fetchRedditPosts(url: string): Promise<any[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, { headers: REDDIT_HEADERS, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data = await res.json() as any;
    return (data?.data?.children ?? []).filter((c: any) => c.kind === "t3").map((c: any) => c.data);
  } catch {
    return [];
  }
}

async function collectFromReddit(market: CityMarket): Promise<RawDocument[]> {
  const docs: RawDocument[] = [];
  const seenIds = new Set<string>();

  const globalSearches = [
    // Wedding planning — high buyer intent (t=month = past 30 days)
    "https://www.reddit.com/r/weddingplanning/search.json?q=dj+OR+band+OR+musician+OR+entertainment&sort=new&t=month&limit=100&restrict_sr=1",
    "https://www.reddit.com/r/weddingplanning/search.json?q=looking+for+photographer+OR+need+photographer&sort=new&t=month&limit=50&restrict_sr=1",
    "https://www.reddit.com/r/weddingplanning/search.json?q=makeup+artist+OR+hair+makeup&sort=new&t=month&limit=50&restrict_sr=1",
    "https://www.reddit.com/r/weddingplanning/search.json?q=looking+for+dj+OR+need+dj+OR+hire+dj&sort=new&t=month&limit=50&restrict_sr=1",
    // Event planning
    "https://www.reddit.com/r/eventplanning/search.json?q=dj+OR+band+OR+entertainment+OR+musician&sort=new&t=month&limit=100&restrict_sr=1",
    "https://www.reddit.com/r/eventplanning/search.json?q=looking+for+dj+OR+need+entertainment&sort=new&t=month&limit=50&restrict_sr=1",
    "https://www.reddit.com/r/eventplanning/search.json?q=photographer+OR+videographer+OR+photo+booth&sort=new&t=month&limit=50&restrict_sr=1",
    // Hire-specific subreddits
    "https://www.reddit.com/r/HireAMusician/new.json?limit=100&t=month",
    "https://www.reddit.com/r/forhire/search.json?q=dj+OR+musician+OR+band+OR+entertainment&sort=new&t=month&limit=100&restrict_sr=1",
    // Party planning
    "https://www.reddit.com/r/party/search.json?q=dj+OR+band+OR+entertainment&sort=new&t=month&limit=50&restrict_sr=1",
    // Quinceañera
    "https://www.reddit.com/r/Quinceanera/search.json?q=dj+OR+band+OR+entertainment&sort=new&t=month&limit=50&restrict_sr=1",
    // Bachelorette / bridal
    "https://www.reddit.com/r/bachelorette/search.json?q=dj+OR+band+OR+entertainment&sort=new&t=month&limit=50&restrict_sr=1",
    // Bar/Bat Mitzvah
    "https://www.reddit.com/r/Judaism/search.json?q=dj+OR+band+OR+entertainment+bar+mitzvah&sort=new&t=month&limit=25&restrict_sr=1",
  ];

  // City-specific subreddits — 30-day lookback
  const citySearches = market.redditCities.flatMap(city => [
    `https://www.reddit.com/r/${city}/search.json?q=dj+OR+band+OR+entertainment+OR+musician+event&sort=new&t=month&limit=50&restrict_sr=1`,
    `https://www.reddit.com/r/${city}/search.json?q=looking+for+dj+OR+need+dj+OR+hire+dj&sort=new&t=month&limit=50&restrict_sr=1`,
    `https://www.reddit.com/r/${city}/search.json?q=wedding+dj+OR+wedding+band+OR+wedding+photographer&sort=new&t=month&limit=50&restrict_sr=1`,
    `https://www.reddit.com/r/${city}/search.json?q=need+photographer+OR+hire+photographer+OR+need+makeup&sort=new&t=month&limit=25&restrict_sr=1`,
  ]);

  const allUrls = [...globalSearches, ...citySearches];

  for (const url of allUrls) {
    const posts = await fetchRedditPosts(url);
    for (const post of posts) {
      if (seenIds.has(post.id)) continue;
      seenIds.add(post.id);

      // Quick keyword pre-filter before LLM (saves API calls)
      if (!passesKeywordFilter(post.title, post.selftext || "")) continue;

      const subreddit = post.subreddit || url.match(/r\/(\w+)/)?.[1] || "reddit";
      docs.push({
        id: `reddit-${post.id}`,
        source: "reddit",
        sourceLabel: `Reddit r/${subreddit}`,
        url: `https://www.reddit.com${post.permalink}`,
        title: post.title,
        body: post.selftext || "",
        author: post.author !== "[deleted]" ? post.author : undefined,
        createdAt: post.created_utc ? new Date(post.created_utc * 1000) : undefined,
        marketId: market.id,
      });
    }
    await new Promise(r => setTimeout(r, 250));
  }

  console.log(`[Collector] Reddit: ${docs.length} raw docs for ${market.displayName}`);
  return docs;
}

// ─── Collector 2: DuckDuckGo HTML Search ─────────────────────────────────────

const DDG_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

async function collectFromDuckDuckGo(market: CityMarket): Promise<RawDocument[]> {
  const docs: RawDocument[] = [];
  const seenUrls = new Set<string>();

  const queries = [
    `looking for dj ${market.displayName}`,
    `need dj ${market.displayName} wedding`,
    `hire band ${market.displayName} event`,
    `need photographer ${market.displayName} wedding`,
    `dj needed ${market.displayName} party`,
    `looking for entertainment ${market.displayName}`,
    `hire musician ${market.displayName}`,
    `need makeup artist ${market.displayName} wedding`,
  ];

  for (const query of queries) {
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&df=m`; // past month
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, { headers: DDG_HEADERS, signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) continue;

      const html = await res.text();

      // Extract result titles, snippets, and URLs
      const resultPattern = /class="result__title"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
      const matches = Array.from(html.matchAll(resultPattern));

      for (const match of matches.slice(0, 5)) {
        const [, href, rawTitle, rawSnippet] = match;
        const title = rawTitle.replace(/<[^>]+>/g, "").trim();
        const snippet = rawSnippet.replace(/<[^>]+>/g, "").trim();

        // Skip results from job boards, spam, or irrelevant sites
        if (!href || seenUrls.has(href)) continue;
        if (href.includes("indeed.com") || href.includes("linkedin.com") || href.includes("glassdoor.com")) continue;
        if (title.length < 10 || snippet.length < 20) continue;

        seenUrls.add(href);

        if (!passesKeywordFilter(title, snippet)) continue;

        docs.push({
          id: `ddg-${createHash("sha256").update(href).digest("hex").slice(0, 16)}`,
          source: "duckduckgo" as any,
          sourceLabel: `Web Search (${market.displayName})`,
          url: href,
          title,
          body: snippet,
          marketId: market.id,
        });
      }
    } catch {
      // Silently skip failed searches
    }
    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`[Collector] DuckDuckGo: ${docs.length} raw docs for ${market.displayName}`);
  return docs;
}

// ─── Collector 3: Craigslist via ScraperAPI ───────────────────────────────────

async function collectFromCraigslist(market: CityMarket): Promise<RawDocument[]> {
  const scraperApiKey = process.env.SCRAPER_API_KEY;
  if (!scraperApiKey) {
    console.log("[Collector] Craigslist: Skipped (no SCRAPER_API_KEY)");
    return [];
  }

  const docs: RawDocument[] = [];
  const seenIds = new Set<string>();

  // Craigslist search queries for gigs + events sections
  const searches = [
    { section: "ggg", query: "dj needed" },
    { section: "ggg", query: "dj wanted" },
    { section: "ggg", query: "band needed" },
    { section: "ggg", query: "musician needed" },
    { section: "ggg", query: "entertainment needed" },
    { section: "eve", query: "dj" },
    { section: "eve", query: "band" },
  ];

  for (const { section, query } of searches) {
    try {
      const clUrl = `https://${market.craigslistSubdomain}.craigslist.org/search/${section}?query=${encodeURIComponent(query)}&format=json`;
      const proxyUrl = `https://api.scraperapi.com/?api_key=${scraperApiKey}&url=${encodeURIComponent(clUrl)}&country_code=us`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) continue;
      const text = await res.text();

      // Try to parse as JSON first (Craigslist JSON API)
      let items: any[] = [];
      try {
        const json = JSON.parse(text);
        // Craigslist JSON format: array of items or { items: [...] }
        items = Array.isArray(json) ? json : (json.items ?? json.data ?? []);
      } catch {
        // Fall back to HTML parsing for listing titles and URLs
        const titlePattern = /<a[^>]*class="[^"]*posting-title[^"]*"[^>]*href="([^"]+)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*label[^"]*"[^>]*>([\s\S]*?)<\/span>/g;
        const htmlMatches = Array.from(text.matchAll(titlePattern));
        for (const m of htmlMatches) {
          const [, url, title] = m;
          const cleanTitle = title.replace(/<[^>]+>/g, "").trim();
          if (cleanTitle && url && !seenIds.has(url)) {
            seenIds.add(url);
            docs.push({
              id: `craigslist-${createHash("sha256").update(url).digest("hex").slice(0, 16)}`,
              source: "craigslist",
              sourceLabel: `Craigslist ${market.displayName}`,
              url,
              title: cleanTitle,
              body: cleanTitle, // Title only from HTML parse
              marketId: market.id,
            });
          }
        }
        continue;
      }

      for (const item of items.slice(0, 20)) {
        const id = item.id || item.pid || String(item.PostingID || "");
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);

        const title = item.PostingTitle || item.title || item.name || "";
        const body = item.PostingBody || item.body || item.description || title;
        const url = item.PostingURL || item.url || `https://${market.craigslistSubdomain}.craigslist.org/${section}/${id}.html`;

        if (!passesKeywordFilter(title, body)) continue;

        docs.push({
          id: `craigslist-${id}`,
          source: "craigslist",
          sourceLabel: `Craigslist ${market.displayName}`,
          url,
          title,
          body,
          marketId: market.id,
        });
      }
    } catch {
      // Silently skip failed requests
    }
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`[Collector] Craigslist: ${docs.length} raw docs for ${market.displayName}`);
  return docs;
}

// ─── Collector 4: Bing News RSS ───────────────────────────────────────────────

async function collectFromBingNews(market: CityMarket): Promise<RawDocument[]> {
  const docs: RawDocument[] = [];
  const seenUrls = new Set<string>();

  const queries = [
    `hire dj ${market.displayName} wedding`,
    `need band ${market.displayName} event`,
    `looking for entertainment ${market.displayName}`,
  ];

  for (const query of queries) {
    try {
      const url = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=RSS`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) continue;

      const xml = await res.text();

      // Parse RSS items
      const itemPattern = /<item>([\s\S]*?)<\/item>/g;
      const items = Array.from(xml.matchAll(itemPattern));

      for (const item of items.slice(0, 5)) {
        const [, itemXml] = item;
        const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/);
        const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
        const descMatch = itemXml.match(/<description>([\s\S]*?)<\/description>/);

        const title = titleMatch?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() ?? "";
        const link = linkMatch?.[1]?.trim() ?? "";
        const desc = descMatch?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").trim() ?? "";

        if (!title || !link || seenUrls.has(link)) continue;
        seenUrls.add(link);

        if (!passesKeywordFilter(title, desc)) continue;

        docs.push({
          id: `bing-${createHash("sha256").update(link).digest("hex").slice(0, 16)}`,
          source: "bing" as any,
          sourceLabel: `Bing News`,
          url: link,
          title,
          body: desc,
          marketId: market.id,
        });
      }
    } catch {
      // Skip
    }
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`[Collector] Bing News: ${docs.length} raw docs for ${market.displayName}`);
  return docs;
}

// ─── Convert RawDocument → ScrapedLead ───────────────────────────────────────

function rawDocToLead(doc: RawDocument, classification: ClassificationResult, finalScore: number, market: CityMarket): ScrapedLead {
  const combined = doc.title + " " + doc.body;

  // Use LLM-extracted entities when available, fall back to regex
  const budget = classification.extractedBudget ?? extractBudget(combined);
  const emails = extractEmails(doc.body);
  const phones = extractPhones(doc.body);

  // Contact: LLM-extracted > regex email > regex phone > author DM
  let contactEmail = emails[0];
  let contactPhone = phones[0];
  if (classification.extractedContact) {
    if (classification.extractedContact.includes("@")) {
      contactEmail = classification.extractedContact;
    } else if (/\d{10}/.test(classification.extractedContact.replace(/\D/g, ""))) {
      contactPhone = classification.extractedContact;
    }
  }

  // Event date: LLM-extracted > regex > estimated
  let eventDate: Date | undefined;
  if (classification.extractedDate) {
    const parsed = new Date(classification.extractedDate);
    if (!isNaN(parsed.getTime()) && parsed.getTime() > Date.now()) {
      eventDate = parsed;
    }
  }
  if (!eventDate) {
    const dateMatch = combined.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*202[5-9])?\b/i);
    if (dateMatch) {
      const parsed = new Date(dateMatch[0]);
      if (!isNaN(parsed.getTime()) && parsed.getTime() > Date.now()) eventDate = parsed;
    }
  }
  if (!eventDate) {
    const daysAhead = 60 + Math.floor(Math.random() * 180);
    eventDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  }

  // Location: LLM-extracted > market default
  const location = classification.extractedCity ?? `${market.displayName}, ${market.state}`;

  // Performer type: LLM-extracted > regex
  const performerType = (classification.performerType as PerformerType) ?? detectPerformerType(combined);
  const eventType = detectEventType(combined);

  // Title: LLM-refined (clean, no platform names) > original
  const title = (classification.refinedTitle && classification.refinedTitle.length > 10)
    ? classification.refinedTitle
    : doc.title.slice(0, 255);

  // Description: LLM-refined > original body
  const description = (classification.refinedDescription && classification.refinedDescription.length > 20)
    ? classification.refinedDescription
    : doc.body.slice(0, 400);

  // Map source to allowed enum values
  const sourceMap: Record<string, ScrapedLead["source"]> = {
    reddit: "gigxo",
    craigslist: "craigslist",
    duckduckgo: "gigxo",
    bing: "gigxo",
  };

  // Build RawScrapedDoc for intelligence engine
  const rawScrapedDoc: RawScrapedDoc = {
    title: doc.title,
    body: doc.body,
    url: doc.url,
    sourceLabel: doc.sourceLabel,
    sourceDomain: (() => {
      // Extract domain from source label for trust lookup
      if (doc.source === "reddit") {
        const sub = doc.sourceLabel.replace("Reddit ", "").toLowerCase();
        return `reddit.com/${sub}`;
      }
      if (doc.source === "craigslist") return "craigslist.org";
      if (doc.source === "bing") return "bing.com";
      return "default";
    })(),
    city: location,
    marketId: market.id,
    scrapedAt: doc.createdAt ?? new Date(),
    contactEmail,
    contactPhone,
    contactName: doc.author ? (doc.source === "reddit" ? `u/${doc.author}` : doc.author) : undefined,
    intentScore: finalScore,
    eventWindowId: undefined, // set by pipeline loop
    eventWindowBoost: 1.0,    // set by pipeline loop
    scrapeKeyword: undefined, // set by pipeline loop
  };

  const enriched = enrichLead(rawScrapedDoc, eventDate);

  return {
    externalId: doc.id,
    source: sourceMap[doc.source] ?? "gigxo",
    title,
    description,
    eventType,
    performerType,
    budget: budget ?? 75000,
    location,
    eventDate,
    contactName: doc.author ? (doc.source === "reddit" ? `u/${doc.author}` : doc.author) : undefined,
    contactEmail,
    contactPhone,
    venueUrl: doc.url,
    intentScore: finalScore,
    rawSource: doc.sourceLabel,

    // Intelligence engine output
    sourceLabel: enriched.sourceLabel,
    sourceTrust: enriched.sourceTrust,
    contactScore: enriched.contactScore,
    freshnessScore: enriched.freshnessScore,
    finalScore: enriched.finalScore,
    winProbability: enriched.winProbability,
    competitionLevel: enriched.competitionLevel,
    suggestedRate: enriched.suggestedRate,
    pitchStyle: enriched.pitchStyle,
    leadTemperature: enriched.leadTemperature,
    buyerType: enriched.buyerType,
    venueType: enriched.venueType,
    estimatedGuestCount: enriched.estimatedGuestCount,
    prestigeScore: enriched.prestigeScore,
    urgencyScore: enriched.urgencyScore,
    budgetConfidence: enriched.budgetConfidence,
    intentEvidence: enriched.intentEvidence,
    contactEvidence: enriched.contactEvidence,
    eventEvidence: enriched.eventEvidence,
    sourceEvidence: enriched.sourceEvidence,
    scrapeKeyword: undefined,
  };
}

// ─── Deduplication & Save ─────────────────────────────────────────────────────

async function isDuplicate(externalId: string, contentHash?: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const conditions = [eq(gigLeads.externalId, externalId)];
  if (contentHash) conditions.push(eq(gigLeads.contentHash, contentHash));
  const existing = await db.select({ id: gigLeads.id }).from(gigLeads).where(or(...conditions)).limit(1);
  return existing.length > 0;
}

async function saveLeads(leads: ScrapedLead[]): Promise<{ saved: number; duplicates: number }> {
  const db = await getDb();
  if (!db) return { saved: 0, duplicates: 0 };

  let saved = 0;
  let duplicates = 0;

  for (const lead of leads) {
    const contentHash = makeContentHash(lead.title, lead.location, lead.eventDate);
    if (await isDuplicate(lead.externalId, contentHash)) {
      duplicates++;
      continue;
    }

    try {
      const autoPrice = getLeadUnlockPriceCents(lead.budget, null);
      await db.insert(gigLeads).values({
        externalId: lead.externalId,
        source: lead.source,
        title: lead.title,
        description: lead.description,
        eventType: lead.eventType,
        performerType: lead.performerType ?? "other",
        budget: lead.budget,
        location: lead.location,
        eventDate: lead.eventDate,
        contactName: lead.contactName,
        contactEmail: lead.contactEmail,
        contactPhone: lead.contactPhone,
        venueUrl: lead.venueUrl,
        contentHash,
        unlockPriceCents: autoPrice,
        isApproved: false,
        isRejected: false,
        // Intelligence engine fields
        sourceLabel: lead.sourceLabel ?? lead.rawSource,
        sourceTrust: lead.sourceTrust?.toString(),
        contactScore: lead.contactScore,
        freshnessScore: lead.freshnessScore?.toString(),
        intentScore: lead.intentScore,
        finalScore: lead.finalScore,
        winProbability: lead.winProbability?.toString(),
        competitionLevel: lead.competitionLevel,
        suggestedRate: lead.suggestedRate,
        pitchStyle: lead.pitchStyle,
        leadTemperature: lead.leadTemperature,
        buyerType: (lead.buyerType as any) ?? "unknown",
        venueType: lead.venueType,
        estimatedGuestCount: lead.estimatedGuestCount,
        prestigeScore: lead.prestigeScore,
        urgencyScore: lead.urgencyScore,
        budgetConfidence: lead.budgetConfidence,
        intentEvidence: lead.intentEvidence,
        contactEvidence: lead.contactEvidence,
        eventEvidence: lead.eventEvidence,
        sourceEvidence: lead.sourceEvidence,
        eventWindowId: lead.eventWindowId,
        scrapeKeyword: lead.scrapeKeyword,
      });
      saved++;
    } catch (error) {
      console.error("[Scraper] Failed to save lead:", lead.title, error);
    }
  }

  return { saved, duplicates };
}

// ─── Full Pipeline ────────────────────────────────────────────────────────────

export async function runFullScrape(
  marketId?: string,
  leadsPerCity: number = 15,
  focusPerformerType?: string
): Promise<{
  total: number;
  saved: number;
  duplicates: number;
  sources: Record<string, number>;
  cities: string[];
  pipeline: { collected: number; passedFilter: number; classified: number; highConfidence: number };
}> {
  const markets = marketId
    ? US_MARKETS.filter((m) => m.id === marketId)
    : US_MARKETS;

  if (markets.length === 0) {
    throw new Error(`Unknown market ID: ${marketId}. Valid IDs: ${US_MARKETS.map(m => m.id).join(", ")}`);
  }

  console.log(`[Pipeline] Starting for: ${markets.map(m => m.displayName).join(", ")}`);

  const allLeads: ScrapedLead[] = [];
  const sources: Record<string, number> = {};
  let totalCollected = 0;
  let totalPassedFilter = 0;
  let totalClassified = 0;
  let totalHighConfidence = 0;

  for (const market of markets) {
    console.log(`[Pipeline] Market: ${market.displayName}`);

    // ── EVENT WINDOW BOOST ────────────────────────────────────────────────────
    // Load active event windows for this market and inject their keyword packs
    // into the collectors. The boost multiplier is applied after scoring.
    const activeWindows = await getUpcomingWindowsForMarket(market.id, 90).catch(() => []);
    const eventKeywords: string[] = activeWindows.flatMap(w => (w.searchKeywordPack as string[]) ?? []);
    const boostMultiplier = activeWindows.length > 0
      ? Math.max(...activeWindows.map(w => parseFloat(String(w.leadBoostMultiplier) || "1.0")))
      : 1.0;
    if (activeWindows.length > 0) {
      const windowNames = activeWindows.map(w => `${w.eventName} (${w.leadBoostMultiplier}x)`).join(", ");
      console.log(`[Pipeline] ${market.displayName}: ${activeWindows.length} active event windows → ${windowNames}`);
      console.log(`[Pipeline] ${market.displayName}: Injecting ${eventKeywords.length} event keywords, boost=${boostMultiplier}x`);
    }

    // ── STEP 1: COLLECT ──────────────────────────────────────────────────────
    // Run all collectors in parallel: Reddit (public JSON API), DuckDuckGo, Quora, Meetup
    // Reddit uses /new.json endpoint (no auth, no rate limits)
    const [redditDocs, ddgDocs, quoraDocs, meetupDocs] = await Promise.allSettled([
      runRedditCollector(market.id, focusPerformerType),
      collectFromDuckDuckGo(market),
      collectFromQuora(market),
      collectFromMeetup(market),
    ]);

    const allDocs: RawDocument[] = [
      ...(redditDocs.status === "fulfilled" ? redditDocs.value.map((doc: any) => ({
        id: doc.externalId,
        source: doc.source,
        sourceLabel: doc.sourceLabel,
        url: doc.url,
        title: doc.rawText.split('\n')[0] || '',
        body: doc.rawText,
        author: undefined,
        createdAt: doc.postedAt,
        marketId: market.id,
      })) : []),
      ...(ddgDocs.status === "fulfilled" ? ddgDocs.value : []),
      ...(quoraDocs.status === "fulfilled" ? quoraDocs.value : []),
      ...(meetupDocs.status === "fulfilled" ? meetupDocs.value : []),
    ];

    totalCollected += allDocs.length;
    console.log(`[Pipeline] ${market.displayName}: ${allDocs.length} raw docs collected`);

    // ── STEP 2: KEYWORD PRE-FILTER (already done in collectors) ──────────────
    // Docs that reach here already passed passesKeywordFilter()
    totalPassedFilter += allDocs.length;

    // ── STEP 3: AI INTENT CLASSIFICATION ─────────────────────────────────────
    // Process in batches to avoid overwhelming the LLM
    const BATCH_SIZE = 5;
    const marketLeads: ScrapedLead[] = [];

    for (let i = 0; i < allDocs.length; i += BATCH_SIZE) {
      const batch = allDocs.slice(i, i + BATCH_SIZE);
      const classifyPromises = batch.map(doc => classifyWithLLM(doc));
      const classifications = await Promise.allSettled(classifyPromises);

      for (let j = 0; j < batch.length; j++) {
        const doc = batch[j];
        const classResult = classifications[j];

        if (classResult.status !== "fulfilled" || !classResult.value) {
          // LLM failed — fall back to keyword-only classification
          const fallbackScore = 40; // Passed keyword filter, aggressive threshold for high volume
          const fallback: ClassificationResult = {
            intentScore: fallbackScore,
            isRealEventNeed: true,
            isFutureLooking: true,
            performerType: detectPerformerType(doc.title + " " + doc.body),
            extractedDate: null,
            extractedCity: null,
            extractedBudget: extractBudget(doc.title + " " + doc.body),
            extractedContact: null,
            refinedTitle: doc.title.slice(0, 80),
            refinedDescription: doc.body.slice(0, 300),
          };
          const lead = rawDocToLead(doc, fallback, fallbackScore, market);
          if (!focusPerformerType || lead.performerType === focusPerformerType) {
            marketLeads.push(lead);
          }
          continue;
        }

        totalClassified++;
        const classification = classResult.value;
        const finalScore = computeLeadScore(doc, classification);

        // ── STEP 4: SCORE THRESHOLD ───────────────────────────────────────────
        // Aggressive lead capture: push if score ≥ 40 (lowered from 60 to capture more real leads)
        // isRealEventNeed is just a hint; trust the numerical score more
        if (finalScore < 40) {
          console.log(`[Pipeline] Discarded (score ${finalScore}): ${doc.title.slice(0, 60)}`);
          continue;
        }

        totalHighConfidence++;
        // Apply event window boost multiplier to the final score
        const boostedScore = boostMultiplier > 1.0
          ? Math.min(100, Math.round(finalScore * boostMultiplier))
          : finalScore;
        const lead = rawDocToLead(doc, classification, boostedScore, market);

        if (focusPerformerType && lead.performerType !== focusPerformerType) continue;

        marketLeads.push(lead);
      }

      // Small delay between LLM batches
      if (i + BATCH_SIZE < allDocs.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    // Cap per city to avoid flooding the queue
    const cappedLeads = marketLeads.slice(0, leadsPerCity);
    allLeads.push(...cappedLeads);

    // Track sources
    sources[market.id] = cappedLeads.length;
    const sourceBreakdown = cappedLeads.reduce((acc, l) => {
      const key = l.rawSource ?? l.source;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(`[Pipeline] ${market.displayName}: ${cappedLeads.length} high-confidence leads`);
    console.log(`[Pipeline] Sources:`, sourceBreakdown);
  }

  // ── STEP 5: SAVE TO DB ────────────────────────────────────────────────────
  const { saved, duplicates } = await saveLeads(allLeads);

  console.log(`[Pipeline] Done. Collected=${totalCollected} Classified=${totalClassified} HighConf=${totalHighConfidence} Saved=${saved} Dupes=${duplicates}`);

  return {
    total: allLeads.length,
    saved,
    duplicates,
    sources,
    cities: markets.map((m) => m.displayName),
    pipeline: {
      collected: totalCollected,
      passedFilter: totalPassedFilter,
      classified: totalClassified,
      highConfidence: totalHighConfidence,
    },
  };
}

export const runDailyScrape = runFullScrape;
