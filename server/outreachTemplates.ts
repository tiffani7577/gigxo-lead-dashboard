/**
 * Admin outreach templates for venue/lead outreach.
 * Used by one-click and bulk outreach (Phase 3). Copy is editable here.
 */

export type OutreachTemplateId = "venue_intro" | "follow_up" | "performer_supply" | "venue_outreach" | "performer_outreach";

export interface OutreachTemplate {
  id: OutreachTemplateId;
  label: string;
  subject: string;
  body: string;
}

const PLACEHOLDERS = {
  venueName: "{{venueName}}",
  location: "{{location}}",
  city: "{{city}}",
  ownerName: "{{ownerName}}",
  platformLink: "{{platformLink}}",
  artistName: "{{artistName}}",
  link: "{{link}}",
} as const;

export const OUTREACH_TEMPLATES: OutreachTemplate[] = [
  {
    id: "venue_intro",
    label: "Venue intro",
    subject: "Gigxo — South Florida performer network",
    body: `Hi there,

We're Gigxo — we connect South Florida venues and event planners with DJs, bands, and performers.

We noticed {{venueName}} ({{location}}) and thought you might like to be part of our recommended venue list. Event hosts in Miami, Fort Lauderdale, Boca, and West Palm use Gigxo to find entertainment.

No cost to be listed. Reply if you'd like to learn more.

Best,
The Gigxo Team`,
  },
  {
    id: "follow_up",
    label: "Follow-up",
    subject: "Re: Gigxo — South Florida performer network",
    body: `Hi,

Just following up on our note about including {{venueName}} in the Gigxo venue network.

If you're open to a quick chat about how we can refer performers your way, reply to this email or reach out anytime.

Best,
The Gigxo Team`,
  },
  {
    id: "performer_supply",
    label: "Performer supply pitch",
    subject: "DJs and performers for your events — Gigxo",
    body: `Hi,

Gigxo helps venues and event planners in South Florida book DJs, bands, and live performers. We have a vetted network across Miami, Fort Lauderdale, Boca, and West Palm.

If you're looking for entertainment for upcoming events at {{venueName}}, we can connect you with pros who match your vibe and budget.

Reply to learn more — no obligation.

Best,
The Gigxo Team`,
  },
  {
    id: "venue_outreach",
    label: "Venue outreach (DBPR)",
    subject: "Free performer booking for {{venueName}}",
    body: `Hi {{venueName}} team,

I run Gigxo — a platform connecting South Florida venues with vetted local performers.

Whether you book entertainment regularly or are looking to add live music, DJs, or performers to your lineup, we make it simple:

- Post your gig for free
- We match you with vetted local talent
- You choose who fits your vibe
- Zero commission, zero fees — ever

Post your first gig free → https://gigxo.com/book

Best,
Teryn
Gigxo | Fort Lauderdale, FL 33316
To unsubscribe reply UNSUBSCRIBE`,
  },
  {
    id: "performer_outreach",
    label: "Performer outreach",
    subject: "Hey [ARTIST_NAME] — gig opportunities in [CITY]",
    body: `Hey [ARTIST_NAME],

Gigxo surfaces real gig opportunities for DJs and performers in South Florida.

New gigs appear daily and can be unlocked instantly.

You can check them out here:
[LINK]`,
  },
];

export function getOutreachTemplate(id: OutreachTemplateId): OutreachTemplate | undefined {
  return OUTREACH_TEMPLATES.find((t) => t.id === id);
}

export interface OutreachTemplateVars {
  venueName?: string;
  location?: string;
  city?: string;
  ownerName?: string;
  platformLink?: string;
  artistName?: string;
  link?: string;
}

/** Replace placeholders in template body/subject. Supports {{x}} and [X_NAME] style. */
export function renderOutreachTemplate(
  template: OutreachTemplate,
  venueName: string,
  location: string,
  extra: OutreachTemplateVars = {}
): { subject: string; body: string } {
  const city = extra.city ?? location.split(",")[0]?.trim() ?? location;
  const vars: Record<string, string> = {
    [PLACEHOLDERS.venueName]: venueName,
    [PLACEHOLDERS.location]: location,
    [PLACEHOLDERS.city]: city,
    [PLACEHOLDERS.ownerName]: extra.ownerName ?? "",
    [PLACEHOLDERS.platformLink]: extra.platformLink ?? "https://gigxo.com",
    [PLACEHOLDERS.artistName]: extra.artistName ?? "",
    [PLACEHOLDERS.link]: extra.link ?? "https://gigxo.com/dashboard",
    "[VENUE_NAME]": venueName,
    "[CITY]": city,
    "[OWNER_NAME]": extra.ownerName ?? "",
    "[PLATFORM_LINK]": extra.platformLink ?? "https://gigxo.com",
    "[ARTIST_NAME]": extra.artistName ?? "",
    "[LINK]": extra.link ?? "https://gigxo.com/dashboard",
  };
  let subj = template.subject;
  let body = template.body;
  for (const [key, value] of Object.entries(vars)) {
    subj = subj.split(key).join(value);
    body = body.split(key).join(value);
  }
  return { subject: subj, body };
}
