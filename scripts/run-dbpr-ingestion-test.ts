/**
 * One-off DBPR ingestion test: run pipeline (DBPR only in practice), insert/upsert DBPR leads, report counts.
 * Usage: npx tsx scripts/run-dbpr-ingestion-test.ts
 */
import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../server/db";
import { gigLeads } from "../drizzle/schema";
import { runScraperPipeline } from "../server/scraper-collectors/scraper-pipeline";

// Insert only columns that exist in DB (router shape; omit status/notes/etc. if migrations not run)
function buildInsertValues(lead: any) {
  return {
    externalId: lead.externalId,
    source: lead.source,
    sourceLabel: lead.sourceLabel ?? null,
    title: lead.title,
    description: lead.description ?? null,
    eventType: lead.eventType ?? null,
    budget: lead.budget ?? null,
    location: lead.location,
    latitude: lead.latitude != null ? parseFloat(lead.latitude.toString()) : null,
    longitude: lead.longitude != null ? parseFloat(lead.longitude.toString()) : null,
    eventDate: lead.eventDate ?? null,
    contactName: lead.contactName ?? null,
    contactEmail: lead.contactEmail ?? null,
    contactPhone: lead.contactPhone ?? null,
    venueUrl: lead.venueUrl ?? null,
    performerType: lead.performerType ?? "other",
    intentScore: lead.intentScore ?? null,
    leadType: lead.leadType ?? undefined,
    leadCategory: lead.leadCategory ?? undefined,
    isApproved: false,
    isRejected: false,
    isHidden: false,
    isReserved: false,
  };
}

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available.");
    process.exit(1);
  }

  console.log("--- DBPR ingestion test ---");
  console.log("Running pipeline (all enabled sources; we will only insert DBPR leads)...");

  const { stats, leads, sourceCounts } = await runScraperPipeline();

  const dbprLeads = leads.filter((l) => l.source === "dbpr" || l.externalId.startsWith("dbpr-"));
  const rowsAccepted = dbprLeads.length;
  const CAP = 300; // cap inserts for test run
  const toProcess = dbprLeads.slice(0, CAP);

  console.log("Pipeline stats:", {
    collected: stats.collected,
    trashCount: stats.trashCount,
    classified: stats.classified,
    sourceCounts,
  });
  console.log("DBPR leads accepted (passed pipeline):", rowsAccepted);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const lead of toProcess) {
    const [existing] = await db
      .select({ id: gigLeads.id })
      .from(gigLeads)
      .where(eq(gigLeads.externalId, lead.externalId))
      .limit(1);

    if (existing) {
      const updateData: any = {
        source: lead.source as any,
        sourceLabel: lead.sourceLabel ?? null,
        title: lead.title,
        description: lead.description,
        eventType: lead.eventType,
        budget: lead.budget,
        location: lead.location,
        latitude: lead.latitude ? parseFloat(lead.latitude.toString()) : null,
        longitude: lead.longitude ? parseFloat(lead.longitude.toString()) : null,
        eventDate: lead.eventDate,
        contactName: lead.contactName,
        contactEmail: lead.contactEmail,
        contactPhone: lead.contactPhone,
        venueUrl: lead.venueUrl,
        performerType: lead.performerType as any,
        intentScore: lead.intentScore ?? null,
        leadType: (lead as any).leadType ?? undefined,
        leadCategory: (lead as any).leadCategory ?? undefined,
      };
      await db.update(gigLeads).set(updateData).where(eq(gigLeads.id, existing.id));
      updated++;
      continue;
    }

    try {
      const insertPayload = buildInsertValues(lead);
      await db.insert(gigLeads).values(insertPayload as any);
      inserted++;
    } catch (err) {
      console.error("[dbpr-ingestion] Insert error:", lead.externalId, err);
      skipped++;
    }
  }

  const [dbprCountRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(gigLeads)
    .where(eq(gigLeads.source, "dbpr"));

  const dbprInDb = Number(dbprCountRow?.count ?? 0);

  console.log("--- Result ---");
  console.log("Rows inserted (new, this run):", inserted);
  console.log("Rows updated (existing, this run):", updated);
  console.log("Rows skipped (errors):", skipped);
  console.log("(Test capped at", CAP, "DBPR leads processed this run.)");
  console.log("source=dbpr rows in gigLeads now:", dbprInDb);
  console.log("--- End ---");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
