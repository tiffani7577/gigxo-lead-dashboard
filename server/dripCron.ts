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

import { and, eq, gte, lte, desc, isNotNull, ne } from "drizzle-orm";

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

  // DBPR pipeline at 5:45 AM Eastern (before 6am scraper); inserts venue intelligence with isApproved=true
  scheduleDbprPipeline();

  // Daily scraper at 6am Eastern (no DBPR); does not run on startup, only on schedule
  scheduleDailyScraper();

  // Daily venue outreach at 7am Eastern (DBPR venues with email, 48h+ old, max 20/day)
  scheduleDailyVenueOutreach();
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
let lastDailyScraperDate = "";
let lastDbprDate = "";
let lastDailyVenueOutreachDate = "";

function scheduleDailyVenueOutreach() {
  setInterval(async () => {
    const outreachEnabled = process.env.VENUE_OUTREACH_ENABLED === "true";
    if (!outreachEnabled) {
      console.log("[cron] Venue outreach disabled — set VENUE_OUTREACH_ENABLED=true in Railway to enable");
      return;
    }
    const now = new Date();
    const etFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", hour: "numeric", minute: "numeric", hour12: false });
    const etParts = etFormatter.formatToParts(now);
    const hour = parseInt(etParts.find((p) => p.type === "hour")?.value ?? "0", 10);
    const minute = parseInt(etParts.find((p) => p.type === "minute")?.value ?? "0", 10);
    const dateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
    const todayET = dateFormatter.format(now);
    if (hour !== 7 || minute >= 30 || lastDailyVenueOutreachDate === todayET) return;
    lastDailyVenueOutreachDate = todayET;
    try {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return;
      const { gigLeads } = await import("../drizzle/schema");
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const candidates = await db
        .select({
          id: gigLeads.id,
          title: gigLeads.title,
          location: gigLeads.location,
          contactEmail: gigLeads.contactEmail,
          venueEmail: gigLeads.venueEmail,
        })
        .from(gigLeads)
        .where(
          and(
            eq(gigLeads.source, "dbpr"),
            eq(gigLeads.isApproved, true),
            eq(gigLeads.outreachStatus, "not_sent"),
            isNotNull(gigLeads.contactEmail),
            ne(gigLeads.contactEmail, ""),
            lte(gigLeads.createdAt, fortyEightHoursAgo)
          )
        )
        .orderBy(gigLeads.createdAt)
        .limit(20);
      const { getOutreachTemplate, renderOutreachTemplate } = await import("./outreachTemplates");
      const { sendOutreachEmail } = await import("./email");
      const template = getOutreachTemplate("venue_outreach");
      if (!template) return;
      let sent = 0;
      for (const row of candidates) {
        const email = (row.venueEmail ?? row.contactEmail)?.trim() || null;
        if (!email) continue;
        const venueName = (row.title ?? "Venue").trim();
        const location = (row.location ?? "").trim();
        const { subject, body } = renderOutreachTemplate(template, venueName, location, {
          platformLink: process.env.APP_URL ?? "https://gigxo.com",
        });
        const result = await sendOutreachEmail(email, subject, body);
        if (result.success) {
          await db
            .update(gigLeads)
            .set({ outreachStatus: "sent", outreachLastSentAt: new Date() })
            .where(eq(gigLeads.id, row.id));
          sent++;
          console.log("[cron] Outreach sent to", venueName);
        }
      }
      console.log("[cron] Daily venue outreach:", sent, "emails sent");
    } catch {
      // swallow all errors — never break drip emails
    }
  }, 30 * 60 * 1000);
}

