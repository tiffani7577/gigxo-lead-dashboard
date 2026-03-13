/**
 * Gigxo Intelligence Engine
 * -------------------------
 * Scores raw scraped documents and enriches them with:
 *   - Source reliability scoring
 *   - Contact quality scoring
 *   - Lead freshness decay
 *   - Buyer-type classification
 *   - Venue type inference
 *   - Win probability calculation
 *   - Competition level detection
 *   - Suggested rate range
 *   - Pitch style suggestion
 *   - Lead temperature (HOT / WARM / COLD)
 *   - Evidence snippets for transparency
 *   - Duplicate fingerprinting
 *
 * All functions are pure (no DB calls) so they can be unit-tested easily.
 * The scraper calls enrichLead() after LLM classification.
 */

import crypto from "crypto";
import {
  INTELLIGENCE_WEIGHTS,
  SOURCE_TRUST_SCORES,
  CONTACT_QUALITY_SCORES,
  FRESHNESS_DECAY,
  BUYER_TYPE_BONUSES,
  BUYER_TYPE_PATTERNS,
  VENUE_TYPE_PATTERNS,
  PITCH_STYLE_MAP,
  RATE_RANGES,
  CITY_TIER_MAP,
} from "./intelligenceConfig";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RawScrapedDoc {
  title: string;
  body: string;
  url: string;
  sourceLabel: string;         // e.g. "Reddit r/weddingplanning"
  sourceDomain: string;        // e.g. "reddit.com/r/weddingplanning"
  city: string;
  marketId: string;
  scrapedAt: Date;
  contactEmail?: string;
  contactPhone?: string;
  contactName?: string;
  contactInstagram?: string;
  contactFormUrl?: string;
  intentScore: number;         // 0–100 from LLM classifier
  eventWindowId?: number;
  eventWindowBoost?: number;   // multiplier from active event window
  scrapeKeyword?: string;
}

export interface EnrichedLead {
  // Core
  title: string;
  description: string;
  location: string;
  sourceLabel: string;
  venueUrl: string;

  // Contact
  contactEmail?: string;
  contactPhone?: string;
  contactName?: string;

  // Intelligence scores
  sourceTrust: number;
  contactScore: number;
  freshnessScore: number;
  intentScore: number;
  finalScore: number;

  // Gig intelligence
  winProbability: number;
  competitionLevel: "low" | "medium" | "high";
  suggestedRate: string;
  pitchStyle: string;
  leadTemperature: "hot" | "warm" | "cold";
  buyerType: string;
  venueType: string;
  estimatedGuestCount?: number;
  prestigeScore: number;
  urgencyScore: number;
  budgetConfidence: "low" | "medium" | "high";

  // Evidence
  intentEvidence: string;
  contactEvidence: string;
  eventEvidence: string;
  sourceEvidence: string;

  // Metadata
  eventWindowId?: number;
  scrapeKeyword?: string;
  contentHash: string;
}

// ─── Source Trust ─────────────────────────────────────────────────────────────

export function getSourceTrust(sourceDomain: string): number {
  // Try exact match first
  if (SOURCE_TRUST_SCORES[sourceDomain] !== undefined) {
    return SOURCE_TRUST_SCORES[sourceDomain];
  }
  // Try prefix match (e.g. "reddit.com/r/weddingplanning" → "reddit")
  for (const [key, score] of Object.entries(SOURCE_TRUST_SCORES)) {
    if (sourceDomain.includes(key) || key.includes(sourceDomain)) {
      return score;
    }
  }
  return SOURCE_TRUST_SCORES["default"];
}

// ─── Contact Quality ──────────────────────────────────────────────────────────

