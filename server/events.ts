/**
 * Event Window System
 * -------------------
 * Internal lead boost engine. Each row in event_window represents a major
 * recurring event for a city/region. The pipeline uses this table to:
 *
 *   1. Inject search_keyword_pack into collectors for that market
 *   2. Multiply the lead intent score by lead_boost_multiplier
 *   3. Surface time-limited filter chips in the artist browse page
 *
 * Windows auto-activate when today >= startDate - leadDays
 * and auto-deactivate when today > endDate.
 */

import { getDb } from "./db";
import { eventWindows } from "../drizzle/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";

// ─── Seed data ────────────────────────────────────────────────────────────────
// 28 major recurring events across all 12 US markets.
// Boost multipliers reflect how many high-intent leads typically surface
// during each event window (1.0 = baseline, 1.5 = 50% more priority).

export const EVENT_WINDOW_SEEDS: Array<Omit<typeof eventWindows.$inferInsert, "id" | "createdAt" | "updatedAt">> = [

  // ══════════════════════════════════════════════════════════════════════════
  // MIAMI — South Florida
  // ══════════════════════════════════════════════════════════════════════════
  {
    city: "Miami, FL",
    region: "South Florida",
    marketId: "miami",
    eventName: "Miami Music Week",
    filterLabel: "Miami Music Week",
    startDate: new Date("2026-03-23"),
    endDate: new Date("2026-03-29"),
    leadDays: 90,
    leadBoostMultiplier: "1.50",
    searchKeywordPack: [
      "Miami Music Week DJ", "MMW afterparty DJ", "MMW private event",
      "Miami Music Week rooftop", "MMW branded event", "WMC Miami DJ",
      "Miami Music Week pool party", "MMW corporate event", "MMW yacht party",
      "Miami Music Week hotel event", "MMW VIP event DJ",
    ],
    relevantPerformerTypes: ["dj", "hybrid_electronic", "immersive_experience", "solo_act"],
    activeStatus: true,
    eventYear: 2026,
    notes: "Biggest DJ week in the US. Extremely high lead volume. Boost to 1.5x.",
  },
  {
    city: "Miami, FL",
    region: "South Florida",
    marketId: "miami",
    eventName: "Ultra Music Festival",
    filterLabel: "Ultra Miami",
    startDate: new Date("2026-03-27"),
    endDate: new Date("2026-03-29"),
    leadDays: 90,
    leadBoostMultiplier: "1.40",
    searchKeywordPack: [
      "Ultra Music Festival DJ", "Ultra Miami afterparty", "Ultra week DJ",
      "Ultra Miami pool party", "Ultra private event", "Ultra Miami rooftop DJ",
      "Ultra branded activation DJ", "Ultra Miami hotel party",
    ],
    relevantPerformerTypes: ["dj", "hybrid_electronic", "immersive_experience"],
    activeStatus: true,
    eventYear: 2026,
    notes: "Overlaps with MMW. Separate window to capture Ultra-specific searches.",
  },
  {
    city: "Miami, FL",
    region: "South Florida",
    marketId: "miami",
    eventName: "Art Basel Miami Beach",
    filterLabel: "Art Basel Miami",
    startDate: new Date("2026-12-03"),
    endDate: new Date("2026-12-06"),
    leadDays: 90,
    leadBoostMultiplier: "1.40",
    searchKeywordPack: [
      "Art Basel Miami DJ", "Art Basel afterparty", "Art Week Miami DJ",
      "Art Basel private event", "Art Basel branded event", "Art Basel rooftop",
      "Art Basel yacht party", "Art Week Miami party", "Art Basel VIP event",
      "Art Basel corporate event DJ",
    ],
    relevantPerformerTypes: ["dj", "solo_act", "immersive_experience", "photo_video"],
    activeStatus: true,
    eventYear: 2026,
    notes: "High-budget corporate and gallery events. Premium lead quality.",
  },
  {
    city: "Miami, FL",
    region: "South Florida",
    marketId: "miami",
    eventName: "Calle Ocho Festival",
    filterLabel: "Calle Ocho",
    startDate: new Date("2026-03-08"),
    endDate: new Date("2026-03-08"),
    leadDays: 60,
    leadBoostMultiplier: "1.20",
    searchKeywordPack: [
      "Calle Ocho Festival performer", "Little Havana festival DJ",
      "Calle Ocho live music", "Calle Ocho band", "Calle Ocho singer",
    ],
    relevantPerformerTypes: ["dj", "solo_act", "small_band", "large_band", "singer"],
    activeStatus: true,
    eventYear: 2026,
    notes: "Latin music focus. Good for bands and singers.",
  },
  {
    city: "Fort Lauderdale, FL",
    region: "South Florida",
    marketId: "miami",
    eventName: "Fort Lauderdale International Boat Show",
    filterLabel: "FLIBS Fort Lauderdale",
    startDate: new Date("2026-10-28"),
    endDate: new Date("2026-11-01"),
    leadDays: 60,
    leadBoostMultiplier: "1.30",
    searchKeywordPack: [
      "Fort Lauderdale Boat Show DJ", "FLIBS afterparty", "yacht party DJ Fort Lauderdale",
      "boat show corporate event DJ", "Fort Lauderdale marina event",
    ],
    relevantPerformerTypes: ["dj", "solo_act", "small_band"],
    activeStatus: true,
    eventYear: 2026,
    notes: "High-net-worth crowd. Yacht and marina party leads.",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // LOS ANGELES / COACHELLA VALLEY
  // ══════════════════════════════════════════════════════════════════════════
  {
    city: "Indio, CA",
    region: "Greater Los Angeles",
    marketId: "la",
    eventName: "Coachella Valley Music & Arts Festival",
    filterLabel: "Coachella",
    startDate: new Date("2026-04-10"),
    endDate: new Date("2026-04-19"),
    leadDays: 120,
    leadBoostMultiplier: "1.50",
    searchKeywordPack: [
      "Coachella DJ", "Coachella afterparty DJ", "Coachella weekend private event",
      "Coachella pool party DJ", "Coachella branded event", "Coachella villa party",
      "Coachella VIP event DJ", "Coachella corporate event", "Coachella rooftop DJ",
      "Palm Springs DJ Coachella", "Indio DJ Coachella weekend",
    ],
    relevantPerformerTypes: ["dj", "hybrid_electronic", "solo_act", "immersive_experience"],
    activeStatus: true,
    eventYear: 2026,
    notes: "Two weekends. Massive private villa and brand activation market.",
  },
  {
    city: "Indio, CA",
    region: "Greater Los Angeles",
    marketId: "la",
    eventName: "Stagecoach Festival",
    filterLabel: "Stagecoach",
    startDate: new Date("2026-04-24"),
    endDate: new Date("2026-04-26"),
    leadDays: 90,
    leadBoostMultiplier: "1.20",
    searchKeywordPack: [
      "Stagecoach Festival country band", "Stagecoach afterparty",
      "Stagecoach weekend party", "country band Indio CA",
    ],
    relevantPerformerTypes: ["solo_act", "small_band", "large_band", "singer"],
    activeStatus: true,
    eventYear: 2026,
    notes: "Country music focus.",
  },
  {
    city: "Los Angeles, CA",
    region: "Greater Los Angeles",
    marketId: "la",
    eventName: "LA Pride",
    filterLabel: "LA Pride",
    startDate: new Date("2026-06-12"),
    endDate: new Date("2026-06-14"),
    leadDays: 60,
    leadBoostMultiplier: "1.25",
    searchKeywordPack: [
      "LA Pride DJ", "West Hollywood Pride DJ", "LA Pride party DJ",
      "Pride LA afterparty", "LA Pride performer", "WeHo Pride DJ",
    ],
    relevantPerformerTypes: ["dj", "solo_act", "immersive_experience", "singer"],
    activeStatus: true,
    eventYear: 2026,
    notes: "West Hollywood focus. High party volume.",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // LAS VEGAS
  // ══════════════════════════════════════════════════════════════════════════
  {
    city: "Las Vegas, NV",
    region: "Las Vegas Valley",
    marketId: "las_vegas",
    eventName: "EDC Las Vegas",
    filterLabel: "EDC Las Vegas",
    startDate: new Date("2026-05-15"),
    endDate: new Date("2026-05-17"),
    leadDays: 90,
    leadBoostMultiplier: "1.50",
    searchKeywordPack: [
      "EDC Las Vegas DJ", "EDC afterparty DJ", "EDC week Vegas",
      "Electric Daisy Carnival DJ", "EDC pool party DJ", "EDC Vegas rooftop",
      "EDC branded event DJ", "EDC private event Las Vegas",
    ],
    relevantPerformerTypes: ["dj", "hybrid_electronic", "immersive_experience"],
    activeStatus: true,
    eventYear: 2026,
    notes: "Electronic music capital. Highest DJ lead density of any US market.",
  },
  {
    city: "Las Vegas, NV",
    region: "Las Vegas Valley",
    marketId: "las_vegas",
    eventName: "CES Las Vegas",
    filterLabel: "CES Vegas",
    startDate: new Date("2026-01-06"),
    endDate: new Date("2026-01-09"),
    leadDays: 60,
    leadBoostMultiplier: "1.30",
    searchKeywordPack: [
      "CES Las Vegas DJ", "CES afterparty DJ", "CES corporate event entertainment",
      "CES conference party DJ", "CES Vegas band", "CES event emcee",
    ],
    relevantPerformerTypes: ["dj", "solo_act", "small_band", "emcee"],
    activeStatus: true,
    eventYear: 2026,
    notes: "Corporate tech crowd. High-budget events.",
  },
  {
    city: "Las Vegas, NV",
    region: "Las Vegas Valley",
    marketId: "las_vegas",
    eventName: "NAB Show",
    filterLabel: "NAB Show Vegas",
    startDate: new Date("2026-04-19"),
    endDate: new Date("2026-04-23"),
    leadDays: 60,
    leadBoostMultiplier: "1.20",
    searchKeywordPack: [
      "NAB Show Las Vegas DJ", "NAB afterparty", "NAB corporate event band",
      "media industry event DJ Las Vegas",
    ],
    relevantPerformerTypes: ["dj", "solo_act", "emcee"],
    activeStatus: true,
    eventYear: 2026,
    notes: "Broadcast/media industry. Corporate entertainment focus.",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // AUSTIN / SXSW
  // ══════════════════════════════════════════════════════════════════════════
  {
    city: "Austin, TX",
    region: "Central Texas",
    marketId: "dallas",
    eventName: "SXSW",
    filterLabel: "SXSW Austin",
    startDate: new Date("2026-03-13"),
    endDate: new Date("2026-03-22"),
    leadDays: 90,
    leadBoostMultiplier: "1.45",
    searchKeywordPack: [
      "SXSW DJ", "SXSW Austin party", "SXSW showcase DJ", "SXSW afterparty",
      "SXSW branded event DJ", "SXSW rooftop party", "SXSW private event",
      "SXSW corporate event Austin", "SXSW live music Austin",
    ],
    relevantPerformerTypes: ["dj", "solo_act", "small_band", "large_band", "hybrid_electronic"],
    activeStatus: true,
    eventYear: 2026,
    notes: "10-day festival. Massive brand activation and party market.",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CHICAGO
  // ══════════════════════════════════════════════════════════════════════════
  {
    city: "Chicago, IL",
    region: "Greater Chicago",
    marketId: "chicago",
    eventName: "Lollapalooza",
    filterLabel: "Lollapalooza",
    startDate: new Date("2026-07-30"),
    endDate: new Date("2026-08-02"),
    leadDays: 90,
    leadBoostMultiplier: "1.40",
    searchKeywordPack: [
      "Lollapalooza DJ Chicago", "Lolla afterparty DJ", "Lollapalooza private event",
      "Lollapalooza rooftop DJ", "Lolla weekend party Chicago",
      "Lollapalooza branded event", "Chicago festival DJ",
    ],
    relevantPerformerTypes: ["dj", "hybrid_electronic", "solo_act", "immersive_experience"],
    activeStatus: true,
    eventYear: 2026,
    notes: "Grant Park. Huge afterparty market across River North.",
  },
  {
    city: "Chicago, IL",
    region: "Greater Chicago",
    marketId: "chicago",
    eventName: "Chicago Jazz Festival",
    filterLabel: "Chicago Jazz Fest",
    startDate: new Date("2026-08-28"),
    endDate: new Date("2026-08-30"),
    leadDays: 60,
    leadBoostMultiplier: "1.20",
    searchKeywordPack: [
      "Chicago Jazz Festival musician", "Chicago jazz band hire",
      "Millennium Park jazz performer", "Chicago jazz singer",
    ],
    relevantPerformerTypes: ["solo_act", "small_band", "large_band", "singer", "instrumentalist"],
    activeStatus: true,
    eventYear: 2026,
    notes: "Jazz and classical focus.",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // NASHVILLE
  // ══════════════════════════════════════════════════════════════════════════
  {
    city: "Nashville, TN",
    region: "Middle Tennessee",
    marketId: "nashville",
    eventName: "CMA Fest",
    filterLabel: "CMA Fest Nashville",
    startDate: new Date("2026-06-04"),
    endDate: new Date("2026-06-07"),
    leadDays: 90,
    leadBoostMultiplier: "1.35",
    searchKeywordPack: [
      "CMA Fest Nashville DJ", "CMA Fest party", "Nashville country band hire",
      "CMA week private event", "CMA Fest afterparty DJ", "Nashville bachelorette DJ",
    ],
    relevantPerformerTypes: ["solo_act", "small_band", "large_band", "singer", "dj"],
    activeStatus: true,
    eventYear: 2026,
    notes: "Country music focus. Also huge bachelorette party market.",
  },
  {
    city: "Manchester, TN",
    region: "Middle Tennessee",
    marketId: "nashville",
    eventName: "Bonnaroo Music & Arts Festival",
    filterLabel: "Bonnaroo",
    startDate: new Date("2026-06-11"),
    endDate: new Date("2026-06-14"),
    leadDays: 90,
    leadBoostMultiplier: "1.25",
    searchKeywordPack: [
      "Bonnaroo DJ", "Bonnaroo afterparty", "Bonnaroo performer",
      "Bonnaroo camping party DJ", "Bonnaroo Tennessee",
    ],
    relevantPerformerTypes: ["dj", "solo_act", "small_band", "hybrid_electronic"],
    activeStatus: true,
    eventYear: 2026,
    notes: "Camping festival. Smaller private event market than urban festivals.",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ATLANTA
  // ══════════════════════════════════════════════════════════════════════════
  {
    city: "Atlanta, GA",
    region: "Metro Atlanta",
    marketId: "atlanta",
    eventName: "Music Midtown",
    filterLabel: "Music Midtown ATL",
    startDate: new Date("2026-09-19"),
    endDate: new Date("2026-09-20"),
    leadDays: 90,
    leadBoostMultiplier: "1.30",
    searchKeywordPack: [
      "Music Midtown Atlanta DJ", "Music Midtown afterparty",
      "Piedmont Park concert DJ", "Atlanta festival DJ",
    ],
    relevantPerformerTypes: ["dj", "solo_act", "small_band", "hybrid_electronic"],
    activeStatus: true,
    eventYear: 2026,
    notes: "Piedmont Park. Good afterparty market in Midtown.",
  },
  {
    city: "Atlanta, GA",
    region: "Metro Atlanta",
    marketId: "atlanta",
    eventName: "Atlanta Film Festival",
    filterLabel: "Atlanta Film Fest",
    startDate: new Date("2026-03-19"),
    endDate: new Date("2026-03-29"),
    leadDays: 60,
    leadBoostMultiplier: "1.15",
    searchKeywordPack: [
      "Atlanta Film Festival DJ", "ATLFF afterparty", "Atlanta film event DJ",
      "film industry party Atlanta",
    ],
    relevantPerformerTypes: ["dj", "solo_act", "immersive_experience"],
    activeStatus: true,
    eventYear: 2026,
    notes: "Film industry crowd. Smaller but high-quality leads.",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // NEW YORK
  // ══════════════════════════════════════════════════════════════════════════
  {
    city: "New York, NY",
    region: "New York Metro",
    marketId: "nyc",
    eventName: "NYC Pride",
    filterLabel: "NYC Pride",
    startDate: new Date("2026-06-26"),
    endDate: new Date("2026-06-28"),
    leadDays: 60,
    leadBoostMultiplier: "1.35",
    searchKeywordPack: [
      "NYC Pride DJ", "New York Pride party DJ", "NYC Pride afterparty",
      "Pride parade NYC DJ", "NYC Pride rooftop", "NYC Pride performer",
    ],
    relevantPerformerTypes: ["dj", "solo_act", "immersive_experience", "singer"],
    activeStatus: true,
    eventYear: 2026,
    notes: "Largest Pride event in the US. Massive party market.",
  },
  {
    city: "New York, NY",
    region: "New York Metro",
    marketId: "nyc",
    eventName: "Electric Zoo",
    filterLabel: "Electric Zoo NYC",
    startDate: new Date("2026-08-28"),
    endDate: new Date("2026-08-30"),
    leadDays: 90,
    leadBoostMultiplier: "1.35",
    searchKeywordPack: [
      "Electric Zoo NYC DJ", "EZoo afterparty DJ", "Electric Zoo private event",
      "Randall's Island DJ", "EZoo branded event",
    ],
    relevantPerformerTypes: ["dj", "hybrid_electronic", "immersive_experience"],
    activeStatus: true,
    eventYear: 2026,
    notes: "Electronic music. Randall's Island.",
  },
  {
    city: "New York, NY",
    region: "New York Metro",
    marketId: "nyc",
    eventName: "New York Fashion Week",
    filterLabel: "NYFW",
    startDate: new Date("2026-02-06"),
    endDate: new Date("2026-02-11"),
    leadDays: 60,
    leadBoostMultiplier: "1.40",
    searchKeywordPack: [
      "NYFW DJ", "New York Fashion Week afterparty DJ", "NYFW show DJ",
      "fashion week party NYC", "NYFW branded event DJ", "NYFW rooftop party",
    ],
    relevantPerformerTypes: ["dj", "immersive_experience", "solo_act"],
    activeStatus: true,
    eventYear: 2026,
    notes: "High-budget fashion industry events. Premium lead quality.",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // HOUSTON
  // ══════════════════════════════════════════════════════════════════════════
  {
    city: "Houston, TX",
    region: "Greater Houston",
    marketId: "houston",
    eventName: "Houston Livestock Show and Rodeo",
    filterLabel: "Houston Rodeo",
    startDate: new Date("2026-02-24"),
    endDate: new Date("2026-03-15"),
    leadDays: 60,
    leadBoostMultiplier: "1.25",
    searchKeywordPack: [
      "Houston Rodeo DJ", "Houston Rodeo entertainer", "NRG Stadium event DJ",
      "Houston Rodeo party", "Houston Rodeo afterparty",
    ],
    relevantPerformerTypes: ["dj", "solo_act", "small_band", "singer"],
    activeStatus: true,
    eventYear: 2026,
    notes: "3-week event. Long window = sustained lead volume.",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DALLAS
  // ══════════════════════════════════════════════════════════════════════════
  {
    city: "Dallas, TX",
    region: "Dallas-Fort Worth",
    marketId: "dallas",
    eventName: "State Fair of Texas",
    filterLabel: "State Fair Texas",
    startDate: new Date("2026-09-25"),
    endDate: new Date("2026-10-18"),
    leadDays: 60,
    leadBoostMultiplier: "1.20",
    searchKeywordPack: [
      "State Fair Texas DJ", "State Fair Dallas entertainer",
      "Fair Park Dallas performer", "Dallas fall event DJ",
    ],
    relevantPerformerTypes: ["dj", "solo_act", "small_band", "emcee"],
    activeStatus: true,
    eventYear: 2026,
    notes: "24-day run. Good for sustained lead volume.",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ORLANDO
  // ══════════════════════════════════════════════════════════════════════════
  {
    city: "Orlando, FL",
    region: "Central Florida",
    marketId: "orlando",
    eventName: "Orlando Fringe Festival",
    filterLabel: "Orlando Fringe",
    startDate: new Date("2026-05-14"),
    endDate: new Date("2026-05-24"),
    leadDays: 60,
    leadBoostMultiplier: "1.15",
    searchKeywordPack: [
      "Orlando Fringe DJ", "Orlando Fringe performer", "Loch Haven Park event",
      "Orlando arts festival performer",
    ],
    relevantPerformerTypes: ["solo_act", "immersive_experience", "singer", "instrumentalist"],
    activeStatus: true,
    eventYear: 2026,
    notes: "Arts focus. Smaller market but good for unique performers.",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // PHOENIX
  // ══════════════════════════════════════════════════════════════════════════
  {
    city: "Phoenix, AZ",
    region: "Valley of the Sun",
    marketId: "phoenix",
    eventName: "McDowell Mountain Music Festival",
    filterLabel: "M3F Phoenix",
    startDate: new Date("2026-02-27"),
    endDate: new Date("2026-03-01"),
    leadDays: 60,
    leadBoostMultiplier: "1.20",
    searchKeywordPack: [
      "M3F Phoenix DJ", "McDowell Mountain Music Festival",
      "Phoenix music festival DJ", "Phoenix spring festival DJ",
    ],
    relevantPerformerTypes: ["dj", "solo_act", "hybrid_electronic"],
    activeStatus: true,
    eventYear: 2026,
    notes: "Charity festival. Smaller but growing market.",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // WASHINGTON DC
  // ══════════════════════════════════════════════════════════════════════════
  {
    city: "Washington, DC",
    region: "DC Metro",
    marketId: "dc",
    eventName: "National Cherry Blossom Festival",
    filterLabel: "Cherry Blossom DC",
    startDate: new Date("2026-03-20"),
    endDate: new Date("2026-04-13"),
    leadDays: 60,
    leadBoostMultiplier: "1.20",
    searchKeywordPack: [
      "Cherry Blossom Festival DC DJ", "Cherry Blossom event Washington",
      "DC spring festival performer", "Tidal Basin event DJ",
    ],
    relevantPerformerTypes: ["dj", "solo_act", "small_band", "singer"],
    activeStatus: true,
    eventYear: 2026,
    notes: "3-week spring festival. Good for outdoor event leads.",
  },
  {
    city: "Washington, DC",
    region: "DC Metro",
    marketId: "dc",
    eventName: "DC Pride",
    filterLabel: "DC Pride",
    startDate: new Date("2026-06-06"),
    endDate: new Date("2026-06-07"),
    leadDays: 60,
    leadBoostMultiplier: "1.25",
    searchKeywordPack: [
      "DC Pride DJ", "Washington DC Pride party DJ", "Capital Pride performer",
      "DC Pride afterparty", "DC Pride rooftop",
    ],
    relevantPerformerTypes: ["dj", "solo_act", "immersive_experience", "singer"],
    activeStatus: true,
    eventYear: 2026,
    notes: "Capital Pride. Good party market.",
  },
];

// ─── DB helpers ───────────────────────────────────────────────────────────────

/** Seed the event_window table if it's empty */
export async function seedEventWindowsIfEmpty(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select({ id: eventWindows.id }).from(eventWindows).limit(1);
  if (existing.length > 0) return;

  console.log("[Events] Seeding event_window table...");
  for (const evt of EVENT_WINDOW_SEEDS) {
    await db.insert(eventWindows).values(evt);
  }
  console.log(`[Events] Seeded ${EVENT_WINDOW_SEEDS.length} event windows.`);
}

/**
 * Returns event windows currently in their visibility window:
 *   startDate - leadDays  <=  today  <=  endDate
 * Optionally filtered by marketId.
 */
export async function getActiveEventWindows(marketId?: string): Promise<typeof eventWindows.$inferSelect[]> {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const conditions: ReturnType<typeof eq>[] = [
    eq(eventWindows.activeStatus, true),
    gte(eventWindows.endDate, now),
    sql`DATE_SUB(${eventWindows.startDate}, INTERVAL ${eventWindows.leadDays} DAY) <= ${now}` as any,
  ];
  if (marketId) {
    conditions.push(eq(eventWindows.marketId, marketId) as any);
  }
  return db.select().from(eventWindows).where(and(...conditions));
}

/** Returns all event windows (admin view), ordered by start date */
export async function getAllEventWindows(): Promise<typeof eventWindows.$inferSelect[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(eventWindows).orderBy(eventWindows.startDate);
}

/**
 * Returns event windows active within the next `days` days for a given market.
 * Used by the scraper to inject keyword packs and apply boost multipliers.
 */
export async function getUpcomingWindowsForMarket(
  marketId: string,
  days = 90
): Promise<typeof eventWindows.$inferSelect[]> {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const horizon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return db
    .select()
    .from(eventWindows)
    .where(
      and(
        eq(eventWindows.marketId, marketId),
        eq(eventWindows.activeStatus, true),
        gte(eventWindows.endDate, now),
        lte(eventWindows.startDate, horizon)
      )
    );
}
