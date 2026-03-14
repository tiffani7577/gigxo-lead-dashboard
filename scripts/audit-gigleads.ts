/**
 * One-off database truth audit for gigLeads.
 * Uses the same DATABASE_URL as the running app (from .env).
 * Run: npx tsx scripts/audit-gigleads.ts
 */
import "dotenv/config";
import { desc, eq, sql } from "drizzle-orm";
import { gigLeads } from "../drizzle/schema";
import { getDb } from "../server/db";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("DATABASE_URL not set or connection failed. Cannot run audit.");
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL ?? "";
  const dbName = connectionString.includes("/") ? connectionString.split("/").pop()?.split("?")[0] : "unknown";
  console.log("--- DATABASE TRUTH AUDIT (gigLeads) ---");
  console.log("DB (from DATABASE_URL):", dbName || "(could not parse)");
  console.log("");

  // 1. Total row count
  const [totalRow] = await db.select({ count: sql<number>`COUNT(*)` }).from(gigLeads);
  const total = Number(totalRow?.count ?? 0);
  console.log("1. Total gigLeads count:", total);
  console.log("");

  // 2. Count by source
  const bySource = await db
    .select({ source: gigLeads.source, count: sql<number>`COUNT(*)` })
    .from(gigLeads)
    .groupBy(gigLeads.source);
  console.log("2. Count by source:");
  bySource.forEach((r) => console.log("   ", r.source, ":", Number(r.count)));
  console.log("");

  // 3. Count by leadType
  const byLeadType = await db
    .select({ leadType: gigLeads.leadType, count: sql<number>`COUNT(*)` })
    .from(gigLeads)
    .groupBy(gigLeads.leadType);
  console.log("3. Count by leadType:");
  byLeadType.forEach((r) => console.log("   ", r.leadType ?? "NULL", ":", Number(r.count)));
  console.log("");

  // 4. 10 newest rows
  const newest = await db
    .select({
      id: gigLeads.id,
      source: gigLeads.source,
      sourceLabel: gigLeads.sourceLabel,
      leadType: gigLeads.leadType,
      leadCategory: gigLeads.leadCategory,
      title: gigLeads.title,
      createdAt: gigLeads.createdAt,
    })
    .from(gigLeads)
    .orderBy(desc(gigLeads.createdAt))
    .limit(10);
  console.log("4. 10 newest rows (id, source, sourceLabel, leadType, leadCategory, title, createdAt):");
  newest.forEach((r) =>
    console.log("   ", {
      id: r.id,
      source: r.source,
      sourceLabel: r.sourceLabel ?? null,
      leadType: r.leadType ?? null,
      leadCategory: r.leadCategory ?? null,
      title: (r.title ?? "").slice(0, 50),
      createdAt: r.createdAt,
    })
  );
  console.log("");
  console.log("--- END AUDIT ---");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
