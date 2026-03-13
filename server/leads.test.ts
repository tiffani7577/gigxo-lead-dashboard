import { describe, it, expect, vi } from "vitest";

// Test the scoring algorithm
describe("Lead Scoring Algorithm", () => {
  it("should import scoring module without errors", async () => {
    // The scoring module should be importable
    const scoringModule = await import("./scoring");
    expect(scoringModule).toBeDefined();
    expect(typeof scoringModule.scoreLead).toBe("function");
  });

  it("should return a score between 0 and 100", async () => {
    const { scoreLead: scoreLeadForArtist } = await import("./scoring");
    
    const mockLead = {
      id: 1,
      title: "Wedding DJ Needed",
      description: "Looking for a professional DJ for our wedding reception",
      eventType: "Wedding",
      budget: 150000, // $1500 in cents
      location: "Miami, FL",
      eventDate: new Date("2026-06-15"),
      source: "manual" as const,
      externalId: "test-1",
      contactName: "DJ Vortex",
      contactEmail: "john@example.com",
      contactPhone: "305-555-0100",
      venueUrl: null,
      isApproved: true,
      isRejected: false,
      rejectionReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const mockArtist = {
      id: 1,
      userId: 1,
      genres: ["House", "Top 40", "Hip-Hop"],
      location: "Miami, FL",
      experienceLevel: "professional" as const,
      minBudget: 50000, // $500 in cents
      maxDistance: 30,
      equipment: ["Pioneer CDJ-3000", "DJM-900NXS2"],
      bio: "Professional DJ with 10 years experience",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const result = scoreLeadForArtist(mockLead, mockArtist);
    const score = result.overallScore;
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// Test the Stripe service
describe("Stripe Service", () => {
  it("should return demo mode when no key is set", async () => {
    // Temporarily unset the key
    const originalKey = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    
    // Need to reset module cache to pick up env change
    const { createLeadUnlockPaymentIntent } = await import("./stripe");
    const result = await createLeadUnlockPaymentIntent(1, 1, "Test Lead");
    
    expect(result).toBeDefined();
    expect(result.clientSecret).toBeDefined();
    expect(result.paymentIntentId).toBeDefined();
    
    // Restore
    if (originalKey) process.env.STRIPE_SECRET_KEY = originalKey;
  });

  it("should verify demo payment intents as valid", async () => {
    const originalKey = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    
    const { verifyPaymentIntent } = await import("./stripe");
    const isValid = await verifyPaymentIntent("pi_demo_1_2_12345");
    expect(isValid).toBe(true);
    
    if (originalKey) process.env.STRIPE_SECRET_KEY = originalKey;
  });
});

// Test the email service
describe("Email Service", () => {
  it("should handle missing Resend key gracefully (demo mode)", async () => {
    const originalKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    
    const { sendWelcomeEmail } = await import("./email");
    const result = await sendWelcomeEmail("test@example.com", "Test Artist", "ref-123");
    
    // Should succeed in demo mode (console logging)
    expect(result).toBe(true);
    
    if (originalKey) process.env.RESEND_API_KEY = originalKey;
  });
});
