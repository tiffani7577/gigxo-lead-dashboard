/**
 * Apify collector — runs Apify actors (Reddit, Google Maps) and direct Craigslist RSS; normalizes to RawLeadDoc.
 */

import { ApifyClient } from "apify-client";
import type { RawLeadDoc } from "./raw-lead-doc";

const REDDIT_SEARCHES = [
  "need a dj miami",
  "looking for dj fort lauderdale",
  "hire dj wedding florida",
  "dj for party miami",
  "need entertainment fort lauderdale",
  "wedding dj miami",
];

const REDDIT_INTENT_PHRASES = [
  "need a dj",
  "need dj",
  "looking for a dj",
  "looking for dj",
  "hire a dj",
  "hire dj",
  "book a dj",
  "book dj",
  "dj for my",
  "dj for the",
  "dj for a",
  "dj for our",
  "want a dj",
  "want dj",
  "recommend a dj",
  "recommend dj",
  "dj recommendations",
  "dj needed",
  "dj available",
  "need entertainment",
  "looking for entertainment",
  "need a band",
  "looking for a band",
  "hire a band",
  "need a singer",
  "need live music",
  "looking for live music",
  "need a performer",
  "wedding entertainment",
  "party entertainment",
  "event entertainment",
  "corporate entertainment",
];

const REDDIT_JUNK_PHRASES = [
  "nfl",
  "nba",
  "mlb",
  "nhl",
  "nascar",
  "draft pick",
  "head coach",
  "hires coach",
  "net worth",
  "celebrity",
  "stock market",
  "crypto",
  "bitcoin",
  "lawsuit",
  "arrested",
  "obituary",
  "election",
  "breaking news",
  "espn",
  "sports illustrated",
];

const CRAIGSLIST_RSS_URLS = [
  { url: "https://miami.craigslist.org/search/ggg?format=rss", city: "Miami, FL" },
  { url: "https://fortlauderdale.craigslist.org/search/ggg?format=rss", city: "Fort Lauderdale, FL" },
];

const CRAIGSLIST_FILTER_KEYWORDS = ["dj", "band", "musician", "entertainment", "performer"];

const GOOGLE_MAPS_SEARCHES = [
  "event venues miami fl",
  "wedding venues fort lauderdale",
  "nightclubs miami",
  "bars with live music fort lauderdale",
  "yacht charters miami",
];

// Facebook Groups: apify/facebook-groups-scraper — startUrls are group URLs (replace with real group URLs if needed)
const FACEBOOK_GROUP_URLS = [
  "https://www.facebook.com/groups/miamiweddingplanning",
  "https://www.facebook.com/groups/fortlauderdaleevents",
  "https://www.facebook.com/groups/southfloridaweddings",
  "https://www.facebook.com/groups/miamipartyplanning",
  "https://www.facebook.com/groups/fortlauderdaleweddingvendors",
];

const FACEBOOK_POST_KEYWORDS = ["dj", "entertainment", "performer", "band", "musician"];

// Twitter/X: apify/twitter-scraper — search queries
const TWITTER_SEARCH_QUERIES = [
  "need dj miami",
  "looking for dj fort lauderdale",
  "hire dj florida",
  "wedding dj miami",
];

// LinkedIn: apify/linkedin-scraper — people search (event planners / wedding coordinators in South Florida)
const LINKEDIN_SEARCH_QUERIES = [
  "event planner South Florida",
  "wedding coordinator South Florida",
];

// Google SERP: apify/google-search-scraper — publicly indexed social posts about DJ hiring (no login, no ToS violation)
const GOOGLE_SERP_QUERIES = [
  'site:facebook.com "need a dj" "miami"',
  'site:facebook.com "looking for dj" "fort lauderdale"',
  'site:facebook.com "wedding dj" "south florida"',
  'site:facebook.com "need entertainment" "miami"',
  'site:facebook.com "hire a dj" "florida"',
  'site:reddit.com "need a dj" "miami"',
  'site:reddit.com "looking for dj" "fort lauderdale"',
  'site:nextdoor.com "dj" "fort lauderdale"',
  'site:groups.google.com "need dj" "miami"',
  '"need a dj" "miami" -site:gigsalad.com -site:thumbtack.com',
  '"looking for dj" "fort lauderdale" -site:gigsalad.com',
  '"wedding dj" "miami" "recommendations"',
  '"hire dj" "south florida" 2025',
];

