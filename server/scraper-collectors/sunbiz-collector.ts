/**
 * Sunbiz collector — venue/business intelligence source.
 *
 * Correct design:
 * - Sunbiz bulk data is provided as fixed-width text files via public SFTP.
 * - The app should read a local fixed-width file (synced separately) and
 *   normalize each record into RawLeadDoc.
 *
 * IMPORTANT:
 * - This collector now uses SUNBIZ_FILE_PATH (file path), not SUNBIZ_CSV_URL.
 * - Fixed-width field offsets must be wired from the official Sunbiz
 *   corporate file definitions.
 */

import type { RawLeadDoc } from "./raw-lead-doc";
import * as fs from "fs/promises";

const _sunbizPath = process.env.SUNBIZ_FILE_PATH;
if (!_sunbizPath) {
  throw new Error("SUNBIZ_FILE_PATH is not set");
}
const SUNBIZ_FILE_PATH: string = _sunbizPath;

// Official fixed-width offsets from Sunbiz Corporate Data File definitions are now wired.
// See: https://dos.sunbiz.org/data-definitions/cor.html
const SUNBIZ_OFFSETS_READY = true;

interface SunbizCollectorOptions {
  maxResults?: number;
}

// TODO: Wire official Sunbiz fixed-width offsets from corporate file definitions.
// This placeholder describes the fields we care about; offsets/lengths must be
// filled in from the official documentation.
interface SunbizFixedRecord {
  docNumber: string;
  entityName: string;
  principalCity: string;
  principalAddress: string;
  status: string;
}

function parseFixedWidthRecord(line: string): SunbizFixedRecord | null {
  if (!line.trim()) return null;

  // Guard against malformed/short records — require at least up to the end of
  // the principal city field (position 332, 1-based -> index 332, 0-based end).
  if (line.length < 332) {
    console.warn("[sunbiz-collector] Skipping short record line (expected >= 332 chars):", line.length);
    return null;
  }

  // Field mapping from Corporate Data File (fixed-length, 1-based positions):
  // 1  Corporation Number       Start 1   Length 12
  // 2  Corporation Name         Start 13  Length 192
  // 3  Status                   Start 205 Length 1
  // 5  Address 1 (Principal)    Start 221 Length 42
  // 6  Address 2 (Principal)    Start 263 Length 42
  // 7  City (Principal)         Start 305 Length 28

  // Convert 1-based positions to JS 0-based slice indices (end exclusive).

  // Corporation Number (1–12)
  const docNumber = line.slice(0, 12).trim();

  // Corporation Name (13–204) → slice(12, 12+192)
  const entityName = line.slice(12, 12 + 192).trim();

  // Status (205–205) → slice(204, 205)
  const status = line.slice(204, 205).trim();

  // Principal Address 1 (221–262) → slice(220, 220+42)
  const addr1 = line.slice(220, 220 + 42).trim();
  // Principal Address 2 (263–304) → slice(262, 262+42)
  const addr2 = line.slice(262, 262 + 42).trim();
  const principalAddress = [addr1, addr2].filter(Boolean).join(" ");

  // Principal City (305–332) → slice(304, 304+28)
  const principalCity = line.slice(304, 304 + 28).trim();

  if (!docNumber || !entityName) return null;

  return {
    docNumber,
    entityName,
    principalCity,
    principalAddress,
    status,
  };
}

export async function collectFromSunbiz(options?: SunbizCollectorOptions): Promise<RawLeadDoc[]> {
  if (!SUNBIZ_OFFSETS_READY) {
    console.warn("[sunbiz-collector] Disabled: official Sunbiz fixed-width field offsets are not finalized. No Sunbiz records will be ingested.");
    return [];
  }

  const maxResults = Math.min(options?.maxResults ?? 500, 2000);

  console.log("[sunbiz-collector] Using file:", SUNBIZ_FILE_PATH);
  const fileBuffer = await fs.readFile(SUNBIZ_FILE_PATH);
  console.log("[sunbiz-collector] Sunbiz file bytes:", fileBuffer.byteLength);

  const text = fileBuffer.toString("utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  console.log("[sunbiz-collector] Sunbiz records (lines) parsed:", lines.length);

  const docs: RawLeadDoc[] = [];
  let loggedSample = false;

  for (const line of lines) {
    if (docs.length >= maxResults) break;

    const rec = parseFixedWidthRecord(line);
    if (!rec) continue;

    const name = rec.entityName;
    const city = rec.principalCity;
    const address = rec.principalAddress;
    const docNumber = rec.docNumber;
    const status = rec.status;

    const title = `${name}${city ? " – " + city : ""}`;

    const rawTextLines = [
      `Name: ${name}`,
      `Document Number: ${docNumber}`,
      `Status: ${status}`,
      `Address: ${address}`,
      `City: ${city}`,
    ];

    const externalId = `sunbiz-${docNumber}`;

    const metadata: Record<string, unknown> = {
      sunbiz: rec,
      leadCategory: "venue_intelligence",
      leadType: "venue",
      source: "sunbiz",
    };

    docs.push({
      externalId,
      source: "sunbiz",
      sourceType: "sunbiz",
      sourceLabel: "Sunbiz Business Record",
      title,
      rawText: rawTextLines.join("\n"),
      url: "https://dos.fl.gov/sunbiz/other-services/data-downloads/", // reference, not per-record URL
      postedAt: null as any,
      city: city || null,
      metadata,
    });

    if (!loggedSample) {
      console.log("[sunbiz-collector] Sample record:", {
        docNumber,
        entityName: name,
        principalCity: city,
        status,
      });
      loggedSample = true;
    }
  }

  console.log("[sunbiz-collector] Normalized Sunbiz docs:", docs.length);
  return docs;
}

