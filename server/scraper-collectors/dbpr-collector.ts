/**
 * DBPR collector — structured venue/business intelligence source.
 *
 * This collector is intentionally lightweight: it reads a CSV export from
 * DBPR (configured via the DBPR_VENUE_CSV_URL environment variable) and
 * normalizes each row into RawLeadDoc. Supports:
 * - Header-based CSV (columns: DBA, License Number, Location City, etc.)
 * - Positional CSV (e.g. FL daily extract: division, county, license#, class, DBA, entity, address, city, state, zip, date, description)
 *
 * If the environment variable is not set or the fetch fails, the collector
 * returns an empty array so the rest of the pipeline remains stable.
 */

import type { RawLeadDoc } from "./raw-lead-doc";
import { parse } from "csv-parse/sync";

async function safeFetch(url: string): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "GigxoScraper/1.0 (+https://gigxo.com)" },
    });
    if (!res.ok) {
      console.warn("[dbpr-collector] Fetch failed", url, res.status);
      return null;
    }
    return res;
  } catch (err) {
    console.warn("[dbpr-collector] Fetch error", url, err);
    return null;
  }
}

interface DbprCollectorOptions {
  maxResults?: number;
}

/** Normalize a division/type string for use in externalId (safe, stable key segment). */
function normalizeDivisionKey(raw: string): string {
  const s = (raw || "").trim().toLowerCase().replace(/[\s\W]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") || "unknown";
  return s.slice(0, 64);
}

/** Positional column indices for FL daily.csv format (0-based). */
const POS = {
  divisionCode: 0,
  county: 1,
  licenseNumber: 2,
  licenseClass: 3,
  dba: 5,
  ownerEntity: 6,
  address: 7,
  city: 10,
  state: 11,
  zip: 12,
  date: 13,
  description: 15,
} as const;

function getAt(arr: string[], i: number): string {
  if (i < 0 || i >= arr.length) return "";
  return (arr[i] ?? "").trim();
}

/** Build one RawLeadDoc from a positional row (FL daily extract). */
function normalizePositionalRow(cells: string[], DBPR_URL: string): RawLeadDoc | null {
  const licenseNumber = getAt(cells, POS.licenseNumber);
  const dba = getAt(cells, POS.dba);
  const ownerEntity = getAt(cells, POS.ownerEntity);
  const name = dba || ownerEntity;
  if (!name || !licenseNumber) return null;

  const divisionCode = getAt(cells, POS.divisionCode);
  const county = getAt(cells, POS.county);
  const licenseClass = getAt(cells, POS.licenseClass);
  const address = getAt(cells, POS.address);
  const city = getAt(cells, POS.city);
  const state = getAt(cells, POS.state);
  const zip = getAt(cells, POS.zip);
  const dateStr = getAt(cells, POS.date);
  const description = getAt(cells, POS.description);

  const divisionKey = normalizeDivisionKey(divisionCode || licenseClass);
  const externalId = `dbpr-${divisionKey}-${licenseNumber}`;

  const title = `${name}${city ? " – " + city : ""}`;
  const location = [city, state].filter(Boolean).join(", ") || county || "";

  const rawTextLines = [
    `Name: ${name}`,
    `License: ${licenseNumber}`,
    `Division/Class: ${divisionCode || ""} ${licenseClass || ""}`,
    `County: ${county}`,
    `Address: ${address}`,
    `City: ${city}`,
    `State: ${state}`,
    `Zip: ${zip}`,
    dateStr ? `Date: ${dateStr}` : "",
    description ? `Description: ${description}` : "",
  ].filter(Boolean);

  const metadata: Record<string, unknown> = {
    dbpr: {
      divisionCode,
      county,
      licenseNumber,
      licenseClass,
      dba,
      ownerEntity,
      address,
      city,
      state,
      zip,
      date: dateStr,
      description,
    },
    leadCategory: "venue_intelligence",
    leadType: "venue_intelligence",
    source: "dbpr",
  };

  return {
    externalId,
    source: "dbpr",
    sourceType: "dbpr",
    sourceLabel: "DBPR Venue Record",
    title,
    rawText: rawTextLines.join("\n"),
    url: DBPR_URL,
    postedAt: null as any,
    city: city || null,
    metadata,
  };
}

/** Detect if the first row looks like header names (e.g. "DBA", "License Number"). */
function looksLikeHeaderRow(cells: string[]): boolean {
  const first = (cells.slice(0, 20).join(" ").toLowerCase());
  return (
    first.includes("dba") ||
    first.includes("license number") ||
    first.includes("location city") ||
    first.includes("division") ||
    first.includes("board")
  );
}

export async function collectFromDbpr(options?: DbprCollectorOptions): Promise<RawLeadDoc[]> {
  const DBPR_URL = process.env.DBPR_VENUE_CSV_URL?.trim();
  if (!DBPR_URL) {
    console.warn("[dbpr-collector] DBPR_VENUE_CSV_URL is not set; skipping DBPR. Set a downloadable CSV URL to enable venue intelligence.");
    return [];
  }

  const maxResults = Math.min(options?.maxResults ?? 200, 1000);
  const response = await safeFetch(DBPR_URL);
  if (!response) return [];

  console.log("[dbpr-collector] Fetch status:", response.status, "URL:", DBPR_URL);

  const csvText = await response.text();
  console.log("[dbpr-collector] CSV length:", csvText.length, "preview:", csvText.slice(0, 300));

  const rawRows = parse(csvText, {
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as string[][];

  console.log("[dbpr-collector] Rows parsed (raw):", rawRows.length);

  if (!rawRows.length) return [];

  const usePositional = !looksLikeHeaderRow(rawRows[0]);
  const dataRows: string[][] = usePositional ? rawRows : rawRows.slice(1);
  const headerRow = usePositional ? null : rawRows[0];

  if (usePositional) {
    console.log("[dbpr-collector] Using positional column format (no header row detected).");
  } else {
    console.log("[dbpr-collector] Using header-based format. Sample header keys:", headerRow?.slice(0, 12));
  }

  const docs: RawLeadDoc[] = [];

  if (usePositional) {
    for (let i = 0; i < dataRows.length && docs.length < maxResults; i++) {
      const row = dataRows[i];
      const doc = normalizePositionalRow(row, DBPR_URL);
      if (doc) docs.push(doc);
    }
  } else {
    const headers = headerRow ?? [];
    for (let i = 0; i < dataRows.length && docs.length < maxResults; i++) {
      const cells = dataRows[i];
      const row: Record<string, string> = {};
      headers.forEach((h, j) => {
        row[h ?? ""] = (cells[j] ?? "").trim();
      });
      const dba = (row["DBA"] || "").trim();
      const city = (row["Location City"] || "").trim();
      const address = (row["Location Address 1"] || "").trim();
      const licenseNumber = (row["License Number"] || "").trim();
      const primaryStatus = (row["Primary Status"] || "").trim();
      const secondaryStatus = (row["Secondary Status"] || "").trim();
      const division =
        (row["Division"] || row["Board"] || row["Board Number"] || row["Class Code"] || row["License Type"] || row["License Type Code"] || "").trim();

      if (!dba || !licenseNumber) continue;

      const title = `${dba}${city ? " – " + city : ""}`;
      const rawTextLines = [
        `Name: ${dba}`,
        `License: ${licenseNumber}`,
        `Status: ${primaryStatus}/${secondaryStatus}`,
        `Address: ${address}`,
        `City: ${city}`,
      ];
      const divisionKey = normalizeDivisionKey(division);
      const externalId = `dbpr-${divisionKey}-${licenseNumber}`;
      const metadata: Record<string, unknown> = {
        dbpr: row,
        leadCategory: "venue_intelligence",
        leadType: "venue",
        source: "dbpr",
      };
      docs.push({
        externalId,
        source: "dbpr",
        sourceType: "dbpr",
        sourceLabel: "DBPR Venue Record",
        title,
        rawText: rawTextLines.join("\n"),
        url: DBPR_URL,
        postedAt: null as any,
        city: city || null,
        metadata,
      });
    }
  }

  console.log("[dbpr-collector] Rows normalized:", docs.length);
  if (docs.length > 0) {
    console.log("[dbpr-collector] Sample normalized doc:", JSON.stringify({
      externalId: docs[0].externalId,
      title: docs[0].title,
      city: docs[0].city,
      source: docs[0].source,
    }, null, 2));
  }

  return docs;
}

