/**
 * One-off read-only report: leads in last 2h by source, and 10 most recent non-DBPR leads.
 * Run: npx tsx scripts/query-recent-leads.mts
 */
import "dotenv/config";
import { getDb } from "../server/db";
import { gigLeads } from "../drizzle/schema";
import { sql, and, gte, ne, desc } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("DATABASE_URL not set or DB unavailable.");
    process.exit(1);
  }

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  // 1) Count by source (last 2 hours)
  const bySource = await db
    .select({
      source: gigLeads.source,
      count: sql<number>`COUNT(*)`.as("count"),
    })
    .from(gigLeads)
    .where(gte(gigLeads.createdAt, twoHoursAgo))
    .groupBy(gigLeads.source);

  console.log("\n1. Leads inserted in the last 2 hours, by source:\n");
  if (bySource.length === 0) {
    console.log("   (none)");
  } else {
    bySource.forEach((r) => console.log(`   ${r.source}: ${r.count}`));
  }

  // 2) 10 most recently inserted non-DBPR leads
  const recent = await db
    .select({
      title: gigLeads.title,
      source: gigLeads.source,
      location: gigLeads.location,
      createdAt: gigLeads.createdAt,
      intentScore: gigLeads.intentScore,
      isApproved: gigLeads.isApproved,
      contactEmail: gigLeads.contactEmail,
      contactPhone: gigLeads.contactPhone,
      venueUrl: gigLeads.venueUrl,
    })
    .from(gigLeads)
    .where(ne(gigLeads.source, "dbpr"))
    .orderBy(desc(gigLeads.createdAt))
    .limit(10);

  console.log("\n2. 10 most recently inserted non-DBPR leads:\n");
  recent.forEach((r, i) => {
    console.log(`   --- ${i + 1} ---`);
    console.log(`   title:       ${r.title ?? "—"}`);
    console.log(`   source:      ${r.source ?? "—"}`);
    console.log(`   location:    ${r.location ?? "—"}`);
    console.log(`   createdAt:   ${r.createdAt ?? "—"}`);
    console.log(`   intentScore: ${r.intentScore ?? "—"}`);
    console.log(`   isApproved:  ${r.isApproved}`);
    console.log(`   contactEmail: ${r.contactEmail ? "populated" : "null"}`);
    console.log(`   contactPhone: ${r.contactPhone ? "populated" : "null"}`);
    console.log(`   venueUrl:    ${r.venueUrl ? "populated" : "null"}`);
  });
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