function inferLeadCategory(text: string): "wedding" | "corporate" | "private_party" | "general" {
  const lower = (text ?? "").toLowerCase();
  if (lower.match(/wedding|bride|groom|reception|bridal/)) return "wedding";
  if (lower.match(/corporate|company|business|gala|office/)) return "corporate";
  if (lower.match(/party|birthday|private|bachelor/)) return "private_party";
  return "general";
}

const FRESHNESS_DAYS = 30;

function safeDate(val: unknown): Date {
  if (val instanceof Date) return val;
  if (typeof val === "number") return new Date(val);
  if (typeof val === "string") return new Date(val);
  return new Date();
}

/** Freshness filter: REJECT if postedAt exists and is older than 30 days; KEEP if null/missing or within 30 days. */
function passesFreshnessFilter(postedAt: Date | null | undefined): boolean {
  if (postedAt == null) return true;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - FRESHNESS_DAYS);
  return postedAt >= cutoff;
}

/** Shared intent filter: combined text must have at least one intent phrase and no junk phrase (used by Reddit and Google SERP). */
function passesIntentFilter(combinedText: string): boolean {
  const combined = (combinedText ?? "").toLowerCase();
  const hasIntent = REDDIT_INTENT_PHRASES.some((phrase) => combined.includes(phrase.toLowerCase()));
  const hasJunk = REDDIT_JUNK_PHRASES.some((phrase) => combined.includes(phrase.toLowerCase()));
  return hasIntent && !hasJunk;
}

/** Pre-filter: Reddit item must pass intent filter on title + body */
function redditItemPassesFilter(item: Record<string, unknown>): boolean {
  const title = String(item.title ?? item.name ?? "");
  const body = String(item.body ?? item.selftext ?? item.text ?? item.description ?? "");
  return passesIntentFilter(`${title} ${body}`);
}

/** Reddit actor: apify/reddit-scraper. Dataset items often have: id, title, body, url, createdAt, subreddit, author */
function normalizeRedditItem(item: Record<string, unknown>, index: number): RawLeadDoc {
  const id = (item.id ?? item.link ?? `reddit-${index}`) as string;
  const title = String(item.title ?? item.name ?? "").slice(0, 255) || "Reddit post";
  const body = String(item.body ?? item.selftext ?? item.text ?? item.description ?? "");
  const rawText = `${title}\n\n${body}`.trim();
  const url = String(item.url ?? item.permalink ?? item.link ?? "").trim() || `https://www.reddit.com`;
  const postedAt = safeDate(item.createdAt ?? item.created_utc ?? item.created ?? Date.now());
  const city = (item.subreddit ?? "").toString().toLowerCase().includes("miami")
    ? "Miami, FL"
    : (item.subreddit ?? "").toString().toLowerCase().includes("fortlauderdale") || (item.subreddit ?? "").toString().toLowerCase().includes("florida")
      ? "Fort Lauderdale, FL"
      : "South Florida";

  return {
    externalId: `apify-reddit-${id}`,
    source: "reddit",
    sourceType: "reddit",
    sourceLabel: "Apify Reddit",
    title,
    rawText,
    url,
    postedAt,
    city,
    contact: undefined,
    metadata: {
      subreddit: item.subreddit,
      author: item.author,
      leadType: "scraped_signal",
      leadCategory: inferLeadCategory(rawText),
    },
  };
}

/** Craigslist RSS item → RawLeadDoc (from direct RSS fetch) */
function normalizeCraigslistRssItem(
  title: string,
  link: string,
  description: string,
  pubDate: string,
  city: string,
  index: number
): RawLeadDoc {
  const slug = link.replace(/[^a-z0-9]/gi, "_").slice(0, 80) || `cl-${index}`;
  const rawText = `${title}\n\n${description}`.trim();
  return {
    externalId: `craigslist-rss-${slug}`,
    source: "craigslist",
    sourceType: "craigslist",
    sourceLabel: "Craigslist RSS",
    title: title.slice(0, 255) || "Craigslist listing",
    rawText,
    url: link || "https://miami.craigslist.org",
    postedAt: safeDate(pubDate),
    city,
    contact: undefined,
    metadata: {
      leadType: "scraped_signal",
      leadCategory: inferLeadCategory(rawText),
    },
  };
}

