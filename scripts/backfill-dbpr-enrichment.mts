/**
 * Backfill DBPR venue contact enrichment for leads missing email + phone.
 *
 * Run:
 *   npx tsx scripts/backfill-dbpr-enrichment.mts
 *
 * Notes:
 * - Processes in batches of 5 with a 3s delay between batches to reduce Google Places API rate-limit risk.
 * - Requires DATABASE_URL in .env.
 */

import "dotenv/config";
import { eq, and, isNull, desc } from "drizzle-orm";
import { getDb } from "../server/db";
import { gigLeads } from "../drizzle/schema";
import { enrichVenueContact } from "../server/scraper-collectors/contact-enrichment";

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 3000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractCityFromLocation(location: unknown): string {
  try {
    const s = String(location ?? "").trim();
    if (!s) return "Miami";
    const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      let city = parts[parts.length - 2] ?? "";
      city = city.replace(/\s+Beach\b/i, "").trim();
      return city || parts[0] || "Miami";
    }
    return s.length > 64 ? `${s.slice(0, 64)}...` : s;
  } catch {
    return "Miami";
  }
}

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("[backfill] Database unavailable. Ensure DATABASE_URL is set in .env");
    process.exit(1);
  }

  // 1) Fetch target leads
  const venues = await db
    .select({
      id: gigLeads.id,
      name: gigLeads.title,
      location: gigLeads.location,
    })
    .from(gigLeads)
    .where(
      and(
        eq(gigLeads.source, "dbpr"),
        eq(gigLeads.isApproved, true),
        isNull(gigLeads.contactEmail),
        isNull(gigLeads.contactPhone),
      ),
    )
    .orderBy(desc(gigLeads.createdAt));

  const total = venues.length;
  let enrichedCount = 0;

  // 2) Process in batches
  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = venues.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (v, batchIndex) => {
        const idx = i + batchIndex;
        const name = String(v.name ?? `venue-${v.id}`);
        console.log(`[backfill] Processing venue ${idx + 1} of ${total}: ${name}`);

        const city = extractCityFromLocation(v.location);

        // 2) Enrich venue
        await enrichVenueContact(v.id, name, city);

        // 4) Re-check updated contact flags for the log
        const [row] = await db
          .select({ contactEmail: gigLeads.contactEmail, contactPhone: gigLeads.contactPhone })
          .from(gigLeads)
          .where(eq(gigLeads.id, v.id))
          .limit(1);

        const phoneYes = !!row?.contactPhone && String(row.contactPhone).trim().length > 0;
        const emailYes = !!row?.contactEmail && String(row.contactEmail).trim().length > 0;
        if (phoneYes || emailYes) enrichedCount += 1;

        console.log(
          `[backfill] Enriched: ${name} - phone: ${phoneYes ? "yes" : "no"}, email: ${emailYes ? "yes" : "no"}`,
        );
      }),
    );

    // 3) Delay between batches
    if (i + BATCH_SIZE < total) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  // 4) Final summary
  console.log(`[backfill] Complete: ${enrichedCount} enriched out of ${total} total`);
}

main().catch((err) => {
  console.error("[backfill] Fatal error:", err);
  process.exit(1);
});

