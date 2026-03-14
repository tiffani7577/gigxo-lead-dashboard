import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { users, artistProfiles } from "../drizzle/schema";

const CITIES = ["Miami, FL", "Fort Lauderdale, FL", "West Palm Beach, FL"] as const;
const GENRES = ["open_format", "wedding", "yacht", "latin", "house", "hip_hop"] as const;

const SAMPLE_NAMES = [
  "DJ Nova", "Alex Rivera", "DJ Luna", "Marcus Cole", "Sofia Vega",
  "DJ Pulse", "Jordan Blake", "Maya Chen", "DJ Cruz", "Taylor Reed",
  "DJ Echo", "Riley Brooks", "DJ Flux", "Casey Morgan", "Sam Davis",
  "DJ Vibe", "Jamie Lee", "DJ Spark", "Quinn Adams", "Reese Gray",
  "DJ Blaze", "Skyler Fox", "DJ Nova Prime", "Parker Lane", "Drew Ellis",
  "DJ Apex", "Morgan Hayes", "DJ Stellar", "Cameron Wells", "Avery Scott",
];

function pick<T>(arr: readonly T[], index: number): T {
  return arr[index % arr.length];
}

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available. Set DATABASE_URL in .env");
    process.exit(1);
  }

  const count = 30;
  let inserted = 0;

  for (let i = 0; i < count; i++) {
    const email = `seed-performer-${i + 1}@gigxo.local`;
    const name = SAMPLE_NAMES[i];
    const slug = `dj-${name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}-${i + 1}`.slice(0, 128);

    await db.insert(users).values({
      email,
      name,
      role: "user",
    } as typeof users.$inferInsert);

    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      console.warn(`Could not get id for user ${email}, skipping profile`);
      continue;
    }

    const city = pick(CITIES, i);
    const genreCount = 1 + (i % 3);
    const genres = Array.from({ length: genreCount }, (_, j) => pick(GENRES, i + j));
    const minBudget = 30000 + (i % 12) * 10000; // $300–$1500 in cents

    await db.insert(artistProfiles).values({
      userId: user.id,
      djName: name,
      stageName: name,
      slug,
      location: city,
      genres,
      minBudget,
      maxDistance: 30,
      bio: `Professional DJ and performer based in ${city}. Specializing in ${genres.join(", ")}. Available for weddings, private events, and club nights.`,
      instagramUrl: `https://instagram.com/seed_${slug.replace(/-/g, "_").slice(0, 20)}`,
      experienceLevel: "professional",
      isPublished: true,
      isClaimed: false,
      templateId: "default",
    } as typeof artistProfiles.$inferInsert);

    inserted++;
  }

  console.log(`Seeded ${inserted} performers.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
