/**
 * Contact enrichment for DBPR venue leads: Google Places API then optional website email scrape.
 * Called after a DBPR lead is inserted; updates gigLead with phone, website, description, and email.
 * Failures are logged and never thrown so the pipeline is not broken.
 */

const PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK =
  "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount";

const EMAIL_REGEX = /[a-zA-Z0-9._%+'\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,24}/g;
const BLOCKED_SUBSTRINGS = [
  "sentry", "example", "wix", "squarespace", "wordpress", "domain",
  "noreply", "no-reply", "support@google", "@sentry",
];
const BLOCKED_EXTENSIONS = [".png", ".jpg", ".gif", ".css", ".js"];
const PRIORITY_KEYWORDS = ["booking", "info", "contact", "events", "entertainment", "hello", "owner", "manager"];
const WEBSITE_FETCH_TIMEOUT_MS = 8000;
const WEBSITE_USER_AGENT = "Mozilla/5.0 (compatible; Googlebot/2.1)";
const LEGAL_SUFFIX_REGEX = /\b(?:llc|inc|inc\.|corp|corp\.|corporation|ltd|ltd\.|limited)\b/gi;

/** High-value venue signals (case-insensitive); used to gate enrichment and avoid API calls on low-value licenses. */
const VENUE_QUALITY_SIGNALS = [
  "bar", "lounge", "club", "nightclub", "tavern", "brewery", "winery", "distillery", "cocktail",
  "venue", "event space", "banquet", "ballroom", "rooftop", "waterfront", "marina", "yacht",
  "hotel", "resort", "restaurant", "grill", "cantina", "speakeasy", "taproom", "supper club",
  "cafe", "bistro", "kitchen", "deli", "eatery", "pizza",
  "music hall", "entertainment",
];

const HIGH_INTENT_TITLE_KEYWORDS = ["nightclub", "lounge", "bar"] as const;
const TOP_TIER_CITIES = [
  "miami",
  "fort lauderdale",
  "boca raton",
  "west palm beach",
  "delray beach",
  "miami beach",
] as const;

/** True only for high-intent venue titles in top-tier target cities. */
export function shouldEnrichVenue(
  title: string | null | undefined,
  description: string | null | undefined,
  location: string | null | undefined
): boolean {
  const titleLower = String(title ?? "").toLowerCase();
  const locationLower = String(location ?? "").toLowerCase();
  const titleMatches = HIGH_INTENT_TITLE_KEYWORDS.some((keyword) => titleLower.includes(keyword));
  const cityMatches = TOP_TIER_CITIES.some((city) => locationLower.includes(city));
  return titleMatches && cityMatches;
}

interface PlaceResult {
  displayName?: { text?: string } | string;
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
}

interface SearchResponse {
  places?: PlaceResult[];
}

/** Extract root domain from URL (e.g. https://www.joesbar.com/path -> joesbar.com). */
function getRootDomain(uri: string): string | null {
  try {
    const u = new URL(uri);
    const host = u.hostname.toLowerCase();
    const parts = host.split(".");
    if (parts.length >= 2) {
      return parts.slice(-2).join(".");
    }
    return host || null;
  } catch {
    return null;
  }
}

/** True if email domain is same as or subdomain of venue root (e.g. mail.joesbar.com vs joesbar.com). */
function emailDomainMatchesVenue(email: string, venueRootDomain: string): boolean {
  const at = email.indexOf("@");
  if (at === -1) return false;
  const emailDomain = email.slice(at + 1).toLowerCase();
  if (emailDomain === venueRootDomain) return true;
  return emailDomain.endsWith("." + venueRootDomain);
}

function isBlockedEmail(email: string): boolean {
  const lower = email.toLowerCase();
  if (BLOCKED_SUBSTRINGS.some((s) => lower.includes(s))) return true;
  if (BLOCKED_EXTENSIONS.some((ext) => lower.endsWith(ext))) return true;
  return false;
}

function priorityScore(email: string): number {
  const lower = email.toLowerCase();
  const idx = PRIORITY_KEYWORDS.findIndex((kw) => lower.includes(kw));
  return idx === -1 ? PRIORITY_KEYWORDS.length : idx;
}

/** Scrape website HTML for a valid venue email; returns one email or null. Never throws. */
async function scrapeEmailFromWebsite(websiteUri: string, venueRootDomain: string | null): Promise<string | null> {
  const extractBestEmail = (html: string): string | null => {
    const matches = html.match(EMAIL_REGEX) ?? [];
    const unique = [...new Set(matches.map((m) => m.toLowerCase().trim()))];
    const valid = unique.filter((e) => {
      if (isBlockedEmail(e)) return false;
      if (venueRootDomain && !emailDomainMatchesVenue(e, venueRootDomain)) return false;
      return true;
    });
    if (valid.length === 0) return null;
    valid.sort((a, b) => priorityScore(a) - priorityScore(b));
    return valid[0];
  };

  const fetchHtml = async (url: string): Promise<string | null> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), WEBSITE_FETCH_TIMEOUT_MS);
      const res = await fetch(url, {
        headers: { "User-Agent": WEBSITE_USER_AGENT },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  };

  // 1) Homepage
  const homepageHtml = await fetchHtml(websiteUri);
  if (homepageHtml) {
    const homepageEmail = extractBestEmail(homepageHtml);
    if (homepageEmail) return homepageEmail;
  }

  // 2) Common contact sub-pages
  const subPaths = ["/contact", "/about", "/booking"];
  let baseUrl: URL;
  try {
    baseUrl = new URL(websiteUri);
  } catch {
    return null;
  }

  for (const path of subPaths) {
    try {
      const subUrl = new URL(path, baseUrl).toString();
      const html = await fetchHtml(subUrl);
      if (!html) continue;
      const email = extractBestEmail(html);
      if (email) return email;
    } catch {
      // keep trying other sub-pages
    }
  }

  return null;
}

