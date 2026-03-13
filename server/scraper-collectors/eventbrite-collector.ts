/**
 * Eventbrite collector — outputs normalized RawLeadDoc for the lead pipeline.
 * Uses public Eventbrite search pages (no paid API).
 */

import type { RawLeadDoc } from "./raw-lead-doc";

async function safeFetch(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "GigxoScraper/1.0 (+https://gigxo.com)" },
    });
    if (!res.ok) {
      console.warn("[eventbrite-collector] Fetch failed", url, res.status);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn("[eventbrite-collector] Fetch error", url, err);
    return null;
  }
}

export interface EventbriteCollectorOptions {
  query?: string;
  location?: string;
  maxResults?: number;
}

export async function collectFromEventbrite(
  options?: EventbriteCollectorOptions
): Promise<RawLeadDoc[]> {
  const query = (options?.query || "dj").trim().toLowerCase().replace(/\s+/g, "-");
  const location = options?.location?.toLowerCase() ?? "";
  const maxResults = options?.maxResults ?? 100;

  const markets = [
    { id: "miami", url: `https://www.eventbrite.com/d/fl--miami/${query}/`, city: "Miami, FL" },
    {
      id: "fort_lauderdale",
      url: `https://www.eventbrite.com/d/fl--fort-lauderdale/${query}/`,
      city: "Fort Lauderdale, FL",
    },
  ].filter((m) => !location || m.city.toLowerCase().includes(location));

  const docs: RawLeadDoc[] = [];

  for (const market of markets) {
    const html = await safeFetch(market.url);
    if (!html) continue;

    const cardRegex =
      /<div[^>]+data-spec="event-card__formatted-name"[^>]*>(.*?)<\/div>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*data-spec="event-card__link"[^>]*>/g;
    let match: RegExpExecArray | null;
    while ((match = cardRegex.exec(html))) {
      const title = match[1].replace(/<[^>]+>/g, "").trim();
      const link = match[2].startsWith("http")
        ? match[2]
        : `https://www.eventbrite.com${match[2]}`;
      if (!title) continue;

      docs.push({
        externalId: `eventbrite-${link}`,
        source: "eventbrite",
        sourceType: "eventbrite",
        sourceLabel: "Eventbrite",
        title,
        rawText: `${title}\n\n(Eventbrite listing; details on page)`,
        url: link,
        postedAt: new Date(),
        city: market.city,
        metadata: { marketId: market.id },
      });
      if (docs.length >= maxResults) return docs;
    }
  }

  return docs;
}
