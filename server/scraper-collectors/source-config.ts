/**
 * Lightweight source config: which collectors are enabled for the lead pipeline.
 * Uses explorerSourceToggles so admin can turn sources on/off without code changes.
 * If a source has no row, it is treated as enabled (backward compatible).
 */

const SOURCE_KEYS_TUPLE = ["reddit", "eventbrite", "craigslist", "dbpr", "sunbiz", "apify"] as const;
export type LeadSourceKey = (typeof SOURCE_KEYS_TUPLE)[number];

export const LEAD_SOURCE_KEYS: LeadSourceKey[] = [
  "reddit",
  "eventbrite",
  "craigslist",
  "dbpr",
  "sunbiz",
  "apify"
];

/** Returns which source keys are enabled. Defaults to all enabled when DB has no row for a key. */
export async function getEnabledLeadSourceKeys(): Promise<LeadSourceKey[]> {
  const safeKeys = Array.isArray(LEAD_SOURCE_KEYS)
    ? LEAD_SOURCE_KEYS
    : ["reddit", "eventbrite", "craigslist", "dbpr", "sunbiz", "apify"];
  try {
    const { getDb } = await import("../db");
    const { explorerSourceToggles } = await import("../../drizzle/schema");
    const db = await getDb();
    if (!db) return [...safeKeys];

    const rows = await db.select().from(explorerSourceToggles);
    const enabledSet = new Set<string>();
    for (const k of safeKeys) {
      const row = rows.find((r) => r.sourceKey === k);
      if (row === undefined) enabledSet.add(k);
      else if (row.enabled) enabledSet.add(k);
    }
    return safeKeys.filter((k) => enabledSet.has(k));
  } catch (err) {
    console.warn("[source-config] Failed to load source toggles, defaulting to all enabled", err);
    return [...safeKeys];
  }
}
