/**
 * One-off backfill: move the first URL found in gigLeads text fields into `venueUrl`
 * when `venueUrl` is empty; remove that URL from description / fullDescription / publicPreviewDescription.
 *
 * Schema has no separate sourceUrl/contactLink — marketplace + Facebook-style leads use `venueUrl`.
 *
 * Usage (requires DATABASE_URL):
 *   # Preview only (no DB writes):
 *   npx tsx scripts/extract-urls-from-lead-descriptions.ts --dry-run
 *
 *   # Apply updates:
 *   npx tsx scripts/extract-urls-from-lead-descriptions.ts
 *
 * Sample before/after (one lead):
 *   BEFORE
 *     description: "Need DJ for yacht party in Miami. See post https://facebook.com/groups/xyz/posts/123 Thanks"
 *     venueUrl: null
 *   AFTER
 *     description: "Need DJ for yacht party in Miami. See post Thanks"
 *     venueUrl: "https://facebook.com/groups/xyz/posts/123"
 */

import "dotenv/config";
import { and, asc, eq, gt, isNull, or } from "drizzle-orm";
import { gigLeads } from "../drizzle/schema";
import { getDb } from "../server/db";

const BATCH = 400;
const VENUE_URL_MAX = 2048;

const dryRun = process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";

/** True if any text field likely contains a leakable URL. */
function textMayContainUrl(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return (
    /https?:\/\//i.test(text) ||
    t.includes("facebook.com") ||
    t.includes("fb.com") ||
    t.includes("fb.me") ||
    t.includes("instagram.com") ||
    t.includes("wa.me") ||
    t.includes("api.whatsapp.com") ||
    /\bwww\.[^\s]+/i.test(text)
  );
}

function trimTrailingJunk(s: string): string {
  return s.replace(/[),.;:!?]+$/g, "").trim();
}

function normalizeUrlForStorage(raw: string): string {
  let u = trimTrailingJunk(raw.trim());
  if (!u) return u;
  if (!/^https?:\/\//i.test(u)) {
    u = `https://${u.replace(/^\/+/, "")}`;
  }
  return u.length > VENUE_URL_MAX ? u.slice(0, VENUE_URL_MAX) : u;
}

/**
 * Extract first URL-ish token in priority order: full http(s), then www., then bare facebook/instagram/wa.
 * Returns the exact substring to remove from the source text and the normalized URL for venueUrl.
 */
function extractFirstUrl(
  text: string | null | undefined,
): { raw: string; normalized: string } | null {
  if (!text) return null;

  const httpRe = /https?:\/\/[^\s<>"')\]]+/gi;
  let m: RegExpExecArray | null;
  while ((m = httpRe.exec(text)) !== null) {
    const raw = m[0];
    const normalized = normalizeUrlForStorage(raw);
    if (normalized) return { raw, normalized };
  }

  const wwwRe = /\bwww\.[^\s<>"')\]]+/gi;
  while ((m = wwwRe.exec(text)) !== null) {
    const raw = m[0];
    const normalized = normalizeUrlForStorage(raw);
    if (normalized) return { raw, normalized };
  }

  const bareRe =
    /\b(?:m\.)?(?:facebook\.com|fb\.com|fb\.me)\/[^\s<>"')\]]+|\b(?:www\.)?instagram\.com\/[^\s<>"')\]]+|\bwa\.me\/[^\s<>"')\]?]+|\bapi\.whatsapp\.com\/[^\s<>"')\]]+/gi;
  while ((m = bareRe.exec(text)) !== null) {
    const raw = m[0];
    const normalized = normalizeUrlForStorage(raw);
    if (normalized) return { raw, normalized };
  }

  return null;
}

/** Remove one occurrence of needle from haystack; collapse whitespace. */
function stripOnce(haystack: string, needle: string): string {
  if (!haystack || !needle) return haystack ?? "";
  const idx = haystack.indexOf(needle);
  if (idx === -1) return haystack;
  const next = haystack.slice(0, idx) + haystack.slice(idx + needle.length);
  return next.replace(/\s{2,}/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();
}

type Row = {
  id: number;
  description: string | null;
  fullDescription: string | null;
  publicPreviewDescription: string | null;
  venueUrl: string | null;
};

function processRow(row: Row): {
  venueUrl: string;
  description: string | null;
  fullDescription: string | null;
  publicPreviewDescription: string | null;
} | null {
  const venue = String(row.venueUrl ?? "").trim();
  if (venue) return null;

  const fieldsInOrder = [row.description, row.fullDescription, row.publicPreviewDescription];

  let chosen: { raw: string; normalized: string } | null = null;
  for (const val of fieldsInOrder) {
    chosen = extractFirstUrl(val ?? undefined);
    if (chosen) break;
  }
  if (!chosen) return null;

  const { raw, normalized } = chosen;

  return {
    venueUrl: normalized,
    description: row.description != null ? stripOnce(row.description, raw) : null,
    fullDescription: row.fullDescription != null ? stripOnce(row.fullDescription, raw) : null,
    publicPreviewDescription:
      row.publicPreviewDescription != null ? stripOnce(row.publicPreviewDescription, raw) : null,
  };
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable (set DATABASE_URL).");

  let cursor = 0;
  let scanned = 0;
  let updated = 0;
  let sampleLogged = false;

  while (true) {
    const batch: Row[] = await db
      .select({
        id: gigLeads.id,
        description: gigLeads.description,
        fullDescription: gigLeads.fullDescription,
        publicPreviewDescription: gigLeads.publicPreviewDescription,
        venueUrl: gigLeads.venueUrl,
      })
      .from(gigLeads)
      .where(
        and(
          gt(gigLeads.id, cursor),
          or(isNull(gigLeads.venueUrl), eq(gigLeads.venueUrl, "")),
        ),
      )
      .orderBy(asc(gigLeads.id))
      .limit(BATCH);

    if (batch.length === 0) break;
    cursor = batch[batch.length - 1]!.id;
    scanned += batch.length;

    for (const row of batch) {
      const blob = [row.description, row.fullDescription, row.publicPreviewDescription].filter(Boolean).join("\n");
      if (!textMayContainUrl(blob)) continue;

      const next = processRow(row);
      if (!next) continue;

      if (!sampleLogged) {
        sampleLogged = true;
        console.log("\n--- Sample (first updated lead) ---");
        console.log("id:", row.id);
        console.log("BEFORE description:", JSON.stringify(row.description)?.slice(0, 500));
        console.log("BEFORE venueUrl:", JSON.stringify(row.venueUrl));
        console.log("AFTER  description:", JSON.stringify(next.description)?.slice(0, 500));
        console.log("AFTER  venueUrl:", JSON.stringify(next.venueUrl));
        console.log("---\n");
      }

      if (dryRun) {
        updated++;
        continue;
      }

      await db
        .update(gigLeads)
        .set({
          venueUrl: next.venueUrl,
          description: next.description,
          fullDescription: next.fullDescription,
          publicPreviewDescription: next.publicPreviewDescription,
        })
        .where(eq(gigLeads.id, row.id));
      updated++;
    }
  }

  console.log(
    `[extract-urls] ${dryRun ? "DRY-RUN " : ""}scanned ${scanned} rows (empty venueUrl), ${dryRun ? "would update" : "updated"} ${updated} lead(s).`,
  );
}

main().catch((e) => {
  console.error("[extract-urls] Failed:", e);
  process.exit(1);
});
