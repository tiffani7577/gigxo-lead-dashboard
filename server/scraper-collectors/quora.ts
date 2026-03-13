/**
 * Quora Collector — Q&A platform with high buyer intent
 * Searches for questions about hiring entertainment services
 */

import type { RawDocument } from "../scraper";

export async function collectFromQuora(market: { id: string; displayName: string }): Promise<RawDocument[]> {
  const queries = [
    `hiring a dj for ${market.displayName}`,
    `best photographer in ${market.displayName}`,
    `how to hire a band for wedding`,
    `videographer for event`,
    `makeup artist for wedding`,
    `live music for party`,
    `entertainment for corporate event`,
    `musician for hire`,
    `dj services`,
    `event entertainment`,
  ];

  const allDocs: RawDocument[] = [];

  for (const query of queries) {
    try {
      const url = `https://www.quora.com/search?q=${encodeURIComponent(query)}&type=question`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!response.ok) continue;

      const html = await response.text();

      // Extract question titles and links from HTML
      const questionRegex = /<a[^>]*href="\/([^"]*)"[^>]*>([^<]+)<\/a>/g;
      let match;

      while ((match = questionRegex.exec(html)) !== null) {
        const path = match[1];
        const title = match[2];

        if (path.includes("/question/") && title.length > 10) {
          allDocs.push({
            id: `quora-${path.replace(/\//g, "-")}`,
            title: title,
            body: `Question: ${title}`,
            url: `https://www.quora.com/${path}`,
            source: "quora",
            sourceLabel: "Quora",
            createdAt: new Date(),
            author: "quora-user",
            marketId: market.id,
          });
        }
      }
    } catch (e) {
      // Silently skip failed queries
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 500));
  }

  return allDocs;
}