export function scoreContactQuality(doc: Pick<RawScrapedDoc, "contactEmail" | "contactPhone" | "contactName" | "contactInstagram" | "contactFormUrl" | "body">): {
  score: number;
  evidence: string;
} {
  let score = 0;
  const evidenceParts: string[] = [];

  if (doc.contactEmail) {
    score += CONTACT_QUALITY_SCORES.directEmail;
    evidenceParts.push("direct email available");
  }
  if (doc.contactPhone) {
    score += CONTACT_QUALITY_SCORES.directPhone;
    evidenceParts.push("direct phone available");
  }
  if (doc.contactName) {
    score += CONTACT_QUALITY_SCORES.plannerName;
    evidenceParts.push(`contact name: ${doc.contactName}`);
  }
  if (doc.contactInstagram) {
    score += CONTACT_QUALITY_SCORES.instagramProfile;
    evidenceParts.push("Instagram profile available");
  }
  if (doc.contactFormUrl) {
    score += CONTACT_QUALITY_SCORES.contactFormUrl;
    evidenceParts.push("contact form available");
  }

  // Check body text for additional contact signals
  const bodyLower = (doc.body || "").toLowerCase();
  if (!doc.contactEmail && /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i.test(doc.body || "")) {
    score += CONTACT_QUALITY_SCORES.directEmail;
    evidenceParts.push("email found in post text");
  }
  if (!doc.contactPhone && /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(doc.body || "")) {
    score += CONTACT_QUALITY_SCORES.directPhone;
    evidenceParts.push("phone found in post text");
  }
  if (bodyLower.includes("dm me") || bodyLower.includes("message me") || bodyLower.includes("send me a message")) {
    score += CONTACT_QUALITY_SCORES.redditUsername;
    evidenceParts.push("DM request in post");
  }

  // Cap at 100
  score = Math.min(100, score);

  return {
    score,
    evidence: evidenceParts.length > 0 ? evidenceParts.join(", ") : "contact via post URL",
  };
}

// ─── Freshness Decay ──────────────────────────────────────────────────────────

export function getFreshnessMultiplier(scrapedAt: Date): number {
  const ageHours = (Date.now() - scrapedAt.getTime()) / (1000 * 60 * 60);
  for (const { maxHours, multiplier } of FRESHNESS_DECAY) {
    if (ageHours <= maxHours) return multiplier;
  }
  return 0.15;
}

// ─── Buyer Type Classification ────────────────────────────────────────────────

export function classifyBuyerType(text: string): { buyerType: string; evidence: string } {
  const combined = text.toLowerCase();
  for (const { type, patterns } of BUYER_TYPE_PATTERNS) {
    for (const pattern of patterns) {
      const match = combined.match(pattern);
      if (match) {
        return {
          buyerType: type,
          evidence: `${type} detected: "${match[0]}"`,
        };
      }
    }
  }
  return { buyerType: "unknown", evidence: "buyer type not determined" };
}

// ─── Venue Type Inference ─────────────────────────────────────────────────────

export function inferVenueType(text: string): { venueType: string; prestige: number } {
  for (const { type, prestige, patterns } of VENUE_TYPE_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return { venueType: type, prestige };
      }
    }
  }
  return { venueType: "unknown", prestige: 40 };
}

// ─── Guest Count Extraction ───────────────────────────────────────────────────

export function extractGuestCount(text: string): number | undefined {
  const patterns = [
    /(\d+)\s*(?:\+)?\s*(?:guests?|people|attendees|persons?|pax)\b/i,
    /(?:for|expect(?:ing)?|anticipat(?:ing)?)\s+(?:about|around|approximately|roughly|~)?\s*(\d+)\s*(?:guests?|people)/i,
    /(?:crowd|audience|group)\s+of\s+(?:about|around|~)?\s*(\d+)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const count = parseInt(match[1], 10);
      if (count >= 10 && count <= 10000) return count;
    }
  }
  return undefined;
}

// ─── Urgency Score ────────────────────────────────────────────────────────────

