/**
 * Default email copy for admin DJ outreach hub (manual queue).
 */

export interface DjOutreachTemplateInput {
  name: string;
  instagramHandle?: string | null;
}

const DEFAULT_SUBJECT = "Hey {{name}} — gigs in South Florida on Gigxo";

const DEFAULT_BODY = `Hey {{name}},

I'm Teryn with Gigxo. We post real paid requests from venues and private events in South Florida — DJs and live acts browse and apply to what fits.

It's free to create a profile and see what's open: https://gigxo.com/signup

If you're already on Instagram as {{igLine}}, we can keep it simple — reply here or sign up when you have a minute.

—Teryn
Gigxo`;

export function renderDjOutreachTemplate(input: DjOutreachTemplateInput): { subject: string; body: string } {
  const name = input.name?.trim() || "there";
  const ig = input.instagramHandle?.trim().replace(/^@/, "");
  const igLine = ig ? `@${ig}` : "your handle";

  const replace = (text: string) =>
    text.replace(/\{\{name\}\}/g, name).replace(/\{\{igLine\}\}/g, igLine);

  return {
    subject: replace(DEFAULT_SUBJECT),
    body: replace(DEFAULT_BODY),
  };
}