function scheduleDbprPipeline() {
  setInterval(async () => {
    if (process.env.DBPR_AUTO_RUN !== "true") return;
    const now = new Date();
    const dayFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" });
    const dayEt = dayFormatter.format(now);
    if (dayEt !== "Mon") return;
    const etFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", hour: "numeric", minute: "numeric", hour12: false });
    const etParts = etFormatter.formatToParts(now);
    const hour = parseInt(etParts.find((p) => p.type === "hour")?.value ?? "0", 10);
    const minute = parseInt(etParts.find((p) => p.type === "minute")?.value ?? "0", 10);
    const dateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
    const todayET = dateFormatter.format(now);
    if (hour !== 5 || minute < 45 || lastDbprDate === todayET) return;
    lastDbprDate = todayET;
    console.log("[cron] DBPR pipeline started (5:45 AM Eastern)");
    try {
      const { collectFromDbpr } = await import("./scraper-collectors/dbpr-collector");
      const { rawLeadDocToLead } = await import("./scraper-collectors/scraper-pipeline");
      const { gigLeads } = await import("../drizzle/schema");
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return;
      const docs = await collectFromDbpr();
      const baseIntentScore = 50;
      const leads = docs.map((doc) => rawLeadDocToLead(doc, baseIntentScore)).filter((l) => l.source === "dbpr");
      let inserted = 0;
      let skipped = 0;
      for (const lead of leads) {
        const [existing] = await db.select({ id: gigLeads.id }).from(gigLeads).where(eq(gigLeads.externalId, lead.externalId)).limit(1);
        if (existing) {
          skipped++;
          continue;
        }
        try {
          const insertData: any = {
            externalId: lead.externalId,
            source: lead.source,
            sourceLabel: lead.sourceLabel ?? null,
            title: lead.title,
            description: lead.description,
            fullDescription: lead.description,
            publicPreviewDescription: null,
            eventType: lead.eventType,
            budget: lead.budget,
            location: lead.location,
            latitude: lead.latitude != null ? parseFloat(lead.latitude.toString()) : null,
            longitude: lead.longitude != null ? parseFloat(lead.longitude.toString()) : null,
            eventDate: lead.eventDate,
            contactName: lead.contactName,
            contactEmail: lead.contactEmail,
            contactPhone: lead.contactPhone,
            venueUrl: lead.venueUrl,
            performerType: lead.performerType,
            intentScore: lead.intentScore ?? null,
            leadType: (lead as any).leadType ?? undefined,
            leadCategory: (lead as any).leadCategory ?? undefined,
            status: (lead as any).status ?? undefined,
            isApproved: true,
            isRejected: false,
            isHidden: false,
            isReserved: false,
          };
          await db.insert(gigLeads).values(insertData);
          inserted++;
          const { logLeadDiscovered } = await import("./leadConversionLog");
          logLeadDiscovered({ lead_source: lead.source, intent_score: lead.intentScore ?? null });
          const [insertedRow] = await db.select({ id: gigLeads.id }).from(gigLeads).where(eq(gigLeads.externalId, lead.externalId)).limit(1);
          if (insertedRow?.id) {
            const leadId = insertedRow.id;
            const title = lead.title ?? "";
            const location = lead.location ?? "";
            const { shouldEnrichVenue } = await import("./scraper-collectors/contact-enrichment");
            if ((lead as any).status !== "manual_review" && shouldEnrichVenue(lead.title, lead.description, lead.location)) {
              setImmediate(() => {
                import("./scraper-collectors/contact-enrichment").then((m) => m.enrichVenueContact(leadId, title, location)).catch(() => {});
              });
            }
          }
        } catch (err) {
          console.error("[cron DBPR] Insert error:", lead.externalId, err);
        }
      }
      console.log("[cron] DBPR pipeline complete:", inserted, "inserted,", skipped, "skipped");
    } catch (err) {
      console.error("[cron] DBPR pipeline failed:", err);
    }
  }, 15 * 60 * 1000); // every 15 min so we hit 5:45 AM Eastern
}

function scheduleDailyScraper() {
  setInterval(async () => {
    const now = new Date();
    const etFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", hour: "numeric", minute: "numeric", hour12: false });
    const etParts = etFormatter.formatToParts(now);
    const hour = parseInt(etParts.find((p) => p.type === "hour")?.value ?? "0", 10);
    const minute = parseInt(etParts.find((p) => p.type === "minute")?.value ?? "0", 10);
    const dateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
    const todayET = dateFormatter.format(now);
    if (hour !== 6 || minute >= 30 || lastDailyScraperDate === todayET) return;
    lastDailyScraperDate = todayET;
    console.log("[cron] Daily scraper started");
    try {
      const { runScraperPipeline } = await import("./scraper-collectors/scraper-pipeline");
      const { gigLeads } = await import("../drizzle/schema");
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const { leads } = await runScraperPipeline(undefined, undefined, { excludeSources: ["dbpr"] });
      const db = await getDb();
      let inserted = 0;
      if (db) {
        const leadsToInsert = leads.filter((l) => l.source !== "dbpr");
        for (const lead of leadsToInsert) {
          try {
            const [existing] = await db.select({ id: gigLeads.id }).from(gigLeads).where(eq(gigLeads.externalId, lead.externalId)).limit(1);
            if (existing) continue;
            await db.insert(gigLeads).values({
              externalId: lead.externalId,
              source: lead.source as any,
              sourceLabel: lead.sourceLabel ?? null,
              title: lead.title,
              description: lead.description,
              eventType: lead.eventType,
              budget: lead.budget,
              location: lead.location,
              latitude: lead.latitude != null ? parseFloat(lead.latitude.toString()) : null,
              longitude: lead.longitude != null ? parseFloat(lead.longitude.toString()) : null,
              eventDate: lead.eventDate,
              contactName: lead.contactName,
              contactEmail: lead.contactEmail,
              contactPhone: lead.contactPhone,
              venueUrl: lead.venueUrl,
              performerType: lead.performerType as any,
              intentScore: lead.intentScore ?? null,
              leadType: (lead as any).leadType ?? undefined,
              leadCategory: (lead as any).leadCategory ?? undefined,
              isApproved: lead.isApproved ?? false,
              isRejected: false,
              isHidden: false,
              isReserved: false,
            });
            inserted++;
          } catch {
            // swallow per-lead errors
          }
        }
      }
      console.log("[cron] Daily scraper complete:", inserted, "leads inserted");
    } catch {
      // swallow all errors so drip emails are not affected
    }
  }, 30 * 60 * 1000);
}

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
