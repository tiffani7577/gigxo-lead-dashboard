/**
 * One-off: delete all gigLeads where externalId starts with "apify-" so the next
 * Fetch Leads run treats them as new (fixes dedup against local-test inserts).
 * Run: npx tsx scripts/reset-apify-leads.ts
 */
import "dotenv/config";
import { like } from "drizzle-orm";
import { gigLeads } from "../drizzle/schema";
import { getDb } from "../server/db";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("DATABASE_URL is not set or connection failed. Exiting.");
    process.exit(1);
  }

  const result = await db.delete(gigLeads).where(like(gigLeads.externalId, "apify-%"));
  const raw = Array.isArray(result) ? result[0] : result;
  const affectedRows = (raw as { affectedRows?: number } | undefined)?.affectedRows ?? 0;
  console.log(`Deleted ${affectedRows} leads where externalId LIKE 'apify-%'.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