export function calculateUrgencyScore(text: string, eventDate?: Date): number {
  let score = 50; // baseline

  const textLower = text.toLowerCase();

  // Urgency language
  if (/\b(urgent|asap|immediately|last.?minute|emergency|need.?now|today|tonight)\b/i.test(text)) score += 30;
  if (/\b(still looking|haven.?t found|replacement|backup|need.?someone)\b/i.test(text)) score += 20;
  if (/\b(finalizing|almost booked|nearly there|wrapping up)\b/i.test(text)) score += 15;
  if (/\b(this weekend|next weekend|next week|this week)\b/i.test(text)) score += 25;

  // Date proximity
  if (eventDate) {
    const daysUntil = (eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysUntil < 0) score -= 50;        // Past event
    else if (daysUntil <= 7) score += 30;  // This week
    else if (daysUntil <= 14) score += 20; // Next 2 weeks
    else if (daysUntil <= 30) score += 10; // This month
    else if (daysUntil <= 90) score += 5;  // Next 3 months
    else if (daysUntil > 365) score -= 10; // Over a year away
  }

  return Math.min(100, Math.max(0, score));
}

// ─── Win Probability ──────────────────────────────────────────────────────────

export function calculateWinProbability(params: {
  contactScore: number;
  intentScore: number;
  sourceTrust: number;
  buyerType: string;
  venuePrestige: number;
  urgencyScore: number;
  freshnessMultiplier: number;
  eventWindowBoost: number;
}): { probability: number; competitionLevel: "low" | "medium" | "high" } {
  const {
    contactScore, intentScore, sourceTrust, buyerType,
    venuePrestige, urgencyScore, freshnessMultiplier, eventWindowBoost,
  } = params;

  // Base probability from contact quality (most important factor)
  let prob = 0.30; // baseline

  // Contact quality contribution
  if (contactScore >= 70) prob += 0.25;
  else if (contactScore >= 40) prob += 0.15;
  else if (contactScore >= 20) prob += 0.08;
  else prob += 0.02;

  // Intent score contribution
  if (intentScore >= 80) prob += 0.15;
  else if (intentScore >= 60) prob += 0.10;
  else if (intentScore >= 40) prob += 0.05;

  // Source trust
  prob += sourceTrust * 0.10;

  // Buyer type bonus
  const buyerBonus = BUYER_TYPE_BONUSES[buyerType] || 0;
  prob += (buyerBonus / 100) * 0.10;

  // Venue prestige
  prob += (venuePrestige / 100) * 0.08;

  // Urgency (high urgency = easier to win fast)
  if (urgencyScore >= 70) prob += 0.05;

  // Freshness
  prob *= freshnessMultiplier;

  // Event window boost
  if (eventWindowBoost > 1.0) prob += 0.05;

  // Clamp to 0.05–0.95
  prob = Math.min(0.95, Math.max(0.05, prob));

  // Competition level: inverse of probability + freshness
  let competitionLevel: "low" | "medium" | "high";
  if (prob >= 0.70 && freshnessMultiplier >= 0.75) competitionLevel = "low";
  else if (prob >= 0.45) competitionLevel = "medium";
  else competitionLevel = "high";

  return { probability: Math.round(prob * 100) / 100, competitionLevel };
}

// ─── Suggested Rate ───────────────────────────────────────────────────────────

export function getSuggestedRate(marketId: string, eventType: string, performerType: string): string {
  const tier = CITY_TIER_MAP[marketId] || "tier3";
  const rates = RATE_RANGES[tier];

  // Try specific combination first
  const key = `${eventType}_${performerType}`;
  if (rates[key]) return rates[key];

  // Try event type only
  const eventKey = `${eventType}_default`;
  if (rates[eventKey]) return rates[eventKey];

  return rates["default"];
}

// ─── Pitch Style ──────────────────────────────────────────────────────────────

export function getPitchStyle(eventType: string, buyerType: string): string {
  const key = `${eventType}_${buyerType}`;
  return PITCH_STYLE_MAP[key] || PITCH_STYLE_MAP["default"];
}

// ─── Lead Temperature ─────────────────────────────────────────────────────────

