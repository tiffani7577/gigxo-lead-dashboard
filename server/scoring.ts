/**
 * Lead Scoring Algorithm
 * Ranks gigs by pay, location, genre match, and venue reputation
 */

import { GigLead, ArtistProfile } from "../drizzle/schema";

export interface LeadScoreBreakdown {
  overallScore: number;
  payScore: number;
  locationScore: number;
  genreScore: number;
  reputationScore: number;
}

/**
 * Calculate pay score (0-100)
 * Higher budget = higher score
 * Baseline: $500 = 50 points, $2000+ = 100 points
 */
function calculatePayScore(budget: number | null | undefined, artistMinBudget: number): number {
  if (!budget || budget < artistMinBudget) return 0;

  // Linear scale: $500 = 50, $2000 = 100
  const normalizedBudget = Math.min(budget, 200000); // Cap at $2000
  return Math.round((normalizedBudget / 200000) * 100);
}

/**
 * Calculate location score (0-100)
 * Based on distance from artist's location
 * Miami/Fort Lauderdale area is roughly 20 miles
 */
function calculateLocationScore(
  leadLat: number | null | undefined,
  leadLng: number | null | undefined,
  artistLat: number | null | undefined,
  artistLng: number | null | undefined,
  maxDistance: number
): number {
  if (!leadLat || !leadLng || !artistLat || !artistLng) return 50; // Neutral if no coords

  // Haversine distance formula (simplified)
  const R = 3959; // Earth radius in miles
  const dLat = ((leadLat - artistLat) * Math.PI) / 180;
  const dLng = ((leadLng - artistLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((artistLat * Math.PI) / 180) *
      Math.cos((leadLat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // Score: 0 distance = 100, max distance = 0
  if (distance > maxDistance) return 0;
  return Math.round(100 - (distance / maxDistance) * 100);
}

/**
 * Calculate genre match score (0-100)
 * Check if event type matches artist genres
 */
function calculateGenreScore(eventType: string | null | undefined, artistGenres: string[]): number {
  if (!eventType || artistGenres.length === 0) return 50;

  const eventTypeLower = eventType.toLowerCase();
  const genreMatches = artistGenres.filter((genre) =>
    eventTypeLower.includes(genre.toLowerCase()) || genre.toLowerCase().includes(eventTypeLower)
  );

  if (genreMatches.length > 0) return 100;
  if (eventTypeLower.includes("wedding") || eventTypeLower.includes("corporate")) return 70;
  if (eventTypeLower.includes("club") || eventTypeLower.includes("dj")) return 60;

  return 40;
}

/**
 * Calculate venue reputation score (0-100)
 * For MVP: based on source and basic heuristics
 */
function calculateReputationScore(source: string, title: string): number {
  // Gigxo direct and admin-added leads are most trusted
  if (source === "gigxo" || source === "manual") return 90;
  if (source === "eventbrite") return 70;
  if (source === "thumbtack" || source === "yelp") return 75;
  if (source === "nextdoor") return 65;
  if (source === "craigslist") return 55;
  if (source === "facebook") return 50;
  // Legacy sources
  if (source === "gigsalad" || source === "thebash") return 75;

  return 50;
}

/**
 * Score a lead for a specific artist
 */
export function scoreLead(lead: GigLead, artist: ArtistProfile): LeadScoreBreakdown {
  const payScore = calculatePayScore(lead.budget, artist.minBudget);
  const locationScore = calculateLocationScore(
    lead.latitude ? parseFloat(lead.latitude.toString()) : null,
    lead.longitude ? parseFloat(lead.longitude.toString()) : null,
    artist.location ? 25.7617 : null, // Miami lat (placeholder)
    artist.location ? -80.1918 : null, // Miami lng (placeholder)
    artist.maxDistance
  );
  const genreScore = calculateGenreScore(lead.eventType, artist.genres ?? []);
  const reputationScore = calculateReputationScore(lead.source, lead.title);

  // Weighted average (pay and location are most important)
  const overallScore = Math.round(
    payScore * 0.35 + locationScore * 0.35 + genreScore * 0.2 + reputationScore * 0.1
  );

  return {
    overallScore: Math.min(100, Math.max(0, overallScore)),
    payScore,
    locationScore,
    genreScore,
    reputationScore,
  };
}
