import "dotenv/config";
import { sql, eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { scraperSubreddits, scraperKeywords } from "../drizzle/schema";

async function seedSubreddits() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available. Make sure DATABASE_URL is set in .env.");
    process.exit(1);
  }

  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)`.mapWith(Number) })
    .from(scraperSubreddits);

  if (count > 0) {
    console.log(`scraperSubreddits already has ${count} rows, skipping seeding.`);
    return;
  }

  const seeds = [
    { subreddit: "weddingplanning", cityHint: null },
    { subreddit: "eventplanning", cityHint: null },
    { subreddit: "HireAMusician", cityHint: null },
    { subreddit: "forhire", cityHint: null },
    { subreddit: "Miami", cityHint: "Miami, FL" },
    { subreddit: "fortlauderdale", cityHint: "Fort Lauderdale, FL" },
    { subreddit: "southflorida", cityHint: "South Florida" },
    { subreddit: "podcasts", cityHint: null },
    { subreddit: "WeddingVendors", cityHint: null },
    { subreddit: "DJs", cityHint: null },
  ];

  await db.insert(scraperSubreddits).values(
    seeds.map(s => ({
      subreddit: s.subreddit,
      cityHint: s.cityHint,
      isActive: true,
    })),
  );

  console.log(`Seeded ${seeds.length} rows into scraperSubreddits.`);
}

async function seedKeywords() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available. Make sure DATABASE_URL is set in .env.");
    process.exit(1);
  }

  const keywords = [
    "need dj",
    "looking for dj",
    "hire dj",
    "dj for wedding",
    "dj for party",
    "dj for event",
    "need band",
    "looking for band",
    "hire musician",
    "entertainment for",
    "need entertainment",
  ];

  for (const kw of keywords) {
    const existing = await db
      .select()
      .from(scraperKeywords)
      .where(eq(scraperKeywords.keyword, kw))
      .limit(1);

    if (existing.length > 0) {
      continue;
    }

    await db.insert(scraperKeywords).values({
      keyword: kw,
      type: "seeking",
      isActive: true,
    });
  }

  console.log(`Ensured ${keywords.length} seeker keywords exist in scraperKeywords (type='seeking').`);
}

async function main() {
  await seedSubreddits();
  await seedKeywords();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