function stripHtmlOrCdata(s: string): string {
  const t = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1").trim();
  return t.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Parse RSS XML and return items with title, link, description, pubDate */
function parseRssItems(xml: string): Array<{ title: string; link: string; description: string; pubDate: string }> {
  const items: Array<{ title: string; link: string; description: string; pubDate: string }> = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];
    const title = stripHtmlOrCdata((block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim());
    const link = (block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? "").trim();
    const description = stripHtmlOrCdata((block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? "").trim());
    const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] ?? "").trim();
    if (title || link) items.push({ title, link, description, pubDate });
  }
  return items;
}

function matchesCraigslistFilter(text: string): boolean {
  const lower = text.toLowerCase();
  return CRAIGSLIST_FILTER_KEYWORDS.some((kw) => lower.includes(kw));
}

/** Fetch Craigslist RSS feeds and return RawLeadDoc[] filtered by keywords */
async function collectCraigslistRss(): Promise<RawLeadDoc[]> {
  const docs: RawLeadDoc[] = [];
  for (const { url, city } of CRAIGSLIST_RSS_URLS) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "GigxoScraper/1.0 (+https://gigxo.com)" },
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const items = parseRssItems(xml);
      let idx = 0;
      for (const it of items) {
        const combined = `${it.title} ${it.description}`;
        if (!matchesCraigslistFilter(combined)) continue;
        docs.push(normalizeCraigslistRssItem(it.title, it.link, it.description, it.pubDate, city, idx++));
      }
    } catch (err) {
      console.warn("[apify-collector] Craigslist RSS failed", url, err);
    }
  }
  return docs;
}

/** Facebook Groups actor: apify/facebook-groups-scraper. Items have: url, text, time, user, id, legacyId */
function normalizeFacebookGroupPost(item: Record<string, unknown>, index: number): RawLeadDoc {
  const id = (item.id ?? item.legacyId ?? item.feedbackId ?? `fb-${index}`) as string;
  const title = String(item.text ?? "").slice(0, 255) || "Facebook group post";
  const body = String(item.text ?? "").trim();
  const rawText = body || title;
  const url = String(item.url ?? item.facebookUrl ?? "").trim() || "https://www.facebook.com";
  const postedAt = safeDate(item.time ?? item.createdAt ?? Date.now());
  const city = "South Florida";

  return {
    externalId: `apify-fb-${String(id).replace(/[^a-z0-9_-]/gi, "_").slice(0, 80)}`,
    source: "facebook",
    sourceType: "other",
    sourceLabel: "Apify Facebook Groups",
    title,
    rawText,
    url,
    postedAt,
    city,
    contact: undefined,
    metadata: {
      leadType: "scraped_signal",
      leadCategory: inferLeadCategory(rawText),
      user: item.user,
      likesCount: item.likesCount,
      commentsCount: item.commentsCount,
    },
  };
}

function matchesFacebookKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return FACEBOOK_POST_KEYWORDS.some((kw) => lower.includes(kw));
}

/** Twitter/X actor: apify/twitter-scraper. Items often have: full_text, text, created_at, user, id, url */
function normalizeTwitterItem(item: Record<string, unknown>, index: number): RawLeadDoc {
  const id = (item.id ?? item.id_str ?? `twitter-${index}`) as string;
  const text = String(item.full_text ?? item.text ?? "").trim();
  const title = text.slice(0, 255) || "Tweet";
  const rawText = text;
  const url = String(item.url ?? item.tweetUrl ?? `https://x.com/i/status/${id}`).trim();
  const postedAt = safeDate(item.created_at ?? item.createdAt ?? Date.now());
  const city = "South Florida";

  return {
    externalId: `apify-twitter-${String(id).replace(/[^a-z0-9_-]/gi, "_").slice(0, 80)}`,
    source: "twitter",
    sourceType: "other",
    sourceLabel: "Apify Twitter",
    title,
    rawText,
    url,
    postedAt,
    city,
    contact: undefined,
    metadata: {
      leadType: "scraped_signal",
      leadCategory: inferLeadCategory(rawText),
      user: item.user,
      screen_name: (item.user as Record<string, unknown>)?.screen_name,
    },
  };
}

