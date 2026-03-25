/**
 * One-off / repeatable: reject pending junk venue-intel rows (default Apify maps scoring).
 *
 * Usage: npx tsx scripts/reject-pending-venue-intel-junk.mts
 * Requires DATABASE_URL in .env
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { getDb } from "../server/db";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }
  const db = await getDb();
  if (!db) {
    console.error("Database connection failed.");
    process.exit(1);
  }

  const stmt = `
UPDATE gigLeads
SET isRejected = 1, isApproved = 0
WHERE intentScore = 56
  AND isApproved = 0
  AND isRejected = 0
  AND (leadType = 'venue_intelligence' OR source = 'google_maps')
`;

  const result = await db.execute(sql.raw(stmt.trim()));
  const affected =
    (Array.isArray(result) && (result[0] as { affectedRows?: number })?.affectedRows) ??
    (result as { affectedRows?: number })?.affectedRows ??
    0;
  console.log("[reject-pending-venue-intel-junk] Rows updated:", Number(affected));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
