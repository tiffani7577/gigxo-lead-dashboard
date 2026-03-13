import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { users } from "../drizzle/schema";

async function main() {
  const emailFromEnv = process.env.ADMIN_EMAIL;
  const emailFromArg = process.argv[2];
  const email = emailFromArg || emailFromEnv;

  if (!email) {
    console.error("Usage: ADMIN_EMAIL=you@example.com npx tsx scripts/promote-admin.mts (or pass email as first arg)");
    process.exit(1);
  }

  const db = await getDb();
  if (!db) {
    console.error("Database not available. Make sure DATABASE_URL is set in .env.");
    process.exit(1);
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user) {
    console.error(`No user found with email ${email}`);
    process.exit(1);
  }

  await db
    .update(users)
    .set({ role: "admin" })
    .where(eq(users.id, user.id));

  console.log(`Updated user ${email} (id=${user.id}) to role=admin`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

