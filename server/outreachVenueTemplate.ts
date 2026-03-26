/**
 * Template engine for venue outreach emails (Outreach Hub).
 * Replaces {{venueName}} in subject; greeting uses venue title when present.
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

const DEFAULT_SUBJECT = "Free performer booking for {{venueName}}";

const BODY_AFTER_GREETING = `

I run Gigxo — a platform connecting South Florida venues with vetted local performers.

Whether you book entertainment regularly or are looking to add live music, DJs, or performers to your lineup, we make it simple:

- Post your gig for free
- We match you with vetted local talent
- You choose who fits your vibe
- Zero commission, zero fees — ever

Post your first gig free → https://gigxo.com/book

Best,
Teryn
Gigxo`;

export function renderVenueTemplate(venue: VenueTemplateInput): { subject: string; body: string } {
  const rawTitle = venue.title?.trim() || "";
  const venueName = rawTitle ? toTitleCase(rawTitle) : "your venue";
  const greeting = rawTitle ? `Hi ${venueName} team,` : "Hi there,";

  const subject = DEFAULT_SUBJECT.replace(/\{\{venueName\}\}/g, venueName);

  return {
    subject,
    body: greeting + BODY_AFTER_GREETING,
  };
}
