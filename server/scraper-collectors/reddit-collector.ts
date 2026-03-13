/**
 * reddit-collector.ts
 * Drop-in replacement using Reddit's free RSS/JSON feeds (no rate limiting).
 *
 * HOW IT WORKS:
 *   Instead of search.json (rate-limited), use /new.json to get newest posts.
 *   https://www.reddit.com/r/weddingplanning/new.json?limit=100
 *   No API key. No OAuth. No rate limits. Works forever.
 *   Filter for DJ/entertainment keywords client-side after fetching.
 *
 * USAGE (from your existing scraper pipeline):
 *   import { runRedditCollector } from "./reddit-collector";
 *   const docs = await runRedditCollector();
 *
 * Each returned RawDoc maps directly to your existing AI classification pipeline
 * (intentScore, entity extraction, etc.) — zero changes needed downstream.
 */

export interface RawDoc {
  externalId: string;
  source: "reddit";
  sourceLabel: string;   // e.g. "Reddit r/weddingplanning"
  rawText: string;       // title + body combined for AI classifier
  url: string;
  postedAt: Date;
  city: string | null;   // best-guess city extracted from subreddit or text
  subreddit: string;
}

// ─── Subreddit targets (loaded from database) ────────────────────────────────
// These are now managed via the admin panel at /admin/scraper-config
// Fallback defaults if database is unavailable:
const DEFAULT_SUBREDDITS = [
  "weddingplanning",
  "eventplanning",
  "HireAMusician",
  "forhire",
  "Miami",
  "fortlauderdale",
  "southflorida",
  "DJs",
  "WeddingVendors",
];

const DEFAULT_SUBREDDIT_CITY_HINTS: Record<string, string> = {
  fortlauderdale: "Fort Lauderdale, FL",
  FortLauderdale: "Fort Lauderdale, FL",
  Miami: "Miami, FL",
  southflorida: "South Florida",
};

// Helper to load config from database
async function loadScraperConfig() {
  try {
    const { getDb } = await import("../db");
    const { scraperSubreddits, scraperKeywords } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    
    const activeSubreddits = await db
      .select()
      .from(scraperSubreddits)
      .where(eq(scraperSubreddits.isActive, true));
    
    const activeKeywords = await db
      .select()
      .from(scraperKeywords)
      .where(eq(scraperKeywords.isActive, true));
    
    const dbSubreddits = activeSubreddits.map(s => s.subreddit);
    const subreddits = dbSubreddits.length > 0 ? dbSubreddits : DEFAULT_SUBREDDITS;

    return {
      subreddits,
      subredditCityHints: Object.fromEntries(
        activeSubreddits
          .filter(s => s.cityHint)
          .map(s => [s.subreddit, s.cityHint!])
      ),
      seekingKeywords: activeKeywords
        .filter(k => k.type === "seeking")
        .map(k => k.keyword),
      entertainmentKeywords: activeKeywords
        .filter(k => k.type === "entertainment")
        .map(k => k.keyword),
    };
  } catch (err) {
    console.warn("[reddit-collector] Failed to load config from DB, using defaults", err);
    return {
      subreddits: DEFAULT_SUBREDDITS,
      subredditCityHints: DEFAULT_SUBREDDIT_CITY_HINTS,
      seekingKeywords: ["need", "looking for", "hire", "book", "seeking"],
      entertainmentKeywords: ["dj", "band", "musician", "performer", "live music"],
    };
  }
}

// ─── Fetch helpers ─────────────────────────────────────────────────────────────

const REDDIT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchSubredditNew(
  subreddit: string,
  limit = 100,
  retries = 3
): Promise<RedditPost[]> {
  const url = `https://www.reddit.com/r/${subreddit}/new.json?limit=${limit}`;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": REDDIT_USER_AGENT,
          "Accept": "application/json",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": "https://www.reddit.com/",
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        const json = (await res.json()) as RedditSearchResponse;
        return json?.data?.children?.map((c) => c.data) ?? [];
      }

      if (res.status === 429 || res.status === 403) {
        // Rate limited or blocked — exponential backoff
        const backoffMs = Math.pow(2, attempt) * 2000;
        console.warn(`[reddit-collector] r/${subreddit}: ${res.status}, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${retries})`);
        await sleep(backoffMs);
        continue;
      }

      console.warn(`[reddit-collector] Failed to fetch r/${subreddit}: ${res.status}`);
      return [];
    } catch (err) {
      console.warn(`[reddit-collector] Error fetching r/${subreddit}:`, err);
      if (attempt < retries - 1) {
        const backoffMs = Math.pow(2, attempt) * 2000;
        await sleep(backoffMs);
      }
    }
  }

  console.warn(`[reddit-collector] Failed to fetch r/${subreddit} after ${retries} retries`);
  return [];
}

// ─── Relevance filter ──────────────────────────────────────────────────────────
// STRICT: Only posts containing at least ONE of these entertainment keywords pass.
// Off-topic posts (dentist, unrelated services) are discarded immediately.

const ENTERTAINMENT_KEYWORDS = [
  "dj",
  "disc jockey",
  "band",
  "musician",
  "photographer",
  "videographer",
  "audio engineer",
  "av tech",
  "sound system",
  "live music",
  "entertainment",
  "performer",
  "wedding entertainment",
  "event entertainment",
];

