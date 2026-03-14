/**
 * Drip Email Cron Scheduler
 *
 * Runs automatically in the background after server start.
 * - Every hour: checks for artists in Day-3 window (2–4 days since signup, 0 unlocks) → sends Day-3 drip
 * - Every hour: checks for artists in Day-7 window (6–8 days since signup) → sends Day-7 referral push
 * - Every day at 9am: sends new lead alerts to matched artists
 *
 * Uses dripEmailLog table to prevent duplicate sends.
 */

import { and, eq, gte, lte, desc } from "drizzle-orm";

let cronStarted = false;

export async function startDripCron() {
  if (cronStarted) return;
  cronStarted = true;

  console.log("[DripCron] Drip email scheduler started");

  // Run immediately on startup (catches any missed sends), then every hour
  runDripChecks().catch(console.error);
  setInterval(() => {
    runDripChecks().catch(console.error);
  }, 60 * 60 * 1000); // every hour

  // Daily lead alert at 9am — check every hour if it's time
  scheduleDailyLeadAlerts();
}

async function runDripChecks() {
  console.log("[DripCron] Running drip checks...");
  try {
    await sendDay3Drips();
    await sendDay7Drips();
  } catch (err) {
    console.error("[DripCron] Error in drip checks:", err);
  }
}

async function sendDay3Drips() {
  const { getDb } = await import("./db");
  const db = await getDb();
  if (!db) return;

  const { users, transactions, gigLeads, dripEmailLog } = await import("../drizzle/schema") as any;
  const { sendDay3DripEmail } = await import("./email");

  // Artists who signed up 2–4 days ago
  const now = Date.now();
  const fourDaysAgo = new Date(now - 4 * 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000);

  const candidates = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(
      and(
        gte(users.createdAt, fourDaysAgo),
        lte(users.createdAt, twoDaysAgo),
        eq(users.role, "user"),
        eq(users.emailVerified, true)
      )
    );

  if (candidates.length === 0) return;

  // Get a sample approved lead
  const sampleLeads = await db
    .select({ id: gigLeads.id, title: gigLeads.title, budget: gigLeads.budget, location: gigLeads.location })
    .from(gigLeads)
    .where(and(eq(gigLeads.isApproved, true), eq(gigLeads.isHidden, false)))
    .orderBy(desc(gigLeads.createdAt))
    .limit(1);

  const sample = sampleLeads[0];
  if (!sample) return;

  let sent = 0;
  for (const user of candidates) {
    if (!user.email) continue;

    // Check if already sent this drip
    const alreadySent = await db
      .select({ id: dripEmailLog.id })
      .from(dripEmailLog)
      .where(and(eq(dripEmailLog.userId, user.id), eq(dripEmailLog.dripType, "day3")))
      .limit(1);
    if (alreadySent.length > 0) continue;

    // Check they have no unlocks
    const unlocks = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(eq(transactions.userId, user.id), eq(transactions.status, "completed")))
      .limit(1);
    if (unlocks.length > 0) {
      // They already unlocked — log it so we don't check again, but don't send
      await db.insert(dripEmailLog).values({ userId: user.id, dripType: "day3" });
      continue;
    }

    const success = await sendDay3DripEmail(
      user.email,
      user.name ?? "",
      sample.title,
      sample.budget,
      sample.location,
      "https://gigxo.com"
    );

    if (success) {
      await db.insert(dripEmailLog).values({ userId: user.id, dripType: "day3" });
      sent++;
      console.log(`[DripCron] Day-3 drip sent to user ${user.id} (${user.email})`);
    }
  }

  if (sent > 0) console.log(`[DripCron] Day-3: sent ${sent} emails`);
}

