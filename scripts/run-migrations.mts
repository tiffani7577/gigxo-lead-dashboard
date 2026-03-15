/**
 * Apply launch migrations 0021, 0022, 0023 only. Safe: no reset, no data loss.
 * Use when the DB was not built via drizzle-kit migrate (e.g. earlier migrations applied manually).
 *
 * Order: 0021_lead_tier.sql → 0022_user_credits_pro_monthly.sql → 0023_artist_profile_image_url.sql
 *
 * Usage: DATABASE_URL=<url> npx tsx scripts/run-migrations.mts
 */
import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const drizzleDir = path.resolve(__dirname, "..", "drizzle");

const MIGRATIONS = [
  "0021_lead_tier.sql",
  "0022_user_credits_pro_monthly.sql",
  "0023_artist_profile_image_url.sql",
] as const;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required. Set it in .env or pass it when running.");
    process.exit(1);
  }

  const db = await getDb();
  if (!db) {
    console.error("Could not connect to the database. Check DATABASE_URL.");
    process.exit(1);
  }

  for (const name of MIGRATIONS) {
    const filePath = path.join(drizzleDir, name);
    if (!fs.existsSync(filePath)) {
      console.error(`Migration file not found: ${filePath}`);
      process.exit(1);
    }
    const content = fs.readFileSync(filePath, "utf8").trim();
    const statements = content
      .split(/;\s*\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (statements.length === 0) {
      console.log(`Skip (empty): ${name}`);
      continue;
    }
    for (const stmt of statements) {
      const sqlStr = stmt.endsWith(";") ? stmt : stmt + ";";
      try {
        await db.execute(sql.raw(sqlStr));
        console.log(`OK: ${name}`);
      } catch (err: any) {
        const msg = err?.message ?? String(err);
        const code = err?.code ?? err?.errno;
        // Duplicate column / column exists = already applied
        if (
          code === "ER_DUP_FIELDNAME" ||
          (typeof code === "number" && code === 1060) ||
          /Duplicate column name/i.test(msg) ||
          /already exists/i.test(msg)
        ) {
          console.log(`Already applied (skipped): ${name}`);
        } else if (
          /Unknown column.*source/i.test(msg) ||
          /modify column.*enum/i.test(msg)
        ) {
          console.log(`Already applied or schema match (skipped): ${name}`);
        } else {
          console.error(`Failed: ${name}`, msg);
          throw err;
        }
      }
    }
  }

  console.log("Migrations complete (0021, 0022, 0023).");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