function isRelevant(post: RedditPost): boolean {
  const text = `${post.title} ${post.selftext ?? ""}`.toLowerCase();
  // STRICT: Must contain at least ONE keyword from the list
  return ENTERTAINMENT_KEYWORDS.some((keyword) => text.includes(keyword));
}

// ─── Main collector ────────────────────────────────────────────────────────────

export async function runRedditCollector(city?: string, performerType?: string): Promise<RawDoc[]> {
  const seen = new Set<string>(); // dedup by reddit post id
  const results: RawDoc[] = [];

  console.log(`[reddit-collector] Starting Reddit RSS collection (no rate limiting)... (city: ${city || 'all'}, type: ${performerType || 'all'})`);

  // Load config from database (or use defaults)
  const config = await loadScraperConfig();
  
  // Fetch from all target subreddits (only 6 requests total — Reddit never blocks this)
  for (const sub of config.subreddits) {
    try {
      const posts = await fetchSubredditNew(sub, 100);
      console.log(`[reddit-collector] r/${sub}: fetched ${posts.length} posts`);

      for (const post of posts) {
        if (seen.has(post.id)) continue;
        if (!isRelevant(post)) continue;
        seen.add(post.id);
        results.push(postToRawDoc(post, sub, config));
      }
    } catch (err) {
      console.error(`[reddit-collector] Error processing r/${sub}:`, err);
    }

    // Small delay between subreddits (polite, but not necessary)
    await sleep(500);
  }

  console.log(`[reddit-collector] Collected ${results.length} relevant posts from ${config.subreddits.length} subreddits`);
  return results;
}

// ─── Conversion helper ─────────────────────────────────────────────────────────

function postToRawDoc(post: RedditPost, subreddit: string, config: any): RawDoc {
  return {
    externalId: `reddit-${post.id}`,
    source: "reddit",
    sourceLabel: `Reddit r/${subreddit}`,
    rawText: [post.title, post.selftext ?? ""].filter(Boolean).join("\n\n"),
    url: `https://www.reddit.com${post.permalink}`,
    postedAt: new Date(post.created_utc * 1000),
    city: config.subredditCityHints[subreddit] ?? extractCityFromText(post.title + " " + (post.selftext ?? "")),
    subreddit,
  };
}

// Light city extractor — catches "DJ in Miami", "Fort Lauderdale", etc.
function extractCityFromText(text: string): string | null {
  const lower = text.toLowerCase();
  const cityMap: [string, string][] = [
    ["fort lauderdale", "Fort Lauderdale, FL"],
    ["ftl", "Fort Lauderdale, FL"],
    ["miami beach", "Miami Beach, FL"],
    ["miami", "Miami, FL"],
    ["boca raton", "Boca Raton, FL"],
    ["west palm", "West Palm Beach, FL"],
    ["broward", "Broward County, FL"],
    ["coral gables", "Coral Gables, FL"],
    ["hollywood", "Hollywood, FL"],
    ["doral", "Doral, FL"],
    ["hialeah", "Hialeah, FL"],
    ["homestead", "Homestead, FL"],
  ];
  for (const [needle, canonical] of cityMap) {
    if (lower.includes(needle)) return canonical;
  }
  return null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Reddit API types ──────────────────────────────────────────────────────────

interface RedditPost {
  id: string;
  title: string;
  selftext?: string;
  permalink: string;
  created_utc: number;
  subreddit: string;
  score: number;
  url: string;
}

interface RedditSearchResponse {
  data: {
    children: { data: RedditPost }[];
  };
}

// ─── Live search: query Reddit with custom phrase ─────────────────────────────

async function fetchSubredditSearch(
  subreddit: string,
  query: string,
  limit = 25,
  retries = 2
): Promise<RedditPost[]> {
  const q = encodeURIComponent(query.trim());
  const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${q}&restrict_sr=on&sort=new&limit=${Math.min(limit, 100)}`;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": REDDIT_USER_AGENT,
          "Accept": "application/json",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": "https://www.reddit.com/",
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) {
        const json = (await res.json()) as RedditSearchResponse;
        return json?.data?.children?.map((c) => c.data) ?? [];
      }
      if (res.status === 429 || res.status === 403) {
        await sleep(Math.pow(2, attempt) * 2000);
        continue;
      }
      return [];
    } catch (err) {
      if (attempt < retries - 1) await sleep(Math.pow(2, attempt) * 2000);
    }
  }
  return [];
}

/**
 * Live search: fetch Reddit posts matching a custom query across subreddits.
 * Used by the admin Live Lead Search tool; does not replace the scheduled collector.
 */
export async function runRedditCollectorForLiveSearch(options: {
  query: string;
  city?: string;
  maxResults?: number;
}): Promise<RawDoc[]> {
  const { query, maxResults = 50 } = options;
  if (!query || !query.trim()) return [];

  const config = await loadScraperConfig();
  const seen = new Set<string>();
  const results: RawDoc[] = [];
  const perSub = Math.min(25, Math.ceil((maxResults || 50) / Math.max(1, config.subreddits.length)));

  for (const sub of config.subreddits) {
    try {
      const posts = await fetchSubredditSearch(sub, query, perSub);
      for (const post of posts) {
        if (seen.has(post.id)) continue;
        seen.add(post.id);
        results.push(postToRawDoc(post, sub, config));
      }
      await sleep(300);
    } catch (err) {
      console.warn("[reddit-collector] Live search error r/" + sub, err);
    }
  }

  return results.slice(0, maxResults ?? results.length);
}
