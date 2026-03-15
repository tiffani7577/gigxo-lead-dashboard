/**
 * scraper-pipeline.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Modular lead pipeline: normalized RawLeadDoc from each collector → filter →
 * trash/valid routing → ScrapedLead for gigLeads.
 *
 * - Uses RawLeadDoc (see raw-lead-doc.ts) so all sources map into one shape.
 * - Source config: only runs collectors that are enabled (explorerSourceToggles).
 * - Trash routing: obvious junk (negative keyword, intent rejected) is separated
 *   from valid opportunities; only valid docs become leads.
 *
 * Backward compatible: same PipelineResult and runScraperPipeline(city?, performerType?)
 * so admin "Fetch Leads" and insert flow are unchanged.
 */

import { runRedditCollector, runRedditCollectorForLiveSearch, type RawDoc } from "./reddit-collector";
import { collectFromEventbrite } from "./eventbrite-collector";
import { collectFromCraigslistRss } from "./craigslist-collector";
import { collectFromDbpr } from "./dbpr-collector";
import { collectFromSunbiz } from "./sunbiz-collector";
import { collectFromApify, cityFromPostText } from "./apify-collector";
import { getEnabledLeadSourceKeys } from "./source-config";
import type { RawLeadDoc } from "./raw-lead-doc";
import { extractContactFromRawLeadDoc } from "../contact-extraction";

// Re-export for backward compat and for future collectors
export type { RawDoc };
export type { RawLeadDoc } from "./raw-lead-doc";
export type { SourceType } from "./raw-lead-doc";

export interface PipelineStats {
  collected: number;
  filtered: number;        // passed local intent gate (valid)
  classified: number;      // number of leads returned
  inserted: number;        // new rows added to gigLeads (set in router)
  skipped: number;        // duplicates (externalId already exists)
  errors: number;
  phraseRejected: number;  // kept for backwards compat (unused by new logic)
  scoreRejected: number;  // kept for backwards compat (unused by new logic)
  negativeRejected: number; // trash: rejected by negative keyword filter
  intentRejected: number;  // trash: rejected by intent gate
  /** Total docs routed to trash (negativeRejected + intentRejected); separated from usable opportunities */
  trashCount: number;
}

export interface PipelineResult {
  stats: PipelineStats;
  docs: RawDoc[];        // all raw docs (for admin log view; backward compat)
  leads: ScrapedLead[];  // ready-to-insert lead objects (valid only; trash not inserted)
  sourceCounts: Record<string, number>; // per-source lead counts (reddit, eventbrite, craigslist, other)
  /** Total Apify run cost in USD (sum of actor run costs). */
  apifyCostUsd?: number;
}

// Shape that maps to your gigLeads INSERT (same as the old pipeline output)
export interface ScrapedLead {
  externalId: string;
  source: "reddit" | "manual" | "gigsalad" | "eventbrite" | "facebook" | "thebash" | "craigslist" | "gigxo" | "dbpr" | "sunbiz";
  sourceLabel: string;
  title: string;
  description: string;
  eventType: string;
  budget: number | null;         // cents, null = unknown
  location: string;
  latitude: number | null;
  longitude: number | null;
  eventDate: Date | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  venueUrl: string;
  performerType: string;
  intentScore: number;           // 0-100 from AI classifier
  isApproved: boolean;           // false = goes to admin approval queue
  leadType?: "scraped_signal" | "client_submitted" | "venue_intelligence" | "referral" | "manual_outreach";
  leadCategory?: "general" | "wedding" | "corporate" | "private_party" | "club" | "other" | "venue_intelligence";
}

// ─── Intent classifier (lightweight local version) ────────────────────────────
// This runs BEFORE the LLM scorer to skip obvious non-leads cheaply.
// Your existing server/scoring.ts LLM classifier runs after this for the good ones.

// News/celebrity/sports junk
const NEGATIVE_KEYWORDS = [
  "khaled",
  "akademiks",
  "nfl",
  "dolphins",
  "coach",
  "linebacker",
  "gm",
  "general manager",
  "assistant coach",
  "net worth",
  "album",
  "sneakers",
  "bills",
  "ucla",
];

// DJ gear/software/production discussion — not hiring leads
const GEAR_SOFTWARE_NEGATIVE_KEYWORDS = [
  "controller",
  "cdj",
  "mixer",
  "serato",
  "rekordbox",
  "traktor",
  "software",
  "plugin",
  "headphones",
  "speaker",
  "monitors",
  "audio interface",
  "turntable",
  "equipment",
  "gear",
  "pcdj",
  "compatible",
  "laptop",
  "soundcard",
];

const ALL_NEGATIVE_KEYWORDS = [...NEGATIVE_KEYWORDS, ...GEAR_SOFTWARE_NEGATIVE_KEYWORDS];

