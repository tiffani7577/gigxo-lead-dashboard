/**
 * Rule-based copy + pricing for buyer leads (Reddit, Facebook, Craigslist, etc.).
 * DBPR / venue-intelligence leads skip this module in the pipeline.
 */

import type { RawLeadDoc } from "./raw-lead-doc";

/** Minimal lead shape for formatting (matches ScrapedLead fields used here). */
export interface LeadFormatTarget {
  title: string;
  description: string;
  rawText?: string | null;
  eventType: string;
  budget: number | null;
  location: string;
  eventDate: Date | null;
  contactName?: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  performerType: string;
  venueUrl: string;
  intentScore?: number;
  leadTier?: "starter_friendly" | "standard" | "premium";
  publicPreviewDescription?: string | null;
  fullDescription?: string | null;
  pricingReason?: string | null;
  regionTag?: "miami" | "fort_lauderdale" | "boca" | "west_palm" | "south_florida" | null;
}

export type BuyerLeadDashboardClassification = "buyer_request" | "invalid";

const SOUTH_FLORIDA_MARKERS = [
  "miami",
  "fort lauderdale",
  "broward",
  "boca raton",
  "delray beach",
  "west palm beach",
  "hollywood fl",
  "hollywood, fl",
  "pompano beach",
  "aventura",
  "pembroke pines",
  "coral springs",
  "palm beach",
  "deerfield beach",
  "hallandale",
  "sunrise",
  "plantation",
  "davie",
  "doral",
  "hialeah",
  "coral gables",
  "coconut grove",
  "south beach",
  "wynwood",
];

