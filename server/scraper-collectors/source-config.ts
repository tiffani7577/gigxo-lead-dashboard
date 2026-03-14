/**
 * Lightweight source config: which collectors are enabled for the lead pipeline.
 * Uses explorerSourceToggles so admin can turn sources on/off without code changes.
 * If a source has no row, it is treated as enabled (backward compatible).
 */

export const LEAD_SOURCE_KEYS = ["reddit", "eventbrite", "craigslist", "dbpr", "sunbiz", "apify"] as const;
export type LeadSourceKey = (typeof LEAD_SOURCE_KEYS)[number];

/** Returns which source keys are enabled. Defaults to all enabled when DB has no row for a key. */
export async function getEnabledLeadSourceKeys(): Promise<LeadSourceKey[]> {
  try {
    const { getDb } = await import("../db");
    const { explorerSourceToggles } = await import("../../drizzle/schema");
    const db = await getDb();
    if (!db) return [...LEAD_SOURCE_KEYS];

    const rows = await db.select().from(explorerSourceToggles);
    const enabledSet = new Set<string>();
    for (const k of LEAD_SOURCE_KEYS) {
      const row = rows.find((r) => r.sourceKey === k);
      if (row === undefined) enabledSet.add(k);
      else if (row.enabled) enabledSet.add(k);
    }
    return LEAD_SOURCE_KEYS.filter((k) => enabledSet.has(k));
  } catch (err) {
    console.warn("[source-config] Failed to load source toggles, defaulting to all enabled", err);
    return [...LEAD_SOURCE_KEYS];
  }
}