/** LinkedIn actor: apify/linkedin-scraper or people-search. Profile/contact lead for venue_intelligence */
function normalizeLinkedInItem(item: Record<string, unknown>, index: number): RawLeadDoc {
  const id = (item.publicIdentifier ?? item.urn ?? item.linkedinUrl ?? `li-${index}`) as string;
  const slug = String(id).replace(/[^a-z0-9_-]/gi, "_").slice(0, 80);
  const fullName = String(item.fullName ?? `${item.firstName ?? ""} ${item.lastName ?? ""}`).trim() || "LinkedIn profile";
  const headline = String(item.headline ?? "").trim();
  const rawText = [fullName, headline, String(item.summary ?? "")].filter(Boolean).join("\n\n");
  const url = String(item.linkedinUrl ?? item.linkedinPublicUrl ?? item.url ?? "").trim() || "https://www.linkedin.com";
  const city = String(item.location ?? item.jobLocation ?? "South Florida").trim() || "South Florida";

  return {
    externalId: `apify-linkedin-${slug}`,
    source: "gigxo",
    sourceType: "other",
    sourceLabel: "Apify LinkedIn",
    title: fullName.slice(0, 255),
    rawText,
    url,
    postedAt: new Date(),
    city,
    contact: undefined,
    metadata: {
      leadType: "venue_intelligence",
      leadCategory: "venue_intelligence",
      headline,
      linkedinUrl: url,
    },
  };
}

/** Google SERP organic result: same intent filter as Reddit (title + description). */
function serpResultPassesFilter(organicResult: Record<string, unknown>): boolean {
  const title = String(organicResult.title ?? "");
  const description = String(organicResult.description ?? organicResult.snippet ?? "");
  return passesIntentFilter(`${title} ${description}`);
}

/** Google Search Scraper organic result → RawLeadDoc (source reddit, sourceLabel Google Search, scraped_signal) */
function normalizeGoogleSerpItem(organicResult: Record<string, unknown>, index: number): RawLeadDoc {
  const url = String(organicResult.url ?? organicResult.link ?? "").trim();
  const slug = url ? url.replace(/[^a-z0-9]/gi, "_").slice(0, 80) : `serp-${index}`;
  const title = String(organicResult.title ?? "").slice(0, 255) || "Google result";
  const description = String(organicResult.description ?? organicResult.snippet ?? "").trim();
  const rawText = `${title}\n\n${description}`.trim();
  const city = rawText.toLowerCase().includes("fort lauderdale")
    ? "Fort Lauderdale, FL"
    : rawText.toLowerCase().includes("miami")
      ? "Miami, FL"
      : "South Florida";

  return {
    externalId: `apify-serp-${slug}`,
    source: "reddit",
    sourceType: "reddit",
    sourceLabel: "Google Search",
    title,
    rawText,
    url: url || "https://www.google.com",
    postedAt: new Date(),
    city,
    contact: undefined,
    metadata: {
      leadType: "scraped_signal",
      leadCategory: inferLeadCategory(rawText),
      displayedUrl: organicResult.displayedUrl,
      position: organicResult.position,
    },
  };
}

