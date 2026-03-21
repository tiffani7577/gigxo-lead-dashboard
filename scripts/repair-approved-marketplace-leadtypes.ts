/**
 * One-off: fix approved leads whose leadType blocks Marketplace (e.g. event_demand, other)
 * by setting scraped_signal or client_submitted using the same rules as admin.approveLead.
 *
 * Skips venue_intelligence, manual_outreach, and leadCategory === venue_intelligence.
 *
 * Usage (DATABASE_URL required):
 *   npx tsx scripts/repair-approved-marketplace-leadtypes.ts --dry-run
 *   npx tsx scripts/repair-approved-marketplace-leadtypes.ts --apply
 */

import "dotenv/config";
import { and, asc, eq, gt } from "drizzle-orm";
import { gigLeads } from "../drizzle/schema";
import { getDb } from "../server/db";
import { getLeadTypePatchOnApprove } from "../server/marketplaceLeadType";

const BATCH = 300;
const dryRun = process.argv.includes("--dry-run");
const apply = process.argv.includes("--apply");

async function main() {
  if (dryRun === apply) {
    console.error("Specify exactly one of: --dry-run | --apply");
    process.exit(1);
  }

  const db = await getDb();
  if (!db) throw new Error("Database unavailable (DATABASE_URL).");

  let cursor = 0;
  let scanned = 0;
  let wouldFix = 0;
  const samples: { id: number; from: string | null; to: string }[] = [];

  while (true) {
    const rows = await db
      .select({
        id: gigLeads.id,
        leadType: gigLeads.leadType,
        leadCategory: gigLeads.leadCategory,
        source: gigLeads.source,
        externalId: gigLeads.externalId,
        description: gigLeads.description,
      })
      .from(gigLeads)
      .where(and(gt(gigLeads.id, cursor), eq(gigLeads.isApproved, true)))
      .orderBy(asc(gigLeads.id))
      .limit(BATCH);

    if (rows.length === 0) break;
    cursor = rows[rows.length - 1]!.id;
    scanned += rows.length;

    for (const row of rows) {
      const patch = getLeadTypePatchOnApprove({
        leadType: row.leadType,
        leadCategory: row.leadCategory,
        source: row.source,
        externalId: row.externalId,
        description: row.description,
      });
      if (!("leadType" in patch)) continue;

      wouldFix++;
      if (samples.length < 8) {
        samples.push({ id: row.id, from: row.leadType, to: patch.leadType });
      }

      if (!dryRun) {
        await db.update(gigLeads).set({ leadType: patch.leadType }).where(eq(gigLeads.id, row.id));
      }
    }
  }

  console.log(`[repair-leadtypes] mode=${dryRun ? "DRY-RUN" : "APPLY"}`);
  console.log(`  Scanned approved rows: ${scanned}`);
  console.log(`  ${dryRun ? "Would update" : "Updated"}: ${wouldFix}`);
  if (samples.length) {
    console.log("  Sample rows:");
    for (const s of samples) {
      console.log(`    id=${s.id}  leadType: ${JSON.stringify(s.from)} → ${JSON.stringify(s.to)}`);
    }
  }
}

main().catch((e) => {
  console.error("[repair-leadtypes] Failed:", e);
  process.exit(1);
});
