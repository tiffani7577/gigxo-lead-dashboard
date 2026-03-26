/**
 * Template engine for DBPR venue outreach emails.
 * Replaces {{venueName}}, {{city}}, {{ownerName}} in subject and body.
 */

export interface VenueTemplateInput {
  title: string | null;
  location: string | null;
  contactName?: string | null;
}

function toTitleCase(name: string): string {
  if (!name.trim()) return name;
  return name
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

const DEFAULT_SUBJECT = "Post your first gig free — {{venueName}}";

const DEFAULT_BODY = `Hey {{ownerName}},

Congrats on the new spot in {{city}} — exciting time.

I'm Teryn with South Florida–based Gigxo. When you need entertainment, here's how it works:

• Free to post your gig
• We send it to vetted local performers
• You pick who fits
• Zero commission, zero fees

Post your first gig free → https://gigxo.com/book

—Teryn
Gigxo`;

function extractCity(location: string | null | undefined): string {
  if (!location || !String(location).trim()) return "South Florida";
  const s = String(location).trim();
  // "Miami, FL" -> "Miami"; "Fort Lauderdale, FL" -> "Fort Lauderdale"
  const comma = s.indexOf(",");
  if (comma > 0) return s.slice(0, comma).trim();
  return s;
}

export function renderVenueTemplate(venue: VenueTemplateInput): { subject: string; body: string } {
  const rawTitle = venue.title?.trim() || "";
  const venueName = rawTitle ? toTitleCase(rawTitle) : "your venue";
  const city = extractCity(venue.location);
  const ownerName = venue.contactName?.trim() || "there";

  const replace = (text: string) =>
    text
      .replace(/\{\{venueName\}\}/g, venueName)
      .replace(/\{\{city\}\}/g, city)
      .replace(/\{\{ownerName\}\}/g, ownerName);

  return {
    subject: replace(DEFAULT_SUBJECT),
    body: replace(DEFAULT_BODY),
  };
}
