/**
 * Pro subscription monthly credits.
 * Pro = $49/mo, 15 unlock credits per billing period. Each credit covers any tier ($3/$7/$15) at unlock time. Credits apply before Stripe.
 */

import { and, eq, gte } from "drizzle-orm";
import { LEAD_TIER_PRICE_CENTS } from "../shared/leadPricing";

const PRO_MONTHLY_CREDITS = 15;
/** One Pro credit = premium-tier cap so a single credit fully covers discovery, standard, or premium unlocks. */
const CREDIT_AMOUNT_CENTS = LEAD_TIER_PRICE_CENTS.premium;

export async function ensureProMonthlyCredits(userId: number, db: Awaited<ReturnType<typeof import("./db").getDb>>): Promise<void> {
  if (!db) return;
  const { subscriptions, userCredits } = await import("../drizzle/schema");
  const now = new Date();

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.tier, "premium"), eq(subscriptions.status, "active")))
    .limit(1);

  if (!sub?.currentPeriodStart || !sub?.currentPeriodEnd) return;
  if (new Date(sub.currentPeriodEnd) < now) return;

  const periodStart = new Date(sub.currentPeriodStart);

  const existing = await db
    .select()
    .from(userCredits)
    .where(and(eq(userCredits.userId, userId), eq(userCredits.source, "pro_monthly"), gte(userCredits.createdAt, periodStart)));

  const count = existing.length;
  if (count >= PRO_MONTHLY_CREDITS) return;

  const toInsert = PRO_MONTHLY_CREDITS - count;
  for (let i = 0; i < toInsert; i++) {
    await db.insert(userCredits).values({
      userId,
      amount: CREDIT_AMOUNT_CENTS,
      source: "pro_monthly",
      isUsed: false,
    });
  }
}
