/**
 * Lightweight source config: which collectors are enabled for the lead pipeline.
 * Uses explorerSourceToggles so admin can turn sources on/off without code changes.
 * If a source has no row, it is treated as enabled (backward compatible).
 */

const SOURCE_KEYS_TUPLE = ["reddit", "eventbrite", "craigslist", "dbpr", "sunbiz", "apify"] as const;
export type LeadSourceKey = (typeof SOURCE_KEYS_TUPLE)[number];

/** Exported as a real Array so it is always iterable (avoids bundler/tuple issues in production). */
export const LEAD_SOURCE_KEYS: LeadSourceKey[] = Array.from(SOURCE_KEYS_TUPLE);

/** Returns which source keys are enabled. Defaults to all enabled when DB has no row for a key. */
export async function getEnabledLeadSourceKeys(): Promise<LeadSourceKey[]> {
  const keys: LeadSourceKey[] = Array.isArray(LEAD_SOURCE_KEYS) ? LEAD_SOURCE_KEYS : Array.from(SOURCE_KEYS_TUPLE);
  try {
    const { getDb } = await import("../db");
    const { explorerSourceToggles } = await import("../../drizzle/schema");
    const db = await getDb();
    if (!db) return [...keys];

    const rows = await db.select().from(explorerSourceToggles);
    const enabledSet = new Set<string>();
    for (const k of keys) {
      const row = rows.find((r) => r.sourceKey === k);
      if (row === undefined) enabledSet.add(k);
      else if (row.enabled) enabledSet.add(k);
    }
    return keys.filter((k) => enabledSet.has(k));
  } catch (err) {
    console.warn("[source-config] Failed to load source toggles, defaulting to all enabled", err);
    return [...keys];
  }
}
