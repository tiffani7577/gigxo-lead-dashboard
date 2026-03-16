/**
 * Template engine for DBPR venue outreach emails.
 * Replaces {{venueName}}, {{city}}, {{ownerName}} in subject and body.
 */

export interface VenueTemplateInput {
  title: string | null;
  location: string | null;
  contactName?: string | null;
}

const DEFAULT_SUBJECT = "Congratulations on opening {{venueName}} 🎉 — Free entertainment quotes inside";

const DEFAULT_BODY = `Hi {{ownerName}},

Congratulations on opening {{venueName}} in {{city}}!

We noticed you recently received your license and wanted to reach out at the perfect time.

I run Gigxo — a South Florida entertainment marketplace connecting new venues with verified DJs, live bands, and performers.

We'd love to send you 3 free entertainment quotes from artists who specialize in venues just like yours — no commitment, no cost to you.

New venues that book entertainment in their first 60 days see significantly higher opening night attendance and social media buzz.

Interested? Just reply to this email and I'll send you your free quotes within 24 hours.

Looking forward to helping {{venueName}} have an incredible opening,

Teryn
Gigxo — South Florida Entertainment
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
  const venueName = venue.title?.trim() || "your venue";
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
