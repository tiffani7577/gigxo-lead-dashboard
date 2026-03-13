/**
 * Reddit Collector — Optimized for high-intent entertainment hire subreddits
 * Covers: weddings, events, music, photography, videography, DJing, entertainment
 * Reduced from 200+ to ~30 high-value subreddits to respect rate limits
 */

import type { RawDocument } from "../scraper";

// Keyword filters (same as in scraper.ts)
const SEEKING_KEYWORDS = [
  "looking for", "need a", "need dj", "need band", "need musician",
  "hire a", "hire dj", "hire band", "recommendations for", "recommend a",
  "anyone know a", "can anyone recommend", "seeking a", "in search of",
  "want to hire", "want to book", "trying to find", "help finding",
  "suggestions for", "who should i hire", "who do i hire", "can you recommend",
  "does anyone know", "any recommendations", "any suggestions",
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

// High-value subreddits only (reduced from 200+ to ~30 to avoid rate limiting)
const GLOBAL_SUBREDDITS = [
  // Wedding planning (primary - highest buyer intent)
  "weddingplanning",
  "wedding",
  "JustEngaged",
  "bachelorette",
  
  // Event planning
  "eventplanning",
  "events",
  
  // Entertainment hire (direct)
  "HireAMusician",
  "forhire",
  "gigs",
  
  // Photography/Videography (high intent)
  "weddingphotography",
  "photography",
  "videography",
  "eventphotography",
  
  // Entertainment/Performance
  "DJing",
  "musicians",
  "Bands",
  "theater",
  "performance",
];

const CITY_SUBREDDITS: Record<string, string[]> = {
  miami: [
    "Miami",
    "FortLauderdale",
    "MiamiWeddings",
    "MiamiEvents",
    "MiamiDJs",
    "MiamiPhotography",
  ],
  nyc: [
    "nyc",
    "NewYork",
    "NewYorkWeddings",
    "NewYorkEvents",
    "NYCDJs",
    "NYCPhotography",
  ],
  la: [
    "losangeles",
    "LosAngeles",
    "LAWeddings",
    "LAEvents",
    "LADJs",
    "LAPhotography",
  ],
  chicago: [
    "chicago",
    "Chicago",
    "ChicagoWeddings",
    "ChicagoEvents",
    "ChicagoDJs",
    "ChicagoPhotography",
  ],
  houston: [
    "houston",
    "Houston",
    "HoustonWeddings",
    "HoustonEvents",
    "HoustonDJs",
    "HoustonPhotography",
  ],
  dallas: [
    "Dallas",
    "DallasWeddings",
    "DallasEvents",
    "DallasDJs",
    "DallasPhotography",
  ],
  atlanta: [
    "Atlanta",
    "AtlantaWeddings",
    "AtlantaEvents",
    "AtlantaDJs",
    "AtlantaPhotography",
  ],
  vegas: [
    "vegas",
    "Vegas",
    "LasVegas",
    "VegasWeddings",
    "VegasEvents",
    "VegasDJs",
  ],
  nashville: [
    "Nashville",
    "NashvilleWeddings",
    "NashvilleEvents",
    "NashvilleDJs",
    "NashvilleMusic",
  ],
  orlando: [
    "Orlando",
    "OrlandoWeddings",
    "OrlandoEvents",
    "OrlandoDJs",
    "OrlandoPhotography",
  ],
  phoenix: [
    "Phoenix",
    "PhoenixWeddings",
    "PhoenixEvents",
    "PhoenixDJs",
    "PhoenixPhotography",
  ],
  dc: [
    "washingtondc",
    "DC",
    "DCWeddings",
    "DCEvents",
    "DCNightlife",
    "DCMusic",
    "DCDJs",
  ],
};

export async function collectFromRedditExpanded(market: { id: string; displayName: string }): Promise<RawDocument[]> {
  const subreddits = [...GLOBAL_SUBREDDITS, ...(CITY_SUBREDDITS[market.id] || [])];
  const allDocs: RawDocument[] = [];

  // Fetch latest posts from each subreddit (Reddit search is unreliable, so we fetch /new.json and filter client-side)
  const queries = subreddits.map(sub => ({
    url: `https://www.reddit.com/r/${sub}/new.json?limit=100`,
    sub,
  }));

  // Fetch in parallel with rate limiting (Reddit is strict about rate limiting)
  for (const query of queries) {
    try {
      const response = await fetch(query.url, {
        headers: {
          "User-Agent": "Gigxo/1.0 (Lead scraper for entertainment gigs; contact: support@gigxo.com)",
          "Accept": "application/json",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      if (!response.ok) {
        console.log(`[Collector] Reddit r/${query.sub}: HTTP ${response.status}`);
        continue;
      }

      const data = (await response.json()) as any;
      const posts = data.data?.children || [];
      let passedFilter = 0;

      for (const post of posts) {
        const p = post.data;
        if (!p.title) continue;  // Accept posts with title; body can be empty

        // Apply keyword filter to reduce noise (looking for + entertainment)
        if (!passesKeywordFilter(p.title, p.selftext || "")) continue;
        passedFilter++;

        allDocs.push({
          id: `reddit-${p.id}`,
          title: p.title,
          body: p.selftext || "",
          url: `https://reddit.com${p.permalink}`,
          source: "reddit",
          sourceLabel: `Reddit r/${query.sub}`,
            createdAt: new Date(p.created_utc * 1000),
            author: p.author,
            marketId: market.id,
        });
      }
      console.log(`[Collector] Reddit r/${query.sub}: ${posts.length} raw posts, ${passedFilter} passed filter`);
    } catch (e) {
      console.error(`[Collector] Reddit r/${query.sub} error:`, e);
    }

    // Rate limit: 2 seconds between requests (Reddit is strict)
    await new Promise(r => setTimeout(r, 2000));
  }

  return allDocs;
}