// Junk doc patterns: Google RSS/article style, URL titles, sports/news hiring (not entertainment)
function isJunkDoc(doc: RawLeadDoc): boolean {
  const title = (doc.title ?? "").trim();
  const text = (doc.rawText ?? "").trim();
  const combined = `${title} ${text}`.toLowerCase();

  // Title is a URL or mostly a URL
  if (/^https?:\/\//i.test(title)) return true;
  if (title.length > 35 && (title.includes(".com") || title.includes(".org") || title.includes(".net")) && title.split(/\s+/).length <= 2) return true;

  // Article/news source suffix in title or text
  const articleSuffix = /\s*[-|]\s*(Google Alerts|Reuters|ESPN|CNN|Yahoo|Fox News|NBC|CBS|USA Today|Washington Post|NPR|BBC|The Guardian|HuffPost|BuzzFeed|Vice|Axios|Politico|CNBC|MarketWatch|Forbes|Bloomberg|AP News|Associated Press|Sports Illustrated|Bleacher Report)/i;
  if (articleSuffix.test(title) || articleSuffix.test(text)) return true;

  // Sports/news hiring context (hire + coach, GM, team, reporter, etc.) — not entertainment booking
  const hasHire = /\bhire(s|d|ing)?\b/.test(combined);
  const sportsNewsHiring = /\b(coach|gm\b|general manager|assistant coach|head coach|nfl|nba|mlb|quarterback|linebacker|bills\b|dolphins\b|news\b|reporter|editor\b|writer\b|journalist|sport(s)?\b|team\s+hiring|front\s+office)/i.test(combined);
  if (hasHire && sportsNewsHiring) return true;

  return false;
}

const DJ_HIRING_PHRASES = [
  "need a dj",
  "looking for a dj",
  "hire a dj",
  "hiring a dj",
  "dj for my wedding",
  "dj for wedding",
  "dj for my party",
  "dj for party",
  "dj recommendations",
  "can anyone recommend a dj",
  "looking to book a dj",
  "book a dj",
  "wedding dj",
  "party dj",
  "need wedding dj",
  "need dj in miami",
  "recommend a wedding dj",
  "recommend a dj",
  "dj recommendation",
  "any good dj",
  "best wedding dj",
  "wedding dj recommendations",
];

/** High-intent transactional booking phrases: +25 to intent_score when present. */
export const TRANSACTIONAL_BOOKING_KEYWORDS = [
  "looking for dj",
  "need a dj",
  "hire a dj",
  "dj for wedding",
  "dj for birthday party",
  "dj for corporate event",
  "dj needed",
  "wedding dj needed",
  "event dj needed",
  "dj available tonight",
  "band for wedding",
  "live band needed",
  "hire a band",
  "musician for event",
  "wedding band needed",
];

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasNegativeKeyword(normalized: string): boolean {
  return ALL_NEGATIVE_KEYWORDS.some((kw) => normalized.includes(kw));
}

function hasNegativeKeywordWithList(normalized: string, keywordList: string[]): boolean {
  return keywordList.some((kw) => normalized.includes(normalizeText(kw)));
}

function hasDjHiringPhraseNormalized(normalized: string): boolean {
  return DJ_HIRING_PHRASES.some((phrase) => normalized.includes(phrase));
}

function hasTransactionalBookingPhrase(normalized: string): boolean {
  return TRANSACTIONAL_BOOKING_KEYWORDS.some((phrase) => normalized.includes(phrase));
}

/** In-memory classification for scoring only (no schema). If "conversation", apply -10 to intent. */
type LeadTypeClassification = "client_request" | "venue_opportunity" | "artist_referral" | "conversation";

function classifyLeadTypeForScoring(normalized: string): LeadTypeClassification {
  if (hasTransactionalBookingPhrase(normalized) || hasDjHiringPhraseNormalized(normalized)) return "client_request";
  if (/\b(venue|event\s*space|restaurant|bar|club|rooftop|ballroom)\b/.test(normalized) && /\b(looking|need|hire|book|entertainment)\b/.test(normalized)) return "venue_opportunity";
  if (/\b(referral|referred|recommend|recommendation)\b/.test(normalized)) return "artist_referral";
  return "conversation";
}

function hasIncludePhraseWithList(normalized: string, phraseList: string[]): boolean {
  return phraseList.some((p) => normalized.includes(normalizeText(p)));
}

function localIntentScoreFromNormalized(normalized: string): number {
  if (hasNegativeKeyword(normalized)) return 0;
  if (hasDjHiringPhraseNormalized(normalized)) return 80;
  if (hasTransactionalBookingPhrase(normalized)) return 60; // +25 applied later in rawLeadDocToLead
  return 0;
}

function localIntentScoreWithLists(normalized: string, negativeList: string[], includeList: string[]): number {
  if (hasNegativeKeywordWithList(normalized, negativeList)) return 0;
  if (hasIncludePhraseWithList(normalized, includeList)) return 80;
  return 0;
}

/** Single gate for "should this doc become a lead?". Used by the main loop. */
function shouldPassIntentGate(text: string): boolean {
  const normalized = normalizeText(text);
  if (hasNegativeKeyword(normalized)) return false;
  const score = localIntentScoreFromNormalized(normalized);
  const hasIntentPhrase = hasDjHiringPhraseNormalized(normalized) || hasTransactionalBookingPhrase(normalized);
  return hasIntentPhrase && score >= 40;
}

function shouldPassIntentGateWithLists(text: string, negativeList: string[], includeList: string[]): boolean {
  const normalized = normalizeText(text);
  if (hasNegativeKeywordWithList(normalized, negativeList)) return false;
  const score = localIntentScoreWithLists(normalized, negativeList, includeList);
  return hasIncludePhraseWithList(normalized, includeList) && score >= 40;
}

// ─── Event type classifier ────────────────────────────────────────────────────

function classifyEventType(text: string): string {
  const lower = text.toLowerCase();
  if (lower.match(/wedding|bride|groom|bridal|reception/)) return "Wedding";
  if (lower.match(/quincea[ñn]era|quince/)) return "Quinceañera";
  if (lower.match(/sweet\s*16|sweet sixteen/)) return "Sweet 16";
  if (lower.match(/birthday|bday|b-day/)) return "Birthday Party";
  if (lower.match(/corporate|office|company|business|gala/)) return "Corporate Event";
  if (lower.match(/bachelorette|bachelor/)) return "Bachelorette Party";
  if (lower.match(/graduation|grad party/)) return "Graduation Party";
  if (lower.match(/yacht|boat/)) return "Yacht Party";
  if (lower.match(/pool party|poolside/)) return "Pool Party";
  if (lower.match(/nightclub|club night|night club/)) return "Nightclub";
  if (lower.match(/charity|fundraiser|nonprofit/)) return "Charity Event";
  if (lower.match(/bar\s+mitzvah|bat\s+mitzvah/)) return "Bar/Bat Mitzvah";
  if (lower.match(/anniversary/)) return "Anniversary Party";
  if (lower.match(/rooftop/)) return "Rooftop Party";
  return "Private Party";
}

// ─── Performer type classifier ────────────────────────────────────────────────

function classifyPerformerType(text: string): string {
  const lower = text.toLowerCase();
  if (lower.match(/photographer|photography|photo shoot|headshots|portraits/)) return "photographer";
  if (lower.match(/videographer|videography|video production|video shoot|filming/)) return "videographer";
  if (lower.match(/audio engineer|sound engineer|sound tech|mixing|mastering|audio production/)) return "audio_engineer";
  if (lower.match(/live band|band for|5[- ]piece|4[- ]piece|jazz quartet|jazz trio/)) return "small_band";
  if (lower.match(/acoustic|singer|vocalist|voice/)) return "singer";
  if (lower.match(/electronic act|live electronic|hybrid|synth/)) return "hybrid_electronic";
  return "dj"; // default — most leads are DJ requests
}

// ─── Budget extractor ─────────────────────────────────────────────────────────

function extractBudgetCents(text: string): number | null {
  // Match "$1,500", "$500", "1500", "$1.5k", "$2k", "budget of $800"
  const patterns = [
    /\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:k|K)?/,
    /budget[^\d$]*\$?(\d{1,5})/i,
    /(\d{3,5})\s*(?:dollars|bucks|USD)/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) {
      let val = parseFloat(m[1].replace(/,/g, ""));
      if (text.match(/k\b/i) && val < 100) val *= 1000; // "2k" → 2000
      if (val > 50 && val < 100000) return Math.round(val * 100); // store cents
    }
  }
  return null;
}

