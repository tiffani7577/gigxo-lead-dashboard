/**
 * Admin outreach templates for venue/lead outreach.
 * Used by one-click and bulk outreach (Phase 3). Copy is editable here.
 */

export type OutreachTemplateId = "venue_intro" | "follow_up" | "performer_supply";

export interface OutreachTemplate {
  id: OutreachTemplateId;
  label: string;
  subject: string;
  body: string;
}

const PLACEHOLDERS = {
  venueName: "{{venueName}}",
  location: "{{location}}",
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
];

export function getOutreachTemplate(id: OutreachTemplateId): OutreachTemplate | undefined {
  return OUTREACH_TEMPLATES.find((t) => t.id === id);
}

/** Replace {{venueName}} and {{location}} in template body/subject. */
export function renderOutreachTemplate(
  template: OutreachTemplate,
  venueName: string,
  location: string
): { subject: string; body: string } {
  const subj = template.subject
    .replace(PLACEHOLDERS.venueName, venueName)
    .replace(PLACEHOLDERS.location, location);
  const body = template.body
    .replace(PLACEHOLDERS.venueName, venueName)
    .replace(PLACEHOLDERS.location, location);
  return { subject: subj, body };
}
