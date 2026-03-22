import { describe, it, expect } from "vitest";
import type { RawLeadDoc } from "./raw-lead-doc";
import {
  assertFullDescriptionEndsWithSourceUrl,
  assertPublicPreviewHasNoSourceUrl,
  formatLeadForDashboard,
  originalPostLinkSuffix,
  classifyBuyerLeadForDashboard,
  type LeadFormatTarget,
} from "./lead-dashboard-format";

function baseDoc(overrides: Partial<RawLeadDoc> = {}): RawLeadDoc {
  return {
    externalId: "test-1",
    source: "reddit",
    sourceType: "reddit",
    sourceLabel: "Reddit r/test",
    title: "Need a DJ for wedding",
    rawText: "We are looking for a DJ for our wedding in Miami next April. Budget around $800.",
    url: "https://reddit.com/r/weddingplanning/comments/abc123",
    postedAt: new Date(),
    city: "Miami, FL",
    metadata: {},
    ...overrides,
  };
}

function baseLead(overrides: Partial<LeadFormatTarget> = {}): LeadFormatTarget {
  return {
    title: "Need a DJ for wedding",
    description: "",
    rawText: "",
    eventType: "Wedding",
    budget: 80_000,
    location: "Miami, FL",
    eventDate: null,
    contactName: null,
    contactEmail: null,
    contactPhone: null,
    performerType: "dj",
    venueUrl: "https://reddit.com/r/weddingplanning/comments/abc123",
    intentScore: 70,
    ...overrides,
  };
}

describe("lead-dashboard-format", () => {
  it("classifies buyer_request when seeking a DJ", () => {
    const doc = baseDoc();
    const lead = baseLead();
    expect(classifyBuyerLeadForDashboard(doc, lead)).toBe("buyer_request");
  });

  it("classifies invalid for DJ self-promo", () => {
    const doc = baseDoc({
      title: "Miami DJ available",
      rawText: "I'm a DJ available for gigs this weekend. Book me on instagram.",
    });
    const lead = baseLead({ title: doc.title });
    expect(classifyBuyerLeadForDashboard(doc, lead)).toBe("invalid");
  });

  it("fullDescription ends with Original post link and URL", () => {
    const doc = baseDoc();
    const lead = baseLead();
    formatLeadForDashboard(doc, lead);
    const u = doc.url.trim();
    expect(lead.fullDescription).toBeDefined();
    assertFullDescriptionEndsWithSourceUrl(lead.fullDescription!, u);
    expect(lead.fullDescription!.endsWith(originalPostLinkSuffix(u))).toBe(true);
  });

  it("public preview does not contain source URL", () => {
    const doc = baseDoc();
    const lead = baseLead();
    formatLeadForDashboard(doc, lead);
    assertPublicPreviewHasNoSourceUrl(lead.publicPreviewDescription!, doc.url);
    expect(lead.publicPreviewDescription).not.toContain("reddit.com");
  });

  it("throws when fullDescription is missing suffix", () => {
    expect(() => assertFullDescriptionEndsWithSourceUrl("Hello world", "https://x.com/y")).toThrow();
  });
});