async function sendDay7Drips() {
  const { getDb } = await import("./db");
  const db = await getDb();
  if (!db) return;

  const { users, referrals, dripEmailLog } = await import("../drizzle/schema") as any;
  const { sendDay7DripEmail } = await import("./email");

  // Artists who signed up 6–8 days ago
  const now = Date.now();
  const eightDaysAgo = new Date(now - 8 * 24 * 60 * 60 * 1000);
  const sixDaysAgo = new Date(now - 6 * 24 * 60 * 60 * 1000);

  const candidates = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(
      and(
        gte(users.createdAt, eightDaysAgo),
        lte(users.createdAt, sixDaysAgo),
        eq(users.role, "user"),
        eq(users.emailVerified, true)
      )
    );

  if (candidates.length === 0) return;

  let sent = 0;
  for (const user of candidates) {
    if (!user.email) continue;

    // Check if already sent this drip
    const alreadySent = await db
      .select({ id: dripEmailLog.id })
      .from(dripEmailLog)
      .where(and(eq(dripEmailLog.userId, user.id), eq(dripEmailLog.dripType, "day7")))
      .limit(1);
    if (alreadySent.length > 0) continue;

    // Get referral code
    const refRows = await db
      .select({ code: referrals.referralCode })
      .from(referrals)
      .where(eq(referrals.referrerId, user.id))
      .limit(1);
    const refCode = refRows[0]?.code ?? `ref-${user.id}`;

    const success = await sendDay7DripEmail(
      user.email,
      user.name ?? "",
      refCode,
      "https://gigxo.com"
    );

    if (success) {
      await db.insert(dripEmailLog).values({ userId: user.id, dripType: "day7" });
      sent++;
      console.log(`[DripCron] Day-7 drip sent to user ${user.id} (${user.email})`);
    }
  }

  if (sent > 0) console.log(`[DripCron] Day-7: sent ${sent} emails`);
}

let lastLeadAlertDate = "";

function scheduleDailyLeadAlerts() {
  // Check every 30 minutes if it's between 9:00–9:30am and we haven't sent today
  setInterval(async () => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const today = now.toISOString().slice(0, 10);

    if (hour === 9 && minute < 30 && lastLeadAlertDate !== today) {
      lastLeadAlertDate = today;
      console.log("[DripCron] Running daily lead alerts...");
      try {
        await sendDailyLeadAlerts();
      } catch (err) {
        console.error("[DripCron] Error sending lead alerts:", err);
      }
    }
  }, 30 * 60 * 1000); // every 30 minutes
}

async function sendDailyLeadAlerts() {
  const { getDb } = await import("./db");
  const db = await getDb();
  if (!db) return;

  const { users, gigLeads, artistProfiles, dripEmailLog } = await import("../drizzle/schema") as any;
  const { sendNewLeadAlertEmail } = await import("./email");

  // Leads approved in the last 24 hours (artist-visible only: exclude venue_intelligence / manual_outreach)
  const { or, isNull, not, eq, inArray } = await import("drizzle-orm");
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const artistVisibleLead = and(
    or(isNull(gigLeads.leadType), not(inArray(gigLeads.leadType, ["venue_intelligence", "manual_outreach"]))),
    or(isNull(gigLeads.leadCategory), not(eq(gigLeads.leadCategory, "venue_intelligence")))
  );
  const newLeads = await db
    .select()
    .from(gigLeads)
    .where(and(eq(gigLeads.isApproved, true), eq(gigLeads.isHidden, false), artistVisibleLead, gte(gigLeads.createdAt, since)))
    .limit(50);

  if (newLeads.length === 0) {
    console.log("[DripCron] No new leads in last 24h, skipping lead alerts");
    return;
  }

  const artists = await db
    .select({ u: users, p: artistProfiles })
    .from(users)
    .innerJoin(artistProfiles, eq(users.id, artistProfiles.userId))
    .where(and(eq(users.role, "user"), eq(users.emailVerified, true)));

  let sent = 0;
  for (const { u, p } of artists) {
    if (!u.email) continue;

    // Only send once per day — check log for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const alreadySent = await db
      .select({ id: dripEmailLog.id })
      .from(dripEmailLog)
      .where(
        and(
          eq(dripEmailLog.userId, u.id),
          eq(dripEmailLog.dripType, "lead_alert"),
          gte(dripEmailLog.sentAt, today)
        )
      )
      .limit(1);
    if (alreadySent.length > 0) continue;

    // Filter leads matching this artist's performer type
    const matchingLeads = newLeads.filter(lead => {
      const genres = (p.genres as string[] | null) ?? [];
      if (genres.length === 0) return true; // no filter = show all
      return (
        lead.performerType === "other" ||
        genres.some(
          g =>
            g.toLowerCase().includes(lead.performerType ?? "") ||
            (lead.performerType ?? "").includes(g.toLowerCase())
        )
      );
    });

    if (matchingLeads.length === 0) continue;

    const topLead = matchingLeads[0];
    const success = await sendNewLeadAlertEmail(
      u.email,
      u.name ?? "",
      matchingLeads.length,
      { title: topLead.title, budget: topLead.budget, location: topLead.location, eventType: topLead.eventType },
      "https://gigxo.com"
    );

    if (success) {
      await db.insert(dripEmailLog).values({ userId: u.id, dripType: "lead_alert" });
      sent++;
    }
  }

  console.log(`[DripCron] Lead alerts sent to ${sent} artists`);
}