// ─── Location resolver (lat/lng for South Florida cities) ────────────────────

const CITY_COORDS: Record<string, [number, number]> = {
  "Fort Lauderdale, FL":   [26.1224, -80.1373],
  "Miami, FL":             [25.7617, -80.1918],
  "Miami Beach, FL":       [25.7825, -80.1300],
  "Boca Raton, FL":        [26.3683, -80.1289],
  "West Palm Beach, FL":   [26.7153, -80.0534],
  "Broward County, FL":    [26.1901, -80.3659],
  "Coral Gables, FL":      [25.7215, -80.2684],
  "Hollywood, FL":         [26.0112, -80.1495],
  "Doral, FL":             [25.8195, -80.3553],
  "Hialeah, FL":           [25.8576, -80.2781],
};

function resolveCoords(city: string | null): [number | null, number | null] {
  if (!city) return [null, null];
  const match = Object.entries(CITY_COORDS).find(([k]) =>
    city.toLowerCase().includes(k.split(",")[0].toLowerCase())
  );
  return match ? match[1] : [null, null];
}

// ─── Reddit RawDoc → RawLeadDoc (adapter for normalized shape) ─────────────────

function redditRawDocToRawLeadDoc(doc: RawDoc): RawLeadDoc {
  const title = doc.rawText.split("\n")[0]?.slice(0, 512) ?? "";
  return {
    externalId: doc.externalId,
    source: doc.source,
    sourceType: "reddit",
    sourceLabel: doc.sourceLabel,
    title,
    rawText: doc.rawText,
    url: doc.url,
    postedAt: doc.postedAt,
    city: doc.city,
    metadata: { subreddit: doc.subreddit },
  };
}

// ─── Contact completeness (gate + scoring) ──────────────────────────────────────

