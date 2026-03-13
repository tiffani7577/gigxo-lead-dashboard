/**
 * Meetup Collector — Event discovery platform with organizer contact info
 * Searches for upcoming events in each market
 */

import type { RawDocument } from "../scraper";

const MEETUP_CATEGORIES = [
  "music",
  "photography",
  "weddings",
  "events",
  "entertainment",
  "performing-arts",
  "nightlife",
  "social",
  "singles",
];

export async function collectFromMeetup(market: { id: string; displayName: string }): Promise<RawDocument[]> {
  const allDocs: RawDocument[] = [];

  for (const category of MEETUP_CATEGORIES) {
    try {
      // Meetup search URL (public, no auth required)
      const url = `https://www.meetup.com/find/?keywords=${encodeURIComponent(market.displayName)}&categories=${category}`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!response.ok) continue;

      const html = await response.text();

      // Extract event titles and links
      const eventRegex = /<a[^>]*href="\/events\/(\d+)"[^>]*>([^<]+)<\/a>/g;
      let match;

      while ((match = eventRegex.exec(html)) !== null) {
        const eventId = match[1];
        const title = match[2];

        if (title.length > 5) {
          allDocs.push({
            id: `meetup-${eventId}`,
            title: title,
            body: `Meetup event: ${title}`,
            url: `https://www.meetup.com/events/${eventId}`,
            source: "meetup",
            sourceLabel: "Meetup",
            createdAt: new Date(),
            author: "meetup-organizer",
            marketId: market.id,
          });
        }
      }
    } catch (e) {
      // Silently skip failed categories
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 300));
  }

  return allDocs;
}