export function classifyLeadTemperature(params: {
  contactScore: number;
  intentScore: number;
  freshnessMultiplier: number;
  winProbability: number;
}): "hot" | "warm" | "cold" {
  const { contactScore, intentScore, freshnessMultiplier, winProbability } = params;

  // HOT: contact present + fresh + high intent + high win probability
  if (contactScore >= 35 && freshnessMultiplier >= 0.75 && intentScore >= 65 && winProbability >= 0.60) {
    return "hot";
  }

  // COLD: weak contact + stale + low intent
  if (contactScore < 10 && freshnessMultiplier < 0.55 && intentScore < 50) {
    return "cold";
  }

  return "warm";
}

// ─── Budget Confidence ────────────────────────────────────────────────────────

export function assessBudgetConfidence(text: string, venuePrestige: number, guestCount?: number): {
  confidence: "low" | "medium" | "high";
  evidence: string;
} {
  const signals: string[] = [];
  let score = 0;

  // Explicit budget mentioned
  if (/\$[\d,]+|\bbudget\b|\brate\b|\bpay\b|\bcompensation\b/i.test(text)) {
    score += 3;
    signals.push("budget mentioned");
  }
  // Guest count known
  if (guestCount && guestCount > 0) {
    score += 2;
    signals.push(`${guestCount} guests`);
  }
  // Venue prestige
  if (venuePrestige >= 75) {
    score += 2;
    signals.push("upscale venue");
  } else if (venuePrestige >= 55) {
    score += 1;
    signals.push("mid-tier venue");
  }
  // Planner/corporate signal
  if (/\b(event planner|corporate|company|brand|sponsor)\b/i.test(text)) {
    score += 2;
    signals.push("professional buyer");
  }

  const confidence: "low" | "medium" | "high" = score >= 5 ? "high" : score >= 3 ? "medium" : "low";
  return { confidence, evidence: signals.join(", ") || "limited budget signals" };
}

// ─── Content Fingerprint (Deduplication) ─────────────────────────────────────

export function generateContentFingerprint(params: {
  city: string;
  title: string;
  body: string;
  eventDate?: Date;
}): string {
  const { city, title, body, eventDate } = params;

  // Normalize: lowercase, remove punctuation, collapse whitespace
  const normalizeText = (s: string) =>
    s.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();

  // Extract month-year from event date or body
  let monthKey = "unknown";
  if (eventDate) {
    monthKey = `${eventDate.getFullYear()}-${eventDate.getMonth() + 1}`;
  } else {
    const monthMatch = body.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4}|\d{2})\b/i);
    if (monthMatch) monthKey = monthMatch[0].toLowerCase();
  }

  // Take first 100 chars of normalized title + first 200 of body
  const titleNorm = normalizeText(title).slice(0, 100);
  const bodyNorm = normalizeText(body).slice(0, 200);
  const cityNorm = normalizeText(city).slice(0, 30);

  const fingerprint = `${cityNorm}|${monthKey}|${titleNorm}|${bodyNorm}`;
  return crypto.createHash("sha256").update(fingerprint).digest("hex");
}

// ─── Main Enrichment Function ─────────────────────────────────────────────────