/** Google Maps actor: compass/google-maps-scraper. Items often have: title, url, address, website */
function normalizeGoogleMapsItem(item: Record<string, unknown>, index: number): RawLeadDoc {
  const id = (item.placeId ?? item.title ?? item.url ?? `gmaps-${index}`) as string;
  const slug = typeof id === "string" ? id.replace(/[^a-z0-9]/gi, "_").slice(0, 80) : `gmaps-${index}`;
  const title = String(item.title ?? item.name ?? "").slice(0, 255) || "Venue";
  const address = String(item.address ?? item.fullAddress ?? item.formattedAddress ?? "").trim();
  const body = [address, String(item.category ?? ""), String(item.description ?? "")].filter(Boolean).join("\n");
  const rawText = `${title}\n\n${body}`.trim();
  const url = String(item.url ?? item.website ?? item.link ?? item.googleMapsUri ?? "").trim() || "https://www.google.com/maps";
  const city = address || "South Florida";

  return {
    externalId: `apify-gmaps-${slug}`,
    source: "gigxo",
    sourceType: "other",
    sourceLabel: "Apify Google Maps",
    title,
    rawText,
    url,
    postedAt: new Date(),
    city: city || null,
    contact: undefined,
    metadata: {
      leadType: "venue_intelligence",
      leadCategory: "venue_intelligence",
      address,
      venueUrl: url,
    },
  };
}

