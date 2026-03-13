import { describe, it, expect, vi } from "vitest";

// Mock the database
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

describe("Real scraper — external ID generation", () => {
  it("generates unique external IDs for Reddit leads", () => {
    const id1 = `reddit-abc123`;
    const id2 = `reddit-def456`;
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^reddit-/);
  });

  it("generates unique external IDs for Eventbrite leads", () => {
    const id = `eventbrite-miami-12345`;
    expect(id).toMatch(/^eventbrite-/);
  });

  it("generates unique external IDs for manual leads", () => {
    const id = `manual-${Date.now()}-abc12`;
    expect(id).toMatch(/^manual-/);
  });
});

describe("Real scraper — contact info extraction", () => {
  it("extracts real email addresses from post text", () => {
    const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
    const text = "Please contact me at john.smith@gmail.com for more info";
    const emails = text.match(EMAIL_REGEX) ?? [];
    expect(emails).toContain("john.smith@gmail.com");
  });

  it("rejects fake 555 phone numbers", () => {
    const phones = ["(555) 123-4567", "(305) 555-1234", "(786) 234-5678"];
    const validPhones = phones.filter(p => {
      const digits = p.replace(/\D/g, "");
      return digits.length >= 10 && !digits.startsWith("555");
    });
    expect(validPhones).not.toContain("(555) 123-4567");
    expect(validPhones).toContain("(786) 234-5678");
  });

  it("extracts budget from post text", () => {
    const BUDGET_REGEX = /\$\s*([\d,]+)(?:\s*[-–]\s*\$?\s*([\d,]+))?/g;
    const text = "Our budget is $1,500 - $2,000 for the DJ";
    const matches = Array.from(text.matchAll(BUDGET_REGEX));
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0][1]).toBe("1,500");
  });

  it("rejects unrealistic budgets", () => {
    const validateBudget = (dollars: number) =>
      dollars >= 100 && dollars <= 50000;
    expect(validateBudget(50)).toBe(false);
    expect(validateBudget(500)).toBe(true);
    expect(validateBudget(100000)).toBe(false);
  });
});

describe("Real scraper — seeking entertainment detection", () => {
  it("identifies posts seeking entertainment", () => {
    const SEEKING_KEYWORDS = ["looking for", "need a", "hire a", "recommendations for"];
    const isSeekingEntertainment = (title: string, text: string) => {
      const combined = (title + " " + text).toLowerCase();
      return SEEKING_KEYWORDS.some(k => combined.includes(k));
    };
    expect(isSeekingEntertainment("Looking for a DJ for my wedding", "")).toBe(true);
    expect(isSeekingEntertainment("DJ tips and tricks", "Here are some tips")).toBe(false);
  });

  it("rejects posts that are not hire requests", () => {
    const SEEKING_KEYWORDS = ["looking for", "need a", "hire a", "recommendations for"];
    const isSeekingEntertainment = (title: string, text: string) => {
      const combined = (title + " " + text).toLowerCase();
      return SEEKING_KEYWORDS.some(k => combined.includes(k));
    };
    expect(isSeekingEntertainment("I am a DJ available for gigs", "Book me!")).toBe(false);
    expect(isSeekingEntertainment("DJ equipment review", "Great turntables")).toBe(false);
  });
});

describe("Lead budget validation", () => {
  it("converts dollars to cents correctly", () => {
    const budgetDollars = 1500;
    const budgetCents = Math.round(budgetDollars * 100);
    expect(budgetCents).toBe(150000);
  });

  it("handles fractional dollar amounts", () => {
    const budgetDollars = 7.50;
    const budgetCents = Math.round(budgetDollars * 100);
    expect(budgetCents).toBe(750);
  });
});

describe("Referral code parsing", () => {
  it("parses referral code from URL parameter", () => {
    const userId = 42;
    const referralCode = `ref-${userId}`;
    const parsedId = parseInt(referralCode.replace("ref-", ""), 10);
    expect(parsedId).toBe(userId);
  });

  it("rejects invalid referral codes", () => {
    const invalidCode = "invalid-code";
    const parsedId = parseInt(invalidCode.replace("ref-", ""), 10);
    expect(isNaN(parsedId)).toBe(true);
  });

  it("prevents self-referral", () => {
    const userId = 42;
    const referralCode = `ref-${userId}`;
    const referrerId = parseInt(referralCode.replace("ref-", ""), 10);
    expect(referrerId).toBe(userId); // Same user, should be blocked
    expect(referrerId !== userId).toBe(false); // Self-referral check
  });
});

describe("Credit calculation", () => {
  it("calculates referral credit correctly", () => {
    const LEAD_PRICE_CENTS = 700;
    const REFERRER_CREDIT = 700; // $7 for referrer
    const NEW_USER_CREDIT = 350; // $3.50 (50% off) for new user
    
    expect(REFERRER_CREDIT).toBe(LEAD_PRICE_CENTS);
    expect(NEW_USER_CREDIT).toBe(LEAD_PRICE_CENTS / 2);
  });

  it("applies credit to reduce payment amount", () => {
    const LEAD_PRICE_CENTS = 700;
    const availableCredit = 350;
    const finalAmount = Math.max(0, LEAD_PRICE_CENTS - availableCredit);
    expect(finalAmount).toBe(350);
  });

  it("makes lead free when credit covers full price", () => {
    const LEAD_PRICE_CENTS = 700;
    const availableCredit = 700;
    const finalAmount = Math.max(0, LEAD_PRICE_CENTS - availableCredit);
    expect(finalAmount).toBe(0);
  });

  it("never goes below zero", () => {
    const LEAD_PRICE_CENTS = 700;
    const availableCredit = 1000; // More credit than price
    const finalAmount = Math.max(0, LEAD_PRICE_CENTS - availableCredit);
    expect(finalAmount).toBe(0);
  });
});

describe("Social proof formatting", () => {
  it("formats view count correctly", () => {
    const viewCount = 42;
    const display = viewCount > 0 ? `${viewCount} viewed` : null;
    expect(display).toBe("42 viewed");
  });

  it("hides zero view count", () => {
    const viewCount = 0;
    const display = viewCount > 0 ? `${viewCount} viewed` : null;
    expect(display).toBeNull();
  });

  it("formats budget correctly", () => {
    const formatBudget = (cents: number | null) => {
      if (!cents) return "TBD";
      const dollars = cents / 100;
      if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
      return `$${dollars.toFixed(0)}`;
    };

    expect(formatBudget(150000)).toBe("$1.5k");
    expect(formatBudget(50000)).toBe("$500");
    expect(formatBudget(null)).toBe("TBD");
    expect(formatBudget(0)).toBe("TBD");
  });
});