/** True if venueUrl looks like a real business website, not the source post URL (reddit/facebook/eventbrite etc.). Exported for router (Tier 2 enrichment). */
export function isRealWebsiteUrl(venueUrl: string, venueUrlSource: string | undefined): boolean {
  if (!venueUrl || !venueUrl.trim()) return false;
  if (venueUrlSource === "docUrl") return false;
  const lower = venueUrl.toLowerCase();
  const sourceDomains = ["reddit.com", "facebook.com", "eventbrite.com", "craigslist.org", "nextdoor.com", "thebash.com", "gigsalad.com", "thumbtack.com", "yelp.com"];
  return !sourceDomains.some((d) => lower.includes(d));
}

/** Sources allowed for Tier 2 (no contact but high intent → insert pending enrichment). */
const TIER2_SOURCES = new Set([
  "reddit", "apify", "facebook", "twitter", "linkedin", "bark", "thumbtack", "eventbrite", "google_serp",
]);

function isTier2Source(lead: ScrapedLead): boolean {
  const src = (lead as { source?: string }).source ?? lead.source;
  if (TIER2_SOURCES.has(src)) return true;
  if (lead.sourceLabel?.startsWith("Apify ")) return true;
  return false;
}

/** True if lead has at least one usable contact signal (for insert gate). DBPR and inbound bypass in caller. */
function passesContactGate(lead: ScrapedLead): boolean {
  if (lead.contactEmail && String(lead.contactEmail).trim()) return true;
  if (lead.contactPhone && String(lead.contactPhone).trim()) return true;
  const venueSrc = (lead as any)._venueUrlSource;
  if (lead.venueUrl && String(lead.venueUrl).trim() && isRealWebsiteUrl(lead.venueUrl, venueSrc)) return true;
  if (lead.contactName && String(lead.contactName).trim() && lead.location && String(lead.location).trim()) return true;
  return false;
}

/** South Florida geo tokens for non-DBPR leads; location must contain one of these if populated. */
const SOUTH_FLORIDA_GEO_TOKENS = [
  "miami", "fort lauderdale", "broward", "boca raton", "palm beach", "west palm", "doral", "hialeah",
  "coral gables", "wynwood", "brickell", "aventura", "pompano", "hollywood", "hallandale", "kendall",
  "homestead", "coral springs", "pembroke pines", "sunrise", "plantation", "davie", "weston",
  "miramar", "deerfield", "delray", "boynton",
];

function passesGeoFilter(location: string | null | undefined): boolean {
  const loc = (location ?? "").trim();
  if (!loc) return true;
  const lower = loc.toLowerCase();
  return SOUTH_FLORIDA_GEO_TOKENS.some((token) => lower.includes(token));
}

function postedAtWithin30OrNull(postedAt: Date | string | null | undefined): boolean {
  if (postedAt == null) return true;
  const d = new Date(postedAt);
  if (isNaN(d.getTime())) return true;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  return Date.now() - d.getTime() <= thirtyDaysMs;
}

// ─── RawLeadDoc → ScrapedLead ──────────────────────────────────────────────────

