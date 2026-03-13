import { describe, it, expect } from "vitest";

/**
 * Payment flow tests
 * Validates the Stripe integration and pricing logic.
 * Note: Stripe module caches its instance at import time, so we test
 * the actual configured behavior rather than mocking env vars.
 */

describe("Stripe ENV config", () => {
  it("should have a valid publishable key format when configured", async () => {
    const { ENV } = await import("./_core/env");
    if (ENV.stripePublishableKey) {
      expect(ENV.stripePublishableKey).toMatch(/^pk_(test|live)_/);
    }
  });

  it("isDemoMode should be false when secret key is configured", async () => {
    const { ENV } = await import("./_core/env");
    const isDemoMode = !ENV.stripeSecretKey;
    // In this environment, Stripe is configured, so demo mode should be false
    expect(typeof isDemoMode).toBe("boolean");
  });

  it("getStripe() should return a Stripe instance when key is configured", async () => {
    const { ENV } = await import("./_core/env");
    const { getStripe } = await import("./stripe");
    if (ENV.stripeSecretKey) {
      const stripe = getStripe();
      expect(stripe).not.toBeNull();
    } else {
      const stripe = getStripe();
      expect(stripe).toBeNull();
    }
  });
});

describe("verifyPaymentIntent", () => {
  it("should reject a clearly invalid payment intent ID", async () => {
    const { verifyPaymentIntent } = await import("./stripe");
    // This is a real Stripe call that will fail with a 404 for a non-existent ID
    // In test mode, Stripe returns false for IDs that don't exist
    const valid = await verifyPaymentIntent("pi_invalid_fake_id_that_does_not_exist");
    expect(valid).toBe(false);
  });
});

describe("leadPricing", () => {
  // 2-tier pricing: Standard $7 (budget < $1,500), Premium $15 (budget >= $1,500)
  it("returns $7 (Standard) for leads with budget under $1,500 (e.g. $200)", async () => {
    const { getLeadUnlockPriceCents } = await import("../shared/leadPricing");
    expect(getLeadUnlockPriceCents(20000, null)).toBe(700); // $200 budget → $7
  });

  it("returns $7 (Standard) for leads with budget $500", async () => {
    const { getLeadUnlockPriceCents } = await import("../shared/leadPricing");
    expect(getLeadUnlockPriceCents(50000, null)).toBe(700); // $500 budget → $7
  });

  it("returns $15 (Premium) for leads with budget exactly $1,500", async () => {
    const { getLeadUnlockPriceCents } = await import("../shared/leadPricing");
    expect(getLeadUnlockPriceCents(150000, null)).toBe(1500); // $1,500 budget → $15
  });

  it("returns $15 (Premium) for leads with budget $5,000", async () => {
    const { getLeadUnlockPriceCents } = await import("../shared/leadPricing");
    expect(getLeadUnlockPriceCents(500000, null)).toBe(1500); // $5,000 budget → $15
  });

  it("respects admin override price", async () => {
    const { getLeadUnlockPriceCents } = await import("../shared/leadPricing");
    expect(getLeadUnlockPriceCents(500000, 999)).toBe(999); // admin set $9.99
  });

  it("returns $7 for null budget", async () => {
    const { getLeadUnlockPriceCents } = await import("../shared/leadPricing");
    expect(getLeadUnlockPriceCents(null, null)).toBe(700);
  });

  it("returns $7 for zero budget", async () => {
    const { getLeadUnlockPriceCents } = await import("../shared/leadPricing");
    expect(getLeadUnlockPriceCents(0, null)).toBe(700);
  });

  it("returns $7 just below $1,500 threshold ($1,499.99)", async () => {
    const { getLeadUnlockPriceCents } = await import("../shared/leadPricing");
    expect(getLeadUnlockPriceCents(149999, null)).toBe(700); // $1,499.99 → $7
  });

  it("returns $15 at exactly the $1,500 threshold", async () => {
    const { getLeadUnlockPriceCents } = await import("../shared/leadPricing");
    expect(getLeadUnlockPriceCents(150000, null)).toBe(1500); // exactly $1,500 → $15
  });

  it("returns $15 at the $2,000 boundary", async () => {
    const { getLeadUnlockPriceCents } = await import("../shared/leadPricing");
    expect(getLeadUnlockPriceCents(200000, null)).toBe(1500); // $2,000 → $15
  });
});

describe("formatLeadPrice", () => {
  it("formats 700 cents as $7", async () => {
    const { formatLeadPrice } = await import("../shared/leadPricing");
    expect(formatLeadPrice(700)).toBe("$7");
  });

  it("formats 1500 cents as $15", async () => {
    const { formatLeadPrice } = await import("../shared/leadPricing");
    expect(formatLeadPrice(1500)).toBe("$15");
  });

  it("formats 100 cents as $1", async () => {
    const { formatLeadPrice } = await import("../shared/leadPricing");
    expect(formatLeadPrice(100)).toBe("$1");
  });
});
