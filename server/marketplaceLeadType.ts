/**
 * Normalize leadType when approving artist-facing marketplace leads so they stay
 * visible under Marketplace (scraped_signal / client_submitted / referral).
 * Shared by admin.approveLead and one-off repair scripts.
 */

export type LeadTypeHintRow = {
  leadType: string | null;
  leadCategory: string | null;
  source: string;
  externalId: string | null;
  description: string | null;
};

const MARKETPLACE_SAFE = new Set(["scraped_signal", "client_submitted", "referral"]);
const VENUE_TYPES = new Set(["venue_intelligence", "manual_outreach"]);

/** True if this row should never be auto-converted to a marketplace scraper/client type. */
export function isVenuePipelineLead(lead: LeadTypeHintRow): boolean {
  const lt = lead.leadType ?? "";
  if (VENUE_TYPES.has(lt)) return true;
  if (lead.leadCategory === "venue_intelligence") return true;
  return false;
}

export function isMarketplaceSafeLeadType(leadType: string | null | undefined): boolean {
  if (leadType == null || leadType === "") return false;
  return MARKETPLACE_SAFE.has(leadType);
}

/**
 * When legacy approve runs, return `{ leadType }` only if we should correct a misplaced type.
 * Empty object = only flip isApproved / isRejected.
 */
export function getLeadTypePatchOnApprove(lead: LeadTypeHintRow): { leadType: "scraped_signal" | "client_submitted" } | Record<string, never> {
  if (isVenuePipelineLead(lead)) return {};

  const lt = lead.leadType ?? "";
  if (MARKETPLACE_SAFE.has(lt)) return {};

  const next = inferScrapedVsClientSubmitted(lead);
  return { leadType: next };
}

/**
 * For approved rows in bulk repair: same inference, but caller filters candidates.
 */
export function inferScrapedVsClientSubmitted(lead: LeadTypeHintRow): "scraped_signal" | "client_submitted" {
  const src = String(lead.source ?? "").toLowerCase();
  if (src === "inbound" || src === "manual") return "client_submitted";

  const ext = String(lead.externalId ?? "");
  if (ext.startsWith("manual-")) return "client_submitted";

  const desc = String(lead.description ?? "").toLowerCase();
  if (desc.includes("referral") && (desc.includes("code") || desc.includes("ref-"))) return "client_submitted";
  if (desc.includes("source:") && (desc.includes("gigxo") || desc.includes("client"))) return "client_submitted";

  return "scraped_signal";
}