/** Exported for admin.runDbprPipeline: convert RawLeadDoc (e.g. from collectFromDbpr) to ScrapedLead for gigLeads insert. */
export function rawLeadDocToLead(doc: RawLeadDoc, baseIntentScore: number): ScrapedLead {
  // Only use Miami/Fort Lauderdale when post text contains a South Florida keyword; otherwise null so it doesn't show as a Miami lead.
  const effectiveCity = cityFromPostText(doc.rawText);
  const location = effectiveCity ?? "";
  const [lat, lng] = resolveCoords(effectiveCity);

  let source: ScrapedLead["source"] = "gigxo";
  if (doc.sourceType === "reddit" || doc.source === "reddit") source = "reddit";
  else if (doc.sourceType === "eventbrite" || doc.source === "eventbrite") source = "eventbrite";
  else if (doc.sourceType === "craigslist" || doc.source === "craigslist") source = "craigslist";
  else if (doc.sourceType === "dbpr" || doc.source === "dbpr") source = "dbpr";
  else if (doc.sourceType === "sunbiz" || doc.source === "sunbiz") source = "sunbiz";

  const subredditHint = (doc.metadata?.subreddit as string) ?? (doc.sourceType === "reddit" ? doc.sourceLabel.replace(/^Reddit r\//i, "").trim() : "");

  const extractedContact = extractContactFromRawLeadDoc(doc);

  // Venue URL precedence:
  // 1) doc.contact.website (if some collector populates it in the future)
  // 2) metadata website/venueUrl (source-specific metadata)
  // 3) extractedContact.website from rawText/metadata
  // 4) original doc.url (source page)
  let venueUrlSource: "contact" | "metadata" | "extracted" | "docUrl" = "docUrl";
  let venueUrl = doc.url;

  const contactWebsite = (doc as any).contact?.website as string | undefined;
  const metadata = doc.metadata as any;
  const metadataWebsite =
    (metadata && typeof metadata.venueUrl === "string" && metadata.venueUrl) ||
    (metadata && typeof metadata.website === "string" && metadata.website) ||
    (metadata && typeof metadata.websiteUrl === "string" && metadata.websiteUrl) ||
    null;

  if (contactWebsite && contactWebsite.trim()) {
    venueUrl = contactWebsite.trim();
    venueUrlSource = "contact";
  } else if (metadataWebsite && metadataWebsite.trim()) {
    venueUrl = metadataWebsite.trim();
    venueUrlSource = "metadata";
  } else if (extractedContact.website && extractedContact.website.trim()) {
    venueUrl = extractedContact.website.trim();
    venueUrlSource = "extracted";
  } else {
    venueUrl = doc.url;
    venueUrlSource = "docUrl";
  }

  // ── Intent score adjustments (source, contactability, recency) ───────────────

  let intentScore = baseIntentScore;

  // Source weighting
  if (source === "reddit" || source === "craigslist") {
    intentScore += 10; // active need in many cases
  } else if (source === "eventbrite") {
    intentScore += 5; // event-related, but not always direct demand
  } else if (source === "dbpr" || source === "sunbiz") {
    intentScore -= 5; // venue intelligence, not explicit immediate demand
  }

  const hasEmail = !!(doc.contact?.email || extractedContact.email);
  const hasPhone = !!(doc.contact?.phone || extractedContact.phone);
  const hasBusinessVenueUrl = venueUrlSource === "contact" || venueUrlSource === "metadata" || venueUrlSource === "extracted";
  const hasRealWebsite = !!venueUrl.trim() && isRealWebsiteUrl(venueUrl, venueUrlSource);
  const hasContactName = !!(doc.contact?.name ?? extractedContact.name);
  const hasAnyContact = hasEmail || hasPhone || hasBusinessVenueUrl;

  // Contact completeness bonus (stacks; enriched leads rise to top)
  if (hasEmail) intentScore += 15;
  if (hasPhone) intentScore += 10;
  if (hasRealWebsite) intentScore += 8;
  if (hasContactName) intentScore += 5;

  // Penalty for missing all contact methods, except for pure venue intelligence
  const isVenueIntelSource =
    doc.sourceType === "dbpr" || doc.sourceType === "sunbiz" || doc.metadata?.leadType === "venue_intelligence";
  if (!hasAnyContact && !isVenueIntelSource) {
    intentScore -= 15;
  }

  // Recency (where postedAt exists, e.g. Reddit/Craigslist/Eventbrite)
  if (doc.postedAt) {
    const ageMs = Date.now() - new Date(doc.postedAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays <= 3) intentScore += 8;
    else if (ageDays <= 7) intentScore += 5;
    else if (ageDays > 60) intentScore -= 5;
  }

  // Transactional booking keyword boost (+25)
  const normalizedForBoost = normalizeText(doc.rawText);
  if (hasTransactionalBookingPhrase(normalizedForBoost)) intentScore += 25;

  // Lead type classification (in-memory): conversation gets -10
  const classification = classifyLeadTypeForScoring(normalizedForBoost);
  if (classification === "conversation") intentScore -= 10;

  // Clamp to [0, 100]
  if (intentScore < 0) intentScore = 0;
  if (intentScore > 100) intentScore = 100;

  const base: ScrapedLead = {
    externalId: doc.externalId,
    source,
    sourceLabel: doc.sourceLabel,
    title: doc.title.slice(0, 255),
    description: buildDescriptionFromRawLeadDoc(doc, subredditHint),
    eventType: classifyEventType(doc.rawText),
    budget: extractBudgetCents(doc.rawText),
    location,
    latitude: lat,
    longitude: lng,
    eventDate: null,
    contactName: doc.contact?.name ?? extractedContact.name ?? null,
    contactEmail: doc.contact?.email ?? extractedContact.email ?? null,
    contactPhone: doc.contact?.phone ?? extractedContact.phone ?? null,
    venueUrl,
    performerType: classifyPerformerType(doc.rawText),
    intentScore,
    isApproved: false,
  };

  // Keep some provenance for stats/logging; not persisted to DB.
  (base as any)._venueUrlSource = venueUrlSource;

  const isVenueIntelDoc =
    doc.sourceType === "dbpr" ||
    doc.source === "dbpr" ||
    doc.sourceType === "sunbiz" ||
    doc.source === "sunbiz" ||
    doc.metadata?.leadType === "venue_intelligence";
  if (isVenueIntelDoc) {
    base.leadType = "venue_intelligence";
    base.leadCategory = "venue_intelligence";
  } else {
    base.leadType = (doc.metadata?.leadType as string) ?? base.leadType ?? "scraped_signal";
    base.leadCategory = (doc.metadata?.leadCategory as string) ?? base.leadCategory ?? "general";
  }

  return base;
}

function buildDescriptionFromRawLeadDoc(doc: RawLeadDoc, subredditHint: string): string {
  const lines = doc.rawText.split("\n").slice(1).join(" ").trim();
  const desc =
    lines.length > 20
      ? lines.slice(0, 1000)
      : subredditHint
        ? `Posted on Reddit r/${subredditHint}. See original post for details.`
        : "See original listing for details.";
  return `${desc}\n\nSource: ${doc.url}`;
}

// ─── RawLeadDoc → legacy RawDoc for backward-compat return ─────────────────────

function rawLeadDocToLegacyDoc(doc: RawLeadDoc): RawDoc {
  return {
    externalId: doc.externalId,
    // Preserve the original normalized source string for legacy/debug consumers.
    source: doc.source as any,
    sourceLabel: doc.sourceLabel,
    rawText: doc.rawText,
    url: doc.url,
    postedAt: doc.postedAt,
    city: doc.city,
    subreddit: (doc.metadata?.subreddit as string) ?? doc.source,
  };
}

/** Optional pipeline config (e.g. excludeSources for cron that should not run DBPR). */
export interface RunScraperPipelineOptions {
  excludeSources?: string[];
}

// ─── Main pipeline entry point ────────────────────────────────────────────────

export async function runScraperPipeline(
  city?: string,
  performerType?: string,
  options?: RunScraperPipelineOptions
): Promise<PipelineResult> {
  const stats: PipelineStats = {
    collected: 0,
    filtered: 0,
    classified: 0,
    inserted: 0,
    skipped: 0,
    errors: 0,
    phraseRejected: 0,
    scoreRejected: 0,
    negativeRejected: 0,
    intentRejected: 0,
    trashCount: 0,
  };

  // Step 1 — Which sources are enabled (source config), minus any excluded by options
  const enabledKeysRaw = await getEnabledLeadSourceKeys();
  const excludeSet = new Set(options?.excludeSources ?? []);
  const enabledKeys = enabledKeysRaw.filter((k) => !excludeSet.has(k));

  // Step 2 — Collect only from enabled sources (modular collectors → RawLeadDoc)
  const collectorPromises: Promise<RawLeadDoc[]>[] = [];
  if (enabledKeys.includes("reddit")) {
    collectorPromises.push(
      runRedditCollector(city, performerType).then((raw) => raw.map(redditRawDocToRawLeadDoc))
    );
  } else {
    collectorPromises.push(Promise.resolve([]));
  }
  if (enabledKeys.includes("eventbrite")) {
    collectorPromises.push(collectFromEventbrite());
  } else {
    collectorPromises.push(Promise.resolve([]));
  }
  if (enabledKeys.includes("craigslist")) {
    collectorPromises.push(collectFromCraigslistRss());
  } else {
    collectorPromises.push(Promise.resolve([]));
  }
  if (enabledKeys.includes("dbpr")) {
    collectorPromises.push(collectFromDbpr());
  } else {
    collectorPromises.push(Promise.resolve([]));
  }
  if (enabledKeys.includes("sunbiz")) {
    collectorPromises.push(collectFromSunbiz());
  } else {
    collectorPromises.push(Promise.resolve([]));
  }
  if (enabledKeys.includes("apify")) {
    collectorPromises.push(collectFromApify());
  } else {
    collectorPromises.push(Promise.resolve({ docs: [], apifyCostUsd: 0 }));
  }

  const [redditDocs, eventbriteDocs, craigslistDocs, dbprDocs, sunbizDocs, apifyResult] = await Promise.all(collectorPromises);
  const apifyDocs = Array.isArray(apifyResult) ? apifyResult : apifyResult.docs;
  const apifyCostUsd = Array.isArray(apifyResult) ? 0 : (apifyResult.apifyCostUsd ?? 0);
  const allDocs: RawLeadDoc[] = [
    ...redditDocs,
    ...eventbriteDocs,
    ...craigslistDocs,
    ...dbprDocs,
    ...sunbizDocs,
    ...apifyDocs,
  ];

  console.log("[scraper-pipeline] Raw docs collected by source (enabled only):", {
    reddit: redditDocs.length,
    eventbrite: eventbriteDocs.length,
    craigslist: craigslistDocs.length,
    dbpr: dbprDocs.length,
    sunbiz: sunbizDocs.length,
    apify: apifyDocs.length,
    enabledKeys,
  });

  stats.collected = allDocs.length;

  // Step 3 — Trash/valid routing: negative filter + intent gate; three-tier contact gate
  // Venue intelligence (DBPR, Sunbiz) bypass intent gate — they are records, not demand posts
  const leads: ScrapedLead[] = [];
  let tier1Count = 0;
  let tier2Count = 0;
  let tier3RejectedCount = 0;
  for (const doc of allDocs) {
    try {
      const isVenueIntel =
        doc.sourceType === "dbpr" ||
        doc.source === "dbpr" ||
        doc.sourceType === "sunbiz" ||
        doc.source === "sunbiz" ||
        doc.metadata?.leadType === "venue_intelligence";
      if (isVenueIntel) {
        const lead = rawLeadDocToLead(doc, 50);
        leads.push(lead);
        stats.filtered++;
        continue;
      }
      const normalized = normalizeText(doc.rawText);
      if (isJunkDoc(doc)) {
        stats.negativeRejected++;
        continue;
      }
      if (hasNegativeKeyword(normalized)) {
        stats.negativeRejected++;
        continue;
      }
      if (!shouldPassIntentGate(doc.rawText)) {
        stats.intentRejected++;
        continue;
      }
      const baseIntentScore = localIntentScoreFromNormalized(normalized);
      const lead = rawLeadDocToLead(doc, baseIntentScore);

      // Non-DBPR only: age filter — skip if postedAt older than 60 days
      const postedAt = doc.postedAt != null ? new Date(doc.postedAt) : null;
      if (postedAt && !isNaN(postedAt.getTime())) {
        const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
        if (Date.now() - postedAt.getTime() > sixtyDaysMs) {
          console.log("[pipeline] Rejected stale:", lead.title);
          continue;
        }
      }

      // Non-DBPR only: geo filter — skip if location populated and not in South Florida
      if (lead.location && String(lead.location).trim() && !passesGeoFilter(lead.location)) {
        console.log("[pipeline] Rejected out of market:", lead.title);
        continue;
      }

      // Three-tier contact gate: DBPR and inbound bypass; others go through Tier1 / Tier2 / Tier3
      if (lead.source === "dbpr" || (lead as { source?: string }).source === "inbound") {
        leads.push(lead);
        stats.filtered++;
        continue;
      }
      if (passesContactGate(lead)) {
        // TIER 1 — Has contact: auto-approve if intent >= 65 and other conditions
        const sourceStr = (lead as { source?: string }).source;
        const autoApprove =
          lead.intentScore >= 65 &&
          sourceStr !== "duckduckgo" &&
          passesGeoFilter(lead.location) &&
          postedAtWithin30OrNull(doc.postedAt) &&
          passesContactGate(lead);
        lead.isApproved = autoApprove;
        if (autoApprove) (lead as any).autoApproved = true;
        tier1Count++;
        leads.push(lead);
        stats.filtered++;
      } else if (lead.intentScore >= 70 && isTier2Source(lead)) {
        // TIER 2 — No contact but high intent + allowed source: insert pending enrichment
        lead.isApproved = false;
        (lead as any).needsEnrichment = true;
        tier2Count++;
        leads.push(lead);
        stats.filtered++;
      } else {
        // TIER 3 — Reject
        tier3RejectedCount++;
        console.log("[pipeline] Rejected - no contact info:", lead.title, "from", lead.source);
      }
    } catch (err) {
      stats.errors++;
      console.error("[scraper-pipeline] Error processing doc:", doc.externalId, err);
    }
  }

  console.log(
    "[pipeline] Tier1 approved:",
    tier1Count,
    "| Tier2 pending enrichment:",
    tier2Count,
    "| Tier3 rejected:",
    tier3RejectedCount
  );

  stats.trashCount = stats.negativeRejected + stats.intentRejected;
  stats.classified = leads.length;

  // Reject leads where eventDate has already passed (stale event)
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const leadsAfterStaleFilter = leads.filter(
    (l) => l.eventDate == null || l.eventDate >= startOfToday
  );
  const staleEventRejected = leads.length - leadsAfterStaleFilter.length;
  if (staleEventRejected > 0) {
    console.log("[scraper-pipeline] Rejected", staleEventRejected, "leads for stale event date (event already passed)");
  }
  stats.classified = leadsAfterStaleFilter.length;

  // high_intent_only filter: when enabled, keep only intent_score >= 60
  const highIntentOnly = process.env.HIGH_INTENT_ONLY === "true";
  let leadsForOutput = leadsAfterStaleFilter;
  if (highIntentOnly) {
    const before = leadsForOutput.length;
    leadsForOutput = leadsForOutput.filter((l) => l.intentScore >= 60);
    const rejected = before - leadsForOutput.length;
    if (rejected > 0) console.log("[scraper-pipeline] HIGH_INTENT_ONLY: filtered out", rejected, "leads with intent_score < 60");
    stats.classified = leadsForOutput.length;
  }

  console.log("[scraper-pipeline] Filter breakdown (trash vs valid):", {
    collected: stats.collected,
    trashCount: stats.trashCount,
    negativeRejected: stats.negativeRejected,
    intentRejected: stats.intentRejected,
    accepted: leadsForOutput.length,
  });

  const contactEmailCount = leadsForOutput.filter((l) => !!l.contactEmail).length;
  const contactPhoneCount = leadsForOutput.filter((l) => !!l.contactPhone).length;
  const venueUrlCount = leadsForOutput.filter((l) => !!l.venueUrl).length;
  const venueUrlFromExtractedCount = leadsForOutput.filter((l) => (l as any)._venueUrlSource === "extracted").length;
  const venueUrlFromMetaOrContactCount = leadsForOutput.filter((l) => {
    const src = (l as any)._venueUrlSource;
    return src === "contact" || src === "metadata";
  }).length;
  const highIntentCount = leadsForOutput.filter((l) => l.intentScore >= 80).length;
  const mediumIntentCount = leadsForOutput.filter((l) => l.intentScore >= 50 && l.intentScore < 80).length;
  const lowIntentCount = leadsForOutput.filter((l) => l.intentScore < 50).length;
  console.log("[scraper-pipeline] Contact enrichment:", {
    contactEmailCount,
    contactPhoneCount,
    venueUrlCount,
    venueUrlFromExtractedCount,
    venueUrlFromMetaOrContactCount,
    highIntentCount,
    mediumIntentCount,
    lowIntentCount,
  });

  const sourceCounts: Record<string, number> = {};
  for (const lead of leadsForOutput) {
    const key =
      lead.sourceLabel?.startsWith("Apify ")
        ? "apify"
        : lead.source === "reddit"
          ? "reddit"
          : lead.source === "eventbrite"
            ? "eventbrite"
            : lead.source === "craigslist"
              ? "craigslist"
              : lead.sourceLabel === "DBPR Venue Record"
                ? "dbpr"
                : lead.sourceLabel === "Sunbiz Business Record"
                  ? "sunbiz"
                  : "other";
    sourceCounts[key] = (sourceCounts[key] ?? 0) + 1;
  }

  const docs: RawDoc[] = allDocs.map(rawLeadDocToLegacyDoc);
  return { stats, docs, leads: leadsForOutput, sourceCounts, apifyCostUsd };
}

// ─── Live Lead Search (admin tool: query live sources with custom phrase) ──────

export interface LiveSearchParams {
  customPhrase: string;
  sources: ("reddit" | "craigslist" | "eventbrite")[];
  city?: string;
  performerType?: string;
  includeKeywords: string[];
  excludeKeywords: string[];
  maxResults?: number;
  dateFrom?: string;
  dateTo?: string;
}

export type LiveSearchDocStatus = "negative_rejected" | "intent_rejected" | "accepted";

export interface LiveSearchResultItem {
  doc: RawDoc;  // legacy shape for admin UI
  status: LiveSearchDocStatus;
  reason?: string;
  lead?: ScrapedLead;
  intentScore?: number;
}

export interface LiveSearchResult {
  results: LiveSearchResultItem[];
  stats: { collected: number; negativeRejected: number; intentRejected: number; accepted: number };
}

export async function runLiveLeadSearch(params: LiveSearchParams): Promise<LiveSearchResult> {
  const phrase = params.customPhrase?.trim() || "dj";
  const maxResults = Math.min(params.maxResults ?? 50, 200);
  const negativeList = [...ALL_NEGATIVE_KEYWORDS, ...(params.excludeKeywords || []).map((k) => normalizeText(k)).filter(Boolean)];
  const includeList = [
    ...DJ_HIRING_PHRASES,
    ...TRANSACTIONAL_BOOKING_KEYWORDS,
    ...(params.includeKeywords || []).map((p) => normalizeText(p)).filter(Boolean),
  ];

  const collectorPromises: Promise<RawLeadDoc[]>[] = [];
  if (params.sources.includes("reddit")) {
    collectorPromises.push(
      runRedditCollectorForLiveSearch({ query: phrase, city: params.city, maxResults }).then((raw) =>
        raw.map(redditRawDocToRawLeadDoc)
      )
    );
  }
  if (params.sources.includes("eventbrite")) {
    collectorPromises.push(
      collectFromEventbrite({ query: phrase, location: params.city, maxResults })
    );
  }
  if (params.sources.includes("craigslist")) {
    collectorPromises.push(
      collectFromCraigslistRss({ query: phrase, location: params.city, maxResults })
    );
  }

  const docArrays = await Promise.all(collectorPromises);
  let rawLeadDocs: RawLeadDoc[] = docArrays.flat();

  const dateFrom = params.dateFrom ? new Date(params.dateFrom) : null;
  const dateTo = params.dateTo ? new Date(params.dateTo) : null;
  if (dateFrom || dateTo) {
    rawLeadDocs = rawLeadDocs.filter((d) => {
      const t = d.postedAt ? new Date(d.postedAt).getTime() : 0;
      if (dateFrom && t < dateFrom.getTime()) return false;
      if (dateTo && t > dateTo.getTime()) return false;
      return true;
    });
  }
  rawLeadDocs = rawLeadDocs.slice(0, maxResults);

  const stats = { collected: rawLeadDocs.length, negativeRejected: 0, intentRejected: 0, accepted: 0 };
  const results: LiveSearchResultItem[] = [];

  for (const doc of rawLeadDocs) {
    const legacyDoc = rawLeadDocToLegacyDoc(doc);
    try {
      const normalized = normalizeText(doc.rawText);
      if (hasNegativeKeywordWithList(normalized, negativeList)) {
        stats.negativeRejected++;
        results.push({
          doc: legacyDoc,
          status: "negative_rejected",
          reason: "Matched exclude/negative keyword",
        });
        continue;
      }
      if (!shouldPassIntentGateWithLists(doc.rawText, negativeList, includeList)) {
        stats.intentRejected++;
        results.push({
          doc: legacyDoc,
          status: "intent_rejected",
          reason: "Did not match include phrases or intent gate",
        });
        continue;
      }
      const intentScore = localIntentScoreWithLists(normalized, negativeList, includeList);
      const lead = rawLeadDocToLead(doc, intentScore);
      stats.accepted++;
      results.push({
        doc: legacyDoc,
        status: "accepted",
        lead,
        intentScore,
      });
    } catch (err) {
      stats.intentRejected++;
      results.push({
        doc: legacyDoc,
        status: "intent_rejected",
        reason: err instanceof Error ? err.message : "Processing error",
      });
    }
  }

  return { results, stats };
}