export async function collectFromApify(): Promise<RawLeadDoc[]> {
  console.log("[apify-collector] collectFromApify() called");
  const token = process.env.APIFY_API_TOKEN?.trim();
  if (!token) {
    console.warn("[apify-collector] APIFY_API_TOKEN is not set; skipping Apify.");
    return [];
  }

  const client = new ApifyClient({ token });
  const docs: RawLeadDoc[] = [];

  // 1) Reddit Search — spry_wholemeal/reddit-scraper (free, no rental). search must be object (e.g. { queries: [] })
  try {
    const redditInput = {
      search: { queries: REDDIT_SEARCHES },
      mode: "search",
    };
    const run = await client.actor("spry_wholemeal/reddit-scraper").call(redditInput as any);
    const redditItems = await client.dataset(run.defaultDatasetId).listItems();
    const collected = redditItems.items.length;
    let intentPassed = 0;
    let freshnessPassed = 0;
    for (let i = 0; i < redditItems.items.length; i++) {
      const item = redditItems.items[i] as Record<string, unknown>;
      if (!redditItemPassesFilter(item)) continue;
      intentPassed++;
      const doc = normalizeRedditItem(item, freshnessPassed);
      if (!passesFreshnessFilter(doc.postedAt)) continue;
      freshnessPassed++;
      docs.push(doc);
    }
    console.log("[apify-collector] Reddit:", collected, "collected,", intentPassed, "passed intent filter,", freshnessPassed, "passed freshness filter");
  } catch (err) {
    console.warn("[apify-collector] Reddit actor failed:", err);
  }

  // 2) Google SERP — apify/google-search-scraper (publicly indexed social posts, same intent filter as Reddit)
  try {
    const serpInput = {
      queries: GOOGLE_SERP_QUERIES.join("\n"),
      maxPagesPerQuery: 2,
      resultsPerPage: 10,
    };
    const run = await client.actor("apify/google-search-scraper").call(serpInput as any);
    const serpPages = await client.dataset(run.defaultDatasetId).listItems();
    let serpCollected = 0;
    let serpIntentPassed = 0;
    let serpFreshnessPassed = 0;
    for (const page of serpPages.items as Record<string, unknown>[]) {
      const organics = (page.organicResults ?? []) as Record<string, unknown>[];
      serpCollected += organics.length;
      for (const r of organics) {
        if (!serpResultPassesFilter(r)) continue;
        serpIntentPassed++;
        const doc = normalizeGoogleSerpItem(r, serpFreshnessPassed);
        if (!passesFreshnessFilter(doc.postedAt)) continue;
        serpFreshnessPassed++;
        docs.push(doc);
      }
    }
    console.log("[apify-collector] Google SERP:", serpCollected, "collected,", serpIntentPassed, "passed intent filter,", serpFreshnessPassed, "passed freshness filter");
  } catch (err) {
    console.warn("[apify-collector] Google SERP actor failed:", err);
  }

  // 3) Craigslist — direct RSS (no Apify)
  try {
    const clDocs = await collectCraigslistRss();
    const clFreshnessPassed = clDocs.filter((d) => passesFreshnessFilter(d.postedAt)).length;
    for (const d of clDocs) {
      if (!passesFreshnessFilter(d.postedAt)) continue;
      docs.push(d);
    }
    console.log("[apify-collector] Craigslist RSS:", clDocs.length, "collected,", clFreshnessPassed, "passed freshness filter");
  } catch (err) {
    console.warn("[apify-collector] Craigslist RSS failed:", err);
  }

  // 4) Facebook Groups — apify/facebook-groups-scraper (scraped_signal)
  try {
    const fbInput = {
      startUrls: FACEBOOK_GROUP_URLS.map((url) => ({ url })),
      resultsLimit: 100,
      viewOption: "CHRONOLOGICAL",
    };
    const run = await client.actor("apify/facebook-groups-scraper").call(fbInput as any);
    const fbItems = await client.dataset(run.defaultDatasetId).listItems();
    const fbCollected = fbItems.items.length;
    let fbFreshnessPassed = 0;
    for (let i = 0; i < fbItems.items.length; i++) {
      const item = fbItems.items[i] as Record<string, unknown>;
      const text = String(item.text ?? "").trim();
      if (!matchesFacebookKeyword(text)) continue;
      const doc = normalizeFacebookGroupPost(item, fbFreshnessPassed);
      if (!passesFreshnessFilter(doc.postedAt)) continue;
      fbFreshnessPassed++;
      docs.push(doc);
    }
    console.log("[apify-collector] Facebook Groups:", fbCollected, "collected,", fbFreshnessPassed, "passed freshness filter");
  } catch (err) {
    console.warn("[apify-collector] Facebook Groups actor failed:", err);
  }

  // 5) Twitter/X — apify/twitter-scraper (scraped_signal)
  try {
    const twitterInput = {
      searchQueries: TWITTER_SEARCH_QUERIES,
      maxTweets: 100,
    };
    const run = await client.actor("apify/twitter-scraper").call(twitterInput as any);
    const twitterItems = await client.dataset(run.defaultDatasetId).listItems();
    const twitterCollected = twitterItems.items.length;
    let twitterFreshnessPassed = 0;
    for (let i = 0; i < twitterItems.items.length; i++) {
      const doc = normalizeTwitterItem(twitterItems.items[i] as Record<string, unknown>, twitterFreshnessPassed);
      if (!passesFreshnessFilter(doc.postedAt)) continue;
      twitterFreshnessPassed++;
      docs.push(doc);
    }
    console.log("[apify-collector] Twitter:", twitterCollected, "collected,", twitterFreshnessPassed, "passed freshness filter");
  } catch (err) {
    console.warn("[apify-collector] Twitter actor failed:", err);
  }

  // 6) LinkedIn — apify/linkedin-scraper (venue_intelligence: event planners / wedding coordinators)
  try {
    const linkedInInput = {
      search: LINKEDIN_SEARCH_QUERIES.join(" OR "),
      maxResults: 50,
    };
    const run = await client.actor("apify/linkedin-scraper").call(linkedInInput as any);
    const linkedInItems = await client.dataset(run.defaultDatasetId).listItems();
    for (let i = 0; i < linkedInItems.items.length; i++) {
      docs.push(normalizeLinkedInItem(linkedInItems.items[i] as Record<string, unknown>, i));
    }
    console.log("[apify-collector] LinkedIn:", linkedInItems.items.length, "items (venue_intelligence)");
  } catch (err) {
    console.warn("[apify-collector] LinkedIn actor failed:", err);
  }

  // 7) Google Maps Venues — compass/google-maps-extractor (venue_intelligence)
  try {
    const gmapsInput = {
      searchStringsArray: GOOGLE_MAPS_SEARCHES,
      maxCrawledPlacesPerSearch: 20,
      language: "en",
    };
    const run = await client.actor("compass/google-maps-extractor").call(gmapsInput as any);
    const gmapsItems = await client.dataset(run.defaultDatasetId).listItems();
    const beforeGmaps = docs.length;
    for (let i = 0; i < gmapsItems.items.length; i++) {
      docs.push(normalizeGoogleMapsItem(gmapsItems.items[i] as Record<string, unknown>, i));
    }
    console.log("[apify-collector] Google Maps:", docs.length - beforeGmaps, "items (venue_intelligence)");
  } catch (err) {
    console.warn("[apify-collector] Google Maps actor failed:", err);
  }

  console.log("[apify-collector] Total RawLeadDocs:", docs.length);
  return docs;
}
