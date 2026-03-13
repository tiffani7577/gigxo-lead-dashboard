/**
 * Gigxo Lead Pricing — 2 tiers only:
 *   Standard  — $7   (budget under $1,500)
 *   Premium   — $15  (budget $1,500 and above)
 *
 * First-time unlock: $1 (100 cents) charged via Stripe.
 * If the lead has an explicit unlockPriceCents admin override, that takes priority.
 */

export const FIRST_UNLOCK_PRICE_CENTS = 100; // $1

/** Budget threshold (cents) above which a lead becomes Premium */
const PREMIUM_THRESHOLD_CENTS = 150_000; // $1,500

export const CREDIT_PACKS = [
  { id: "pack_3",  label: "Starter Pack",  unlocks: 3,  priceCents: 1800, priceDollars: 18, savings: "$3",  highlighted: false },
  { id: "pack_10", label: "Pro Pack",       unlocks: 10, priceCents: 4900, priceDollars: 49, savings: "$21", highlighted: true  },
  { id: "pack_25", label: "Agency Pack",    unlocks: 25, priceCents: 9900, priceDollars: 99, savings: "$76", highlighted: false },
] as const;

/**
 * Calculate the unlock price for a lead.
 * Admin-set override always takes priority.
 */
export function getLeadUnlockPriceCents(
  budgetCents: number | null | undefined,
  unlockPriceCentsOverride: number | null | undefined
): number {
  if (unlockPriceCentsOverride && unlockPriceCentsOverride > 0) {
    return unlockPriceCentsOverride;
  }
  if (budgetCents && budgetCents >= PREMIUM_THRESHOLD_CENTS) {
    return 1500; // $15 Premium
  }
  return 700; // $7 Standard
}

/** Human-readable price label e.g. "$7" or "$15" */
export function formatLeadPrice(priceCents: number): string {
  return `$${priceCents / 100}`;
}

/** Tier label: "Standard" or "Premium" */
export function getLeadPriceTierLabel(budgetCents: number | null | undefined): "Standard" | "Premium" {
  if (budgetCents && budgetCents >= PREMIUM_THRESHOLD_CENTS) return "Premium";
  return "Standard";
}

/** Whether a lead should show a Premium badge */
export function isPremiumLead(budgetCents: number | null | undefined): boolean {
  return !!(budgetCents && budgetCents >= PREMIUM_THRESHOLD_CENTS);
}
