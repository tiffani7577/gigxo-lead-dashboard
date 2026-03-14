/**
 * Lead scoring for outreach priority.
 * +40 new liquor license, +20 nightlife category, +10 South Florida, +10 venue capacity > 100, +5 Instagram present.
 * Sort outreach by highest score first.
 */

export type LeadInput = {
  leadType?: string | null;
  source?: string | null;
  city?: string | null;
  state?: string | null;
  instagram?: string | null;
  /** Metadata: e.g. { hasNewLiquorLicense, isNightlife, capacity } — can come from source/import */
  metadata?: {
    hasNewLiquorLicense?: boolean;
    isNightlife?: boolean;
    capacity?: number;
  } | null;
};

const SOUTH_FLORIDA_PATTERN = /miami|fort lauderdale|boca|west palm|broward|palm beach|south florida|fl\.?$/i;

export function computeLeadScore(lead: LeadInput): number {
  let score = 0;
  const meta = lead.metadata ?? {};

  if (meta.hasNewLiquorLicense === true) score += 40;
  if (meta.isNightlife === true) score += 20;

  const cityState = [lead.city, lead.state].filter(Boolean).join(" ");
  if (SOUTH_FLORIDA_PATTERN.test(cityState)) score += 10;

  const cap = meta.capacity ?? 0;
  if (typeof cap === "number" && cap > 100) score += 10;

  if (lead.instagram != null && String(lead.instagram).trim() !== "") score += 5;

  return score;
}
