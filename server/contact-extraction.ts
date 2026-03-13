import type { RawLeadDoc } from "./scraper-collectors/raw-lead-doc";

export interface ExtractedContactInfo {
  name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
}

// Very conservative email + phone extractors, shared by all sources.

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_REGEX = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/;

function extractEmail(text: string): string | null {
  const match = text.match(EMAIL_REGEX);
  if (!match) return null;
  const email = match[0];
  // Skip obviously fake/example domains
  if (/@example\.com$/i.test(email)) return null;
  return email;
}

function isFakePhone(digits: string): boolean {
  if (digits.length < 10) return true;
  const area = digits.slice(0, 3);
  const exchange = digits.slice(3, 6);
  return area === "555" || exchange === "555";
}

function extractPhone(text: string): string | null {
  const match = text.match(PHONE_REGEX);
  if (!match) return null;
  const candidate = match[0];
  const digits = candidate.replace(/\D/g, "");
  if (isFakePhone(digits)) return null;
  return candidate;
}

function extractWebsite(text: string): string | null {
  const urlMatch = text.match(/https?:\/\/[^\s]+/i);
  if (urlMatch) return urlMatch[0];
  const domainMatch = text.match(/\b[a-z0-9.-]+\.(com|net|org|io|co|biz|club)\b/i);
  if (domainMatch) return domainMatch[0].toLowerCase();
  return null;
}

function extractName(text: string): string | null {
  // Extremely conservative: look for lines like "Contact: Jane Doe" or "Name: Jane Doe"
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*(contact|contact name|name)\s*:\s*(.+)$/i);
    if (!m) continue;
    const name = m[2].trim();
    if (!name) continue;
    // Require 2-4 words, no '@' or digits, to avoid junk
    const parts = name.split(/\s+/);
    if (parts.length < 2 || parts.length > 4) continue;
    if (/[0-9@]/.test(name)) continue;
    return name;
  }
  return null;
}

// Consider URLs on obvious provenance domains as non-venue URLs.
function isProvenanceUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes("myfloridalicense.com") || // DBPR
    lower.includes("dos.fl.gov/sunbiz") ||   // Sunbiz portal / data downloads
    lower.includes("sunbiz.org") ||
    lower.includes("reddit.com") ||
    lower.includes("eventbrite.com") ||
    lower.includes("craigslist.org") ||
    lower.includes("news.google.com")
  );
}

function extractWebsiteFromMetadata(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata) return null;
  const meta = metadata as any;

  const candidates: unknown[] = [
    meta.website,
    meta.websiteUrl,
    meta.venueUrl,
    meta.domain,
    meta.host,
    meta.site,
  ];

  // Nested source-specific blobs
  if (meta.dbpr) {
    candidates.push(
      (meta.dbpr as any).website,
      (meta.dbpr as any).websiteUrl,
    );
  }
  if (meta.sunbiz) {
    candidates.push(
      (meta.sunbiz as any).website,
      (meta.sunbiz as any).websiteUrl,
      (meta.sunbiz as any).domain,
    );
  }

  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) {
      const w = c.trim();
      // Very light validation: must look like a URL/domain and not be obvious provenance
      if ((/^https?:\/\//i.test(w) || /\.[a-z]{2,}$/i.test(w)) && !isProvenanceUrl(w)) {
        return w;
      }
    }
  }
  return null;
}

export function extractContactFromRawLeadDoc(doc: RawLeadDoc): ExtractedContactInfo {
  const text = doc.rawText || "";
  const email = extractEmail(text);
  const phone = extractPhone(text);
  const websiteFromMeta = extractWebsiteFromMetadata(doc.metadata);
  const website = websiteFromMeta ?? extractWebsite(text);
  const name = extractName(text);

  return {
    name,
    email,
    phone,
    website,
  };
}