export async function enrichVenueContact(
  leadId: number,
  businessName: string,
  city: string
): Promise<void> {
  console.log("[contact-enrichment] API key present:", !!process.env.GOOGLE_PLACES_API_KEY?.trim());
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[contact-enrichment] GOOGLE_PLACES_API_KEY not set; skipping enrichment for leadId", leadId);
    return;
  }

  // Strip legal suffixes so Places search uses storefront-style name.
  const normalizedBusinessName = businessName
    .replace(LEGAL_SUFFIX_REGEX, "")
    .replace(/[,.\-]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  const searchBusinessName = normalizedBusinessName || businessName;
  const textQuery = [searchBusinessName, city, "FL"].filter(Boolean).join(" ");
  if (!textQuery.trim()) {
    console.warn("[contact-enrichment] Empty query for leadId", leadId);
    return;
  }

  let res: Response;
  try {
    res = await fetch(PLACES_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({ textQuery }),
    });
  } catch (err) {
    console.warn("[contact-enrichment] Google Places request failed for leadId", leadId, err);
    return;
  }

  if (!res.ok) {
    const body = await res.text();
    console.warn("[contact-enrichment] Google Places error for leadId", leadId, res.status, body?.slice(0, 200));
    return;
  }

  let data: SearchResponse;
  try {
    data = (await res.json()) as SearchResponse;
  } catch (err) {
    console.warn("[contact-enrichment] Failed to parse Places response for leadId", leadId, err);
    return;
  }

  const places = data?.places;
  if (!Array.isArray(places) || places.length === 0) {
    return;
  }

  const place = places[0] as PlaceResult;
  const formattedAddress = typeof place.formattedAddress === "string" ? place.formattedAddress : undefined;
  const nationalPhoneNumber = typeof place.nationalPhoneNumber === "string" ? place.nationalPhoneNumber : undefined;
  const websiteUri = typeof place.websiteUri === "string" ? place.websiteUri : undefined;
  const rating = typeof place.rating === "number" ? place.rating : undefined;
  const userRatingCount = typeof place.userRatingCount === "number" ? place.userRatingCount : undefined;

  if (!formattedAddress && !nationalPhoneNumber && !websiteUri) {
    return;
  }

  const { getDb } = await import("../db");
  const db = await getDb();
  if (!db) {
    console.warn("[contact-enrichment] Database not available for leadId", leadId);
    return;
  }

  const { gigLeads } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");

  const [row] = await db.select({
    description: gigLeads.description,
    venueUrl: gigLeads.venueUrl,
    notes: gigLeads.notes,
    contactEmail: gigLeads.contactEmail,
  }).from(gigLeads).where(eq(gigLeads.id, leadId)).limit(1);
  if (!row) {
    return;
  }

  const updates: Record<string, unknown> = {};

  if (nationalPhoneNumber) {
    updates.contactPhone = nationalPhoneNumber.slice(0, 20);
  }

  if (websiteUri && (!row.venueUrl || !String(row.venueUrl).trim())) {
    updates.venueUrl = websiteUri.slice(0, 2048);
  }

  const descriptionParts: string[] = [];
  if (formattedAddress || (rating != null && userRatingCount != null)) {
    const ratingStr =
      rating != null && userRatingCount != null
        ? `Rating: ${rating} (${userRatingCount} reviews)`
        : rating != null
          ? `Rating: ${rating}`
          : userRatingCount != null
            ? `${userRatingCount} reviews`
            : "";
    const line = [formattedAddress ? `Google Places: ${formattedAddress}` : "Google Places", ratingStr].filter(Boolean).join(" | ");
    if (line) descriptionParts.push(line);
  }

  if (descriptionParts.length > 0) {
    const existingDesc = row.description ? String(row.description).trim() : "";
    const newDesc = existingDesc ? `${existingDesc}\n\n${descriptionParts.join("\n")}` : descriptionParts.join("\n");
    updates.description = newDesc.slice(0, 65535);
  }

  const lowReviewCount = typeof userRatingCount === "number" && userRatingCount < 20;
  if (lowReviewCount) {
    const existingNotes = row.notes ? String(row.notes).trim() : "";
    const note = "low_review_count: true";
    updates.notes = existingNotes ? `${existingNotes}\n${note}` : note;
  }

  if (Object.keys(updates).length === 0) {
    return;
  }

  try {
    await db.update(gigLeads).set(updates as any).where(eq(gigLeads.id, leadId));
    console.log("[contact-enrichment] Enriched leadId", leadId, "→", businessName, "| phone:", !!nationalPhoneNumber, "| website:", !!websiteUri);
  } catch (err) {
    console.warn("[contact-enrichment] Failed to update gigLead", leadId, err);
  }

  // Step 3: Website email scrape — only if Places gave us a website and contactEmail is still empty
  const contactEmailStillEmpty = !row.contactEmail || !String(row.contactEmail).trim();
  if (websiteUri && contactEmailStillEmpty) {
    try {
      const venueRoot = getRootDomain(websiteUri);
      const email = await scrapeEmailFromWebsite(websiteUri, venueRoot);
      if (email) {
        await db.update(gigLeads).set({ contactEmail: email.slice(0, 320) }).where(eq(gigLeads.id, leadId));
        console.log(`[contact-enrichment] Website scrape found email for ${businessName}: ${email}`);
      }
    } catch (err) {
      console.warn("[contact-enrichment] Website email scrape error for leadId", leadId, err);
    }
  }

  await promoteVenueIntelToManualOutreachIfNeeded(leadId);
}

