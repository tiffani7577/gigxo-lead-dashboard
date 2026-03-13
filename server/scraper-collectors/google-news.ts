/**
 * Google News RSS Collector — Real-time news about events and entertainment
 * Searches for news about weddings, events, entertainment in each market
 */

import type { RawDocument } from "../scraper";

export async function collectFromGoogleNews(market: { id: string; displayName: string }): Promise<RawDocument[]> {
  const queries = [
    `wedding ${market.displayName}`,
    `event ${market.displayName}`,
    `entertainment ${market.displayName}`,
    `dj ${market.displayName}`,
    `photographer ${market.displayName}`,
    `band ${market.displayName}`,
    `music festival ${market.displayName}`,
    `concert ${market.displayName}`,
  ];

  const allDocs: RawDocument[] = [];

  for (const query of queries) {
    try {
      // Google News RSS feed
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!response.ok) continue;

      const xml = await response.text();

      // Parse RSS items
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;

      while ((match = itemRegex.exec(xml)) !== null) {
        const item = match[1];

        // Extract title
        const titleMatch = /<title>([^<]+)<\/title>/.exec(item);
        const title = titleMatch ? titleMatch[1] : "News item";

        // Extract link
        const linkMatch = /<link>([^<]+)<\/link>/.exec(item);
        const link = linkMatch ? linkMatch[1] : "";

        // Extract description
        const descMatch = /<description>([^<]+)<\/description>/.exec(item);
        const description = descMatch ? descMatch[1] : "";

        // Extract pub date
        const pubDateMatch = /<pubDate>([^<]+)<\/pubDate>/.exec(item);
        const pubDate = pubDateMatch ? new Date(pubDateMatch[1]) : new Date();

        if (title && link) {
          allDocs.push({
            id: `googlenews-${link.replace(/[^a-z0-9]/gi, "-")}`,
            title: title,
            body: description || title,
            url: link,
            source: "google-news",
            sourceLabel: "Google News",
            createdAt: pubDate,
            author: "news",
            marketId: market.id,
          });
        }
      }
    } catch (e) {
      // Silently skip failed queries
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 200));
  }

  return allDocs;
}