/** Artist self-promo / gig-seeking / noise — reject as buyer lead */
const INVALID_ARTIST_PATTERNS: RegExp[] = [
  /\b(i'?m\s+a|i am\s+a|we are\s+a)\s+(dj|disc jockey|band|musician|mc|m\.c\.|entertainer)\b/i,
  /\b(dj|band|musician)\s+available\b/i,
  /\bavailable\s+for\s+(gigs?|bookings?|events?)\b/i,
  /\b(book|hire)\s+us\b/i,
  /\blooking\s+for\s+gigs?\b/i,
  /\bseeking\s+gigs?\b/i,
  /\bneed\s+gigs?\b/i,
  /\b(check out|listen to|follow)\s+(my|our)\s+(mix|set|soundcloud|spotify|instagram)\b/i,
  /\b(my|our)\s+(new\s+)?(single|album|ep)\s+(out|dropped)\b/i,
];

/** Buyer is actively seeking entertainment */
const BUYER_SEEK_PATTERNS: RegExp[] = [
  /\bneed(s|ed)?\s+(a\s+)?dj\b/i,
  /\blooking\s+for\s+(a\s+)?dj\b/i,
  /\bhire\s+(a\s+)?dj\b/i,
  /\bhiring\s+(a\s+)?dj\b/i,
  /\bdj\s+needed\b/i,
  /\bwedding\s+dj\b/i,
  /\bneed(s|ed)?\s+(a\s+)?(live\s+)?band\b/i,
  /\blooking\s+for\s+(a\s+)?band\b/i,
  /\bhire\s+(a\s+)?band\b/i,
  /\bband\s+needed\b/i,
  /\bneed(s|ed)?\s+(a\s+)?(musician|singer|vocalist)\b/i,
  /\blooking\s+for\s+(a\s+)?(musician|singer|mc|m\.c\.|emcee|master\s+of\s+ceremonies)\b/i,
  /\bneed(s|ed)?\s+(an?\s+)?mc\b/i,
  /\b(entertainment|performer|acts?)\s+for\s+(my\s+)?(wedding|event|party)\b/i,
  /\brecommend\s+(a\s+)?dj\b/i,
  /\bany(one)?\s+know\s+(a\s+)?good\s+dj\b/i,
];

function normalizeForRules(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyBuyerLeadForDashboard(doc: RawLeadDoc, lead: LeadFormatTarget): BuyerLeadDashboardClassification {
  const blob = `${doc.title ?? ""}\n${doc.rawText ?? ""}\n${lead.title ?? ""}`;
  const n = normalizeForRules(blob);
  if (n.length < 25) return "invalid";

  const hasBuyer = BUYER_SEEK_PATTERNS.some((re) => re.test(blob));
  if (!hasBuyer) return "invalid";

  const artistNoise = INVALID_ARTIST_PATTERNS.some((re) => re.test(blob));
  // Allow "we need a DJ" even if post also says "band" somewhere — only reject clear self-promo
  if (artistNoise && !/\b(need|looking for|hire|hiring|recommend)\b/i.test(blob)) return "invalid";

  return "buyer_request";
}

export function resolveRegionTagForDashboard(location: string | null | undefined): LeadFormatTarget["regionTag"] {
  const loc = (location ?? "").toLowerCase();
  if (!loc.trim()) return null;
  for (const m of SOUTH_FLORIDA_MARKERS) {
    if (loc.includes(m)) return "south_florida";
  }
  return null;
}

function hasDirectContact(lead: LeadFormatTarget): boolean {
  return !!(String(lead.contactEmail ?? "").trim() || String(lead.contactPhone ?? "").trim());
}

function sourceIsSocialPostOnly(doc: RawLeadDoc, lead: LeadFormatTarget): boolean {
  const url = (doc.url || lead.venueUrl || "").toLowerCase();
  if (!url) return true;
  return /reddit\.com|facebook\.com|fb\.com|redd\.it|craigslist\.org/i.test(url);
}

function hasStrongDetailSignals(lead: LeadFormatTarget, raw: string): boolean {
  const lower = raw.toLowerCase();
  const hasBudget = lead.budget != null && lead.budget >= 50_000; // $500+ stated
  const hasDate =
    lead.eventDate != null ||
    /\b(20[2-3][0-9]|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(raw);
  const wedding = /wedding|bridal|reception|ceremony/i.test(lower);
  const venue = /venue|hall|hotel|country club|ballroom|restaurant|rooftop/i.test(lower);
  const urgency = /urgent|asap|this weekend|next week|soon\b|rush/i.test(lower);
  let strong = 0;
  if (hasBudget) strong++;
  if (hasDate) strong++;
  if (wedding) strong++;
  if (venue) strong++;
  if (urgency) strong++;
  return strong >= 2 || (wedding && hasDate) || (hasBudget && wedding);
}

function exceptionallyHighValue(lead: LeadFormatTarget, raw: string): boolean {
  if (lead.budget != null && lead.budget >= 500_000) return true; // $5k+
  if (/corporate\s+gala|festival|thousand\s+guest|500\s*\+|\$10[,\s]?0{3,}/i.test(raw)) return true;
  return false;
}

export function computeDashboardTierAndReason(
  doc: RawLeadDoc,
  lead: LeadFormatTarget
): { tier: "starter_friendly" | "standard" | "premium"; pricingReason: string } {
  const raw = `${doc.rawText ?? ""}\n${doc.title ?? ""}`;

  if (hasDirectContact(lead)) {
    const hasPhone = !!String(lead.contactPhone ?? "").trim();
    const hasEmail = !!String(lead.contactEmail ?? "").trim();
    const pricingReason =
      hasPhone && hasEmail
        ? "Includes direct phone number and email"
        : hasPhone
          ? "Includes direct phone number"
          : "Includes direct email";
    return { tier: "premium", pricingReason };
  }
  if (exceptionallyHighValue(lead, raw)) {
    return { tier: "premium", pricingReason: "Exceptionally high-value opportunity (budget or event scope)" };
  }
  if (!hasDirectContact(lead) && hasStrongDetailSignals(lead, raw)) {
    return { tier: "standard", pricingReason: "Strong wedding lead with clear details" };
  }
  if (sourceIsSocialPostOnly(doc, lead) && !hasDirectContact(lead)) {
    return { tier: "starter_friendly", pricingReason: "Facebook-only lead, no direct contact" };
  }
  return { tier: "starter_friendly", pricingReason: "Social listing, lower detail / no direct contact" };
}

function performerLabel(performerType: string): string {
  const p = (performerType || "dj").toLowerCase();
  if (p.includes("band")) return "Band";
  if (p === "singer" || p.includes("vocal")) return "Singer";
  if (p.includes("mc") || p.includes("emcee")) return "MC";
  if (p.includes("musician") || p === "instrumentalist") return "Musician";
  return "DJ";
}

function primaryCityLabel(location: string): string {
  const s = (location || "").trim();
  if (!s) return "South Florida";
  const comma = s.indexOf(",");
  return comma > 0 ? s.slice(0, comma).trim() : s;
}

function monthYearFromLead(lead: LeadFormatTarget, raw: string): string {
  if (lead.eventDate) {
    return lead.eventDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
  const m = raw.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+20[2-3][0-9]\b/i);
  if (m) return m[0];
  const y = raw.match(/\b(20[2-3][0-9])\b/);
  if (y) return y[1];
  return "";
}

/** Title: [Service] Needed for [Event Type] in [City] — max ~12 words */
export function buildDashboardTitle(lead: LeadFormatTarget, doc: RawLeadDoc): string {
  const service = performerLabel(lead.performerType);
  const event = (lead.eventType || "Event").trim() || "Event";
  const city = primaryCityLabel(lead.location);
  const raw = `${doc.rawText ?? ""}\n${doc.title ?? ""}`;
  const my = monthYearFromLead(lead, raw);
  const urgent = /urgent|asap|rush|this weekend/i.test(raw) ? "Urgent " : "";

  let parts = [`${urgent}${service} Needed for`, event];
  if (my) parts.push(`in ${my}`);
  parts.push(`in ${city}`);

  let title = parts.join(" ").replace(/\s+/g, " ").trim();
  const words = title.split(/\s+/);
  if (words.length > 12) {
    title = words.slice(0, 12).join(" ");
  }
  if (title.length > 255) title = title.slice(0, 252) + "...";
  return title;
}

const URL_IN_TEXT = /\bhttps?:\/\/[^\s)]+/gi;
const EMAIL_IN_TEXT = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;
const PHONE_IN_TEXT = /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g;

function stripUrlsEmailsPhones(text: string): string {
  return text.replace(URL_IN_TEXT, "").replace(EMAIL_IN_TEXT, "").replace(PHONE_IN_TEXT, "").replace(/\s+/g, " ").trim();
}

export function buildPublicPreviewDescription(lead: LeadFormatTarget, doc: RawLeadDoc): string {
  const city = primaryCityLabel(lead.location);
  const event = (lead.eventType || "event").toLowerCase();
  const raw = `${doc.rawText ?? ""}`;
  const hasBudget = lead.budget != null;
  const budgetDollars = hasBudget ? Math.round(lead.budget! / 100) : 0;

  const s1 = `Client is looking for ${performerLabel(lead.performerType).toLowerCase()} services for ${event.includes("wedding") ? "a wedding" : `a ${event}`} in ${city}.`;

  let s2 = "";
  if (hasBudget && budgetDollars > 0) {
    s2 = `They mentioned a budget around $${budgetDollars.toLocaleString()}.`;
  } else {
    s2 = "Budget was not clearly stated in the post.";
  }

  let s3 = "";
  if (hasStrongDetailSignals(lead, raw)) {
    s3 = "Details look specific enough to follow up with a professional pitch.";
  } else {
    s3 = "Details are lighter; worth a look if you like the event type and area.";
  }

  let s4 = "";
  if ((lead.intentScore ?? 0) >= 75 && hasBudget) {
    s4 = "Solid opportunity for a responsive vendor.";
  }

  const parts = [s1, s2, s3, s4].filter(Boolean);
  let out = stripUrlsEmailsPhones(parts.join(" "));
  if (out.length > 600) out = out.slice(0, 597) + "...";

  const sourceUrl = (doc.url || "").trim();
  if (sourceUrl && out.includes(sourceUrl)) {
    out = out.split(sourceUrl).join("").replace(/\s+/g, " ").trim();
  }
  return out;
}

export function buildFullDescriptionBody(lead: LeadFormatTarget, doc: RawLeadDoc): string {
  const raw = (doc.rawText || "").trim();
  const excerpt = raw.length > 1200 ? `${raw.slice(0, 1197)}...` : raw;
  const lines: string[] = [];
  lines.push("What the client posted (summary):");
  lines.push(excerpt || "(No body text captured.)");
  lines.push("");
  lines.push(`Event type: ${lead.eventType || "—"}`);
  lines.push(`Location: ${lead.location || "—"}`);
  if (lead.eventDate) {
    lines.push(`Event date: ${lead.eventDate.toLocaleDateString("en-US", { dateStyle: "long" })}`);
  }
  if (lead.budget != null) {
    lines.push(`Budget (from post): $${(lead.budget / 100).toLocaleString()}`);
  }
  if (lead.contactName) {
    lines.push(`Contact name (if given): ${lead.contactName}`);
  }
  lines.push(`Intent score (heuristic): ${lead.intentScore ?? "—"}`);
  return lines.join("\n");
}

export function originalPostLinkSuffix(sourceUrl: string): string {
  return `\n\nOriginal post link:\n${sourceUrl}`;
}

/** Throws if fullDescription does not end with the required link block. */
export function assertFullDescriptionEndsWithSourceUrl(fullDescription: string, sourceUrl: string): void {
  const expected = originalPostLinkSuffix(sourceUrl.trim());
  if (!sourceUrl.trim()) {
    throw new Error("[formatLeadForDashboard] Missing source URL for Original post link block");
  }
  if (!fullDescription.endsWith(expected)) {
    console.error("[formatLeadForDashboard] fullDescription suffix mismatch", {
      expectedTail: expected.slice(-80),
      actualTail: fullDescription.slice(-120),
    });
    throw new Error("[formatLeadForDashboard] fullDescription must end with Original post link and source URL");
  }
}

/** Ensures public preview never contains the source URL substring. */
export function assertPublicPreviewHasNoSourceUrl(preview: string, sourceUrl: string): void {
  const u = sourceUrl.trim();
  if (!u) return;
  if (preview.includes(u)) {
    throw new Error("[formatLeadForDashboard] publicPreviewDescription must not include source URL");
  }
}

/**
 * Mutates lead: title, description, fullDescription, publicPreviewDescription,
 * leadTier, pricingReason, regionTag.
 */
export function formatLeadForDashboard(doc: RawLeadDoc, lead: LeadFormatTarget): void {
  const sourceUrl = (doc.url || "").trim();
  if (!sourceUrl) {
    throw new Error("[formatLeadForDashboard] doc.url is required for Original post link");
  }

  const { tier, pricingReason } = computeDashboardTierAndReason(doc, lead);
  lead.leadTier = tier;
  lead.pricingReason = pricingReason;
  lead.regionTag = resolveRegionTagForDashboard(lead.location);

  lead.title = buildDashboardTitle(lead, doc);
  const body = buildFullDescriptionBody(lead, doc);
  const full = `${body}${originalPostLinkSuffix(sourceUrl)}`;
  assertFullDescriptionEndsWithSourceUrl(full, sourceUrl);
  lead.fullDescription = full;
  lead.description = full;

  const preview = buildPublicPreviewDescription(lead, doc);
  assertPublicPreviewHasNoSourceUrl(preview, sourceUrl);
  lead.publicPreviewDescription = preview;
}
