/**
 * Renders outreach email subject/body with lead variables.
 * Variables: {{name}}, {{venue}}, {{city}}
 */

export type LeadForTemplate = {
  name?: string | null;
  businessName?: string | null;
  city?: string | null;
};

export type TemplateForRender = {
  subjectTemplate: string;
  bodyTemplate: string;
};

function escapeReplacement(s: string | null | undefined): string {
  if (s == null || s === "") return "";
  return String(s);
}

function replaceVariables(text: string, lead: LeadForTemplate): string {
  const name = escapeReplacement(lead.name);
  const venue = escapeReplacement(lead.businessName) || escapeReplacement(lead.name);
  const city = escapeReplacement(lead.city);

  return text
    .replace(/\{\{name\}\}/g, name)
    .replace(/\{\{venue\}\}/g, venue)
    .replace(/\{\{city\}\}/g, city);
}

/**
 * Renders subject and body with {{name}}, {{venue}}, {{city}} replaced from the lead.
 */
export function renderTemplate(
  template: TemplateForRender,
  lead: LeadForTemplate
): { subject: string; body: string } {
  return {
    subject: replaceVariables(template.subjectTemplate, lead),
    body: replaceVariables(template.bodyTemplate, lead),
  };
}
