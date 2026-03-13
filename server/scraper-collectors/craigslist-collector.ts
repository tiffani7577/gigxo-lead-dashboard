/**
 * Craigslist collector — outputs normalized RawLeadDoc for the lead pipeline.
 * Uses public Craigslist RSS feeds (no paid API).
 */

import type { RawLeadDoc } from "./raw-lead-doc";

async function safeFetch(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "GigxoScraper/1.0 (+https://gigxo.com)" },
    });
    if (!res.ok) {
      console.warn("[craigslist-collector] Fetch failed", url, res.status);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn("[craigslist-collector] Fetch error", url, err);
    return null;
  }
}

const CRAIGSLIST_FEEDS: { city: string; baseUrl: string }[] = [
  { city: "Miami, FL", baseUrl: "https://miami.craigslist.org/search/evg" },
  { city: "Fort Lauderdale, FL", baseUrl: "https://miami.craigslist.org/search/brw/evg" },
];

export interface CraigslistCollectorOptions {
  query?: string;
  location?: string;
  maxResults?: number;
}

export async function collectFromCraigslistRss(
  options?: CraigslistCollectorOptions
): Promise<RawLeadDoc[]> {
  const query = options?.query?.trim() || "dj";
  const location = options?.location?.toLowerCase() ?? "";
  const maxResults = options?.maxResults ?? 100;

  const feeds = location
    ? CRAIGSLIST_FEEDS.filter((f) => f.city.toLowerCase().includes(location))
    : CRAIGSLIST_FEEDS;

  const docs: RawLeadDoc[] = [];

  for (const { city, baseUrl } of feeds) {
    const url = `${baseUrl}?format=rss&query=${encodeURIComponent(query)}`;
    const xml = await safeFetch(url);
    if (!xml) continue;

    const itemRegex =
      /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?(?:<description>(.*?)<\/description>)?[\s\S]*?<\/item>/g;
    let match: RegExpExecArray | null;
    while ((match = itemRegex.exec(xml))) {
      const title = match[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
      const link = match[2].trim();
      const desc = (match[3] || "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
      if (!title || !link) continue;

      docs.push({
        externalId: `craigslist-${link}`,
        source: "craigslist",
        sourceType: "craigslist",
        sourceLabel: "Craigslist",
        title,
        rawText: `${title}\n\n${desc}`,
        url: link,
        postedAt: new Date(),
        city,
        metadata: { feedCity: city },
      });
      if (docs.length >= maxResults) return docs;
    }
  }

  return docs;
}
