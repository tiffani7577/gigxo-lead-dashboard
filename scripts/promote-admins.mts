/**
 * Promote primary and secondary admin accounts.
 * Run once after deploy: npx tsx scripts/promote-admins.mts
 */
import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "../server/db";
import { users } from "../drizzle/schema";

const ADMIN_EMAILS = ["teryn@gigxo.com", "pearlleashworldwide@gmail.com"];

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available. Set DATABASE_URL in .env.");
    process.exit(1);
  }

  const found = await db.select().from(users).where(inArray(users.email, ADMIN_EMAILS));

  for (const u of found) {
    await db.update(users).set({ role: "admin" }).where(eq(users.id, u.id));
    console.log(`Promoted ${u.email} (id=${u.id}) to admin`);
  }

  const missing = ADMIN_EMAILS.filter((e) => !found.some((u) => u.email === e));
  if (missing.length) {
    console.log("Not found (sign up first):", missing.join(", "));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
