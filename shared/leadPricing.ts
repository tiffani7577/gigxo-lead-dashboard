/**
 * Gigxo Lead Pricing — 3 tiers (leadTier from pipeline):
 *   starter_friendly — $3  (300 cents)  social/serp, no direct contact
 *   standard        — $7  (700 cents)  phone or real website
 *   premium         — $15 (1500 cents) email, bark/thumbtack/inbound, or DBPR with contact
 */

/** Price per leadTier (cents) */
export const LEAD_TIER_PRICE_CENTS = {
  starter_friendly: 300,
  standard: 700,
  premium: 1500,
} as const;

/** Budget threshold (cents) above which a lead becomes Premium when tier is not set (legacy) */
const PREMIUM_THRESHOLD_CENTS = 150_000; // $1,500

export const CREDIT_PACKS = [
  { id: "pack_3",  label: "Starter Pack",  unlocks: 3,  priceCents: 1800, priceDollars: 18, savings: "$3",  highlighted: false },
  { id: "pack_10", label: "Pro Pack",       unlocks: 10, priceCents: 4900, priceDollars: 49, savings: "$21", highlighted: true  },
  { id: "pack_25", label: "Agency Pack",    unlocks: 25, priceCents: 9900, priceDollars: 99, savings: "$76", highlighted: false },
] as const;

export type LeadTier = keyof typeof LEAD_TIER_PRICE_CENTS;

/** Normalize any raw price to the nearest valid tier price (300, 700, 1500). */
export function normalizeLeadPriceCents(cents: number): number {
  const valid = [300, 700, 1500];
  if (!Number.isFinite(cents) || cents <= 0) return valid[0];
  return valid.reduce((closest, value) =>
    Math.abs(value - cents) < Math.abs(closest - cents) ? value : closest,
  valid[0]);
}

/**
 * Calculate the unlock price for a lead.
 * Admin-set override always takes priority; then leadTier; then legacy budget-based.
 * All results are normalized to the nearest allowed tier price.
 */
export function getLeadUnlockPriceCents(
  budgetCents: number | null | undefined,
  unlockPriceCentsOverride: number | null | undefined,
  leadTier?: LeadTier | null
): number {
  if (unlockPriceCentsOverride && unlockPriceCentsOverride > 0) {
    return normalizeLeadPriceCents(unlockPriceCentsOverride);
  }
  if (leadTier && leadTier in LEAD_TIER_PRICE_CENTS) {
    return LEAD_TIER_PRICE_CENTS[leadTier as LeadTier];
  }
  if (budgetCents && budgetCents >= PREMIUM_THRESHOLD_CENTS) {
    return 1500; // $15 Premium (legacy)
  }
  return 700; // $7 Standard (default)
}

/** Human-readable price label e.g. "$7" or "$15" */
export function formatLeadPrice(priceCents: number): string {
  return `$${priceCents / 100}`;
}

/** Tier label from leadTier or legacy budget */
export function getLeadPriceTierLabel(
  budgetCents: number | null | undefined,
  leadTier?: LeadTier | null
): "Starter" | "Standard" | "Premium" {
  if (leadTier === "starter_friendly") return "Starter";
  if (leadTier === "premium") return "Premium";
  if (leadTier === "standard") return "Standard";
  if (budgetCents && budgetCents >= PREMIUM_THRESHOLD_CENTS) return "Premium";
  return "Standard";
}

/** Whether a lead should show a Premium badge (tier or legacy budget) */
export function isPremiumLead(budgetCents: number | null | undefined, leadTier?: LeadTier | null): boolean {
  if (leadTier === "premium") return true;
  return !!(budgetCents && budgetCents >= PREMIUM_THRESHOLD_CENTS);
}
