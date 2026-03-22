/**
 * Shared browser-like headers for public scrapers (Reddit, Craigslist RSS, etc.)
 * to reduce 403/bot blocking.
 */

export const SCRAPER_BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Reddit JSON endpoints (.json) */
export const REDDIT_JSON_FETCH_HEADERS: Record<string, string> = {
  "User-Agent": SCRAPER_BROWSER_USER_AGENT,
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.reddit.com/",
};

/** Craigslist RSS / XML feeds */
export const CRAIGSLIST_RSS_FETCH_HEADERS: Record<string, string> = {
  "User-Agent": SCRAPER_BROWSER_USER_AGENT,
  Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
};
