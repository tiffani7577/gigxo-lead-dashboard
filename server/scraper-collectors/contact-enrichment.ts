/**
 * Contact enrichment for DBPR venue leads: Google Places API then optional website email scrape.
 * Called after a DBPR lead is inserted; updates gigLead with phone, website, description, and email.
 * Failures are logged and never thrown so the pipeline is not broken.
 */

const PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK =
  "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount";

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const BLOCKED_SUBSTRINGS = [
  "sentry", "example", "wix", "squarespace", "wordpress", "domain",
  "noreply", "no-reply", "support@google", "@sentry",
];
const BLOCKED_EXTENSIONS = [".png", ".jpg", ".gif", ".css", ".js"];
const PRIORITY_KEYWORDS = ["booking", "info", "contact", "events", "entertainment", "hello", "owner", "manager"];
const WEBSITE_FETCH_TIMEOUT_MS = 5000;
const WEBSITE_USER_AGENT = "Mozilla/5.0 (compatible; Googlebot/2.1)";

/** High-value venue signals (case-insensitive); used to gate enrichment and avoid API calls on low-value licenses. */
const VENUE_QUALITY_SIGNALS = [
  "bar", "lounge", "club", "nightclub", "tavern", "brewery", "winery", "distillery", "cocktail",
  "venue", "event space", "banquet", "ballroom", "rooftop", "waterfront", "marina", "yacht",
  "hotel", "resort", "restaurant", "grill", "cantina", "speakeasy", "taproom", "supper club",
  "music hall", "entertainment",
];

/** True if title or description contains at least one high-value venue signal (case-insensitive). */
export function shouldEnrichVenue(title: string | null | undefined, description: string | null | undefined): boolean {
  const combined = `${title ?? ""} ${description ?? ""}`.toLowerCase();
  return VENUE_QUALITY_SIGNALS.some((signal) => combined.includes(signal.toLowerCase()));
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
  let html: string;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBSITE_FETCH_TIMEOUT_MS);
    const res = await fetch(websiteUri, {
      headers: { "User-Agent": WEBSITE_USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    html = await res.text();
  } catch (err) {
    return null;
  }

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
}

export async function enrichVenueContact(
  leadId: number,
  businessName: string,
  city: string
): Promise<void> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[contact-enrichment] GOOGLE_PLACES_API_KEY not set; skipping enrichment for leadId", leadId);
    return;
  }

  const textQuery = [businessName, city, "FL"].filter(Boolean).join(" ");
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
}
