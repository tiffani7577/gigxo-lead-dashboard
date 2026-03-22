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

const DEFAULT_SUBJECT = "Quick question about entertainment for {{venueName}}";

const DEFAULT_BODY = `Hey {{ownerName}},

Congrats on the new spot in {{city}},
exciting time.

I run Gigxo, we connect South Florida venues
with local DJs, live acts, and performers.
Thought I'd reach out while you're still in
the setup phase, since that's usually when
it's easiest to lock in your entertainment
situation before opening night chaos hits.

We work with vetted performers across Miami,
Fort Lauderdale, and Boca; everything from
background lounge sets to full club nights.

No fees to you. We send you a few options,
you pick who fits.

Worth a quick conversation?

-Teryn
gigxo.com`;

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