export function enrichLead(doc: RawScrapedDoc, eventDate?: Date): EnrichedLead {
  const text = `${doc.title} ${doc.body}`;

  // 1. Source trust
  const sourceTrust = getSourceTrust(doc.sourceDomain);

  // 2. Contact quality
  const { score: contactScore, evidence: contactEvidence } = scoreContactQuality({
    contactEmail: doc.contactEmail,
    contactPhone: doc.contactPhone,
    contactName: doc.contactName,
    contactInstagram: doc.contactInstagram,
    contactFormUrl: doc.contactFormUrl,
    body: doc.body,
  });

  // 3. Freshness
  const freshnessScore = getFreshnessMultiplier(doc.scrapedAt);

  // 4. Buyer type
  const { buyerType, evidence: buyerEvidence } = classifyBuyerType(text);

  // 5. Venue type
  const { venueType, prestige: venuePrestige } = inferVenueType(text);

  // 6. Guest count
  const estimatedGuestCount = extractGuestCount(text);

  // 7. Urgency
  const urgencyScore = calculateUrgencyScore(text, eventDate);

  // 8. Win probability + competition level
  const { probability: winProbability, competitionLevel } = calculateWinProbability({
    contactScore,
    intentScore: doc.intentScore,
    sourceTrust,
    buyerType,
    venuePrestige,
    urgencyScore,
    freshnessMultiplier: freshnessScore,
    eventWindowBoost: doc.eventWindowBoost || 1.0,
  });

  // 9. Suggested rate
  const performerTypeKey = "dj"; // will be overridden by scraper based on performerType
  const suggestedRate = getSuggestedRate(doc.marketId, buyerType, performerTypeKey);

  // 10. Pitch style
  const pitchStyle = getPitchStyle(buyerType, buyerType);

  // 11. Lead temperature
  const leadTemperature = classifyLeadTemperature({
    contactScore,
    intentScore: doc.intentScore,
    freshnessMultiplier: freshnessScore,
    winProbability,
  });

  // 12. Budget confidence
  const { confidence: budgetConfidence } = assessBudgetConfidence(text, venuePrestige, estimatedGuestCount);

  // 13. Prestige score (venue prestige + buyer type bonus)
  const buyerBonus = BUYER_TYPE_BONUSES[buyerType] || 0;
  const prestigeScore = Math.min(100, Math.round(venuePrestige * 0.7 + buyerBonus * 0.3));

  // 14. Final composite score
  const weights = INTELLIGENCE_WEIGHTS;
  const baseScore =
    (doc.intentScore * weights.intentWeight) +
    (contactScore * weights.contactWeight) +
    (freshnessScore * 100 * weights.freshnessWeight) +
    (sourceTrust * 100 * weights.sourceTrustWeight) +
    (buyerBonus * weights.buyerTypeWeight) +
    ((doc.eventWindowBoost ? (doc.eventWindowBoost - 1) * 100 : 0) * weights.eventWindowWeight) +
    (venuePrestige * weights.venueTypeWeight);

  const finalScore = Math.min(100, Math.round(baseScore * (doc.eventWindowBoost || 1.0)));

  // 15. Evidence snippets
  const intentEvidence = doc.intentScore >= 70
    ? `Strong vendor request detected (intent score: ${doc.intentScore})`
    : `Moderate vendor interest (intent score: ${doc.intentScore})`;

  const eventEvidence = [
    eventDate ? `Event date: ${eventDate.toLocaleDateString()}` : null,
    estimatedGuestCount ? `~${estimatedGuestCount} guests` : null,
    venueType !== "unknown" ? `Venue type: ${venueType.replace(/_/g, " ")}` : null,
    buyerEvidence,
  ].filter(Boolean).join("; ") || "event details inferred from post";

  const sourceEvidence = `Source: ${doc.sourceLabel} (trust: ${Math.round(sourceTrust * 100)}%)`;

  // 16. Content fingerprint
  const contentHash = generateContentFingerprint({
    city: doc.city,
    title: doc.title,
    body: doc.body,
    eventDate,
  });

  return {
    title: doc.title,
    description: doc.body,
    location: doc.city,
    sourceLabel: doc.sourceLabel,
    venueUrl: doc.url,
    contactEmail: doc.contactEmail,
    contactPhone: doc.contactPhone,
    contactName: doc.contactName,

    sourceTrust,
    contactScore,
    freshnessScore,
    intentScore: doc.intentScore,
    finalScore,

    winProbability,
    competitionLevel,
    suggestedRate,
    pitchStyle,
    leadTemperature,
    buyerType,
    venueType,
    estimatedGuestCount,
    prestigeScore,
    urgencyScore,
    budgetConfidence,

    intentEvidence,
    contactEvidence,
    eventEvidence,
    sourceEvidence,

    eventWindowId: doc.eventWindowId,
    scrapeKeyword: doc.scrapeKeyword,
    contentHash,
  };
}
