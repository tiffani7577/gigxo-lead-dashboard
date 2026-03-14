/**
 * Backfill Phase 1 monetization defaults for existing venue intelligence leads.
 *
 * Usage:
 *   NODE_ENV=production tsx scripts/backfill-monetization-defaults.ts
 *
 * Requires DATABASE_URL in env.
 */

import { and, eq, isNull } from "drizzle-orm";

async function main() {
  const { getDb } = await import("../server/db");
  const db = await getDb();
  if (!db) throw new Error("Database not available (DATABASE_URL missing?)");

  const { gigLeads } = await import("../drizzle/schema");

  // Region inference (coarse). We keep a fallback south_florida.
  const inferRegionTag = (location: string | null | undefined) => {
    const lower = (location ?? "").toLowerCase();
    if (lower.includes("west palm")) return "west_palm";
    if (lower.includes("boca")) return "boca";
    if (lower.includes("fort lauderdale") || lower.includes("broward")) return "fort_lauderdale";
    if (lower.includes("miami") || lower.includes("dade")) return "miami";
    return "south_florida";
  };

  // Fetch IDs + locations for venue intelligence rows missing monetization defaults.
  const rows = await db
    .select({ id: gigLeads.id, location: gigLeads.location })
    .from(gigLeads)
    .where(
      and(
        eq(gigLeads.leadType, "venue_intelligence"),
        // Only backfill rows that haven't been classified yet
        isNull((gigLeads as any).leadMonetizationType)
      )
    )
    .limit(50_000);

  let updated = 0;
  for (const row of rows) {
    const regionTag = inferRegionTag(row.location);
    await db
      .update(gigLeads)
      .set({
        leadMonetizationType: "venue_outreach" as any,
        outreachStatus: "not_sent" as any,
        outreachAttemptCount: 0,
        venueClientStatus: "prospect" as any,
        subscriptionVisibility: false,
        regionTag: regionTag as any,
        artistUnlockEnabled: false,
        premiumOnly: false,
      } as any)
      .where(eq(gigLeads.id, row.id));
    updated++;
  }

  console.log(`[backfill] Updated ${updated} venue_intelligence leads.`);
}

main().catch((err) => {
  console.error("[backfill] Failed:", err);
  process.exit(1);
});

