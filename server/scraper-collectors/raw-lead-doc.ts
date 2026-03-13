/**
 * Normalized raw lead document shape for all collectors.
 * Every collector (Reddit, Eventbrite, Craigslist, future DBPR/Sunbiz/etc.)
 * maps into this shape so the pipeline can filter, route trash, and convert
 * to gigLeads consistently.
 */

export type SourceType =
  | "reddit"
  | "eventbrite"
  | "craigslist"
  | "google_news"
  | "dbpr"
  | "sunbiz"
  | "meetup"
  | "quora"
  | "gigxo"
  | "other";

export interface ExtractedContact {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

/** Single canonical shape for raw leads from any source */
export interface RawLeadDoc {
  /** Unique id for dedup (e.g. reddit-abc123, eventbrite-https://...) */
  externalId: string;
  /** Logical source key (matches source config toggles) */
  source: string;
  /** Normalized source type for pipeline/enum mapping */
  sourceType: SourceType;
  /** Human-readable label (e.g. "Reddit r/weddingplanning", "Eventbrite Miami") */
  sourceLabel: string;
  /** Short title (e.g. post title, event name) */
  title: string;
  /** Full body text for intent/negative filtering and classification */
  rawText: string;
  /** Canonical URL of the listing/post */
  url: string;
  /** When the content was posted/published (best effort) */
  postedAt: Date;
  /** Best-guess city/location (e.g. "Miami, FL") */
  city: string | null;
  /** Extracted contact info if available */
  contact?: ExtractedContact | null;
  /** Optional blob for source-specific data (e.g. subreddit, eventId) */
  metadata?: Record<string, unknown> | null;
}
