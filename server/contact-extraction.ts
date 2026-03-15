import type { RawLeadDoc } from "./scraper-collectors/raw-lead-doc";

export interface ExtractedContactInfo {
  name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
}
// Email and phone extractors that handle both structured and natural language formats

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
// Improved phone regex: handles (XXX) XXX-XXXX, XXX-XXX-XXXX, XXX.XXX.XXXX, +1 XXX XXX XXXX, etc.
const PHONE_REGEX = /(\+?1[-\.\s]?)\(?\d{3}\)?[-\.\s]?\d{3}[-\.\s]?\d{4}\b/;
// Natural language phone patterns: "call us at", "text", "reach out", "contact", etc.
const NATURAL_LANGUAGE_PHONE_REGEX = /(?:call|text|call us|reach out|contact|phone|tel|telephone)\s*(?:at|:|us\s+at)?\s*([+]?1[-.]?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4})/gi;
// Natural language email patterns: "email us at", "reach out", "contact", etc.
const NATURAL_LANGUAGE_EMAIL_REGEX = /(?:email|email us|reach out|contact)\s*(?:at|:|us\s+at)?\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;
function extractEmail(text: string): string | null {
  // Try basic email format first
  let match = text.match(EMAIL_REGEX);
  if (match) {
    const email = match[0];
    // Skip obviously fake/example domains
    if (/@example\.com$/i.test(email)) return null;
    return email;
  }

  // Try natural language formats: "email us at info@venue.com", "reach out to contact@example.com", etc.
  const naturalMatch = text.match(NATURAL_LANGUAGE_EMAIL_REGEX);
  if (naturalMatch) {
    for (const m of naturalMatch) {
      // Extract just the email part
      const emailOnly = m.match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
      if (emailOnly) {
        const email = emailOnly[0];
        if (!/@example\.com$/i.test(email)) return email;
      }
    }
  }

  return null;
}

function isFakePhone(digits: string): boolean {
  if (digits.length < 10) return true;
  const area = digits.slice(0, 3);
  const exchange = digits.slice(3, 6);
  return area === "555" || exchange === "555";
}

function extractPhone(text: string): string | null {
  // Try structured format first
  let match = text.match(PHONE_REGEX);
  if (match) {
    const candidate = match[0];
    const digits = candidate.replace(/\D/g, "");
    if (!isFakePhone(digits)) return candidate;
  }

  // Try natural language formats: "call us at 305-xxx-xxxx", "text 786-488-4211", etc.
  const naturalMatch = text.match(NATURAL_LANGUAGE_PHONE_REGEX);
  if (naturalMatch) {
    for (const m of naturalMatch) {
      // Extract just the phone number part
      const phoneOnly = m.match(/(\+?1[-.]?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4})/);
      if (phoneOnly) {
        const digits = phoneOnly[0].replace(/\D/g, "");
        if (!isFakePhone(digits)) return phoneOnly[0];
      }
    }
  }

  return null;
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