const VENUE_INTEL_OUTREACH_SOURCES = new Set(["dbpr", "sunbiz", "google_maps"]);

/** After enrichment adds email/phone, move venue-intel rows into Outreach Hub queue (manual_outreach). */
async function promoteVenueIntelToManualOutreachIfNeeded(leadId: number): Promise<void> {
  const { getDb } = await import("../db");
  const db = await getDb();
  if (!db) return;
  const { gigLeads } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const [r] = await db
    .select({
      source: gigLeads.source,
      leadType: gigLeads.leadType,
      contactEmail: gigLeads.contactEmail,
      contactPhone: gigLeads.contactPhone,
    })
    .from(gigLeads)
    .where(eq(gigLeads.id, leadId))
    .limit(1);
  if (!r?.source || !VENUE_INTEL_OUTREACH_SOURCES.has(r.source)) return;
  const hasContact =
    !!(r.contactEmail && String(r.contactEmail).trim()) ||
    !!(r.contactPhone && String(r.contactPhone).trim());
  if (!hasContact || r.leadType !== "venue_intelligence") return;
  await db.update(gigLeads).set({ leadType: "manual_outreach" }).where(eq(gigLeads.id, leadId));
  console.log("[contact-enrichment] Promoted leadId", leadId, "to manual_outreach (contact acquired)");
}
