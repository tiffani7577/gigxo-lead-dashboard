/**
 * DBPR collector — structured venue/business intelligence source.
 *
 * Fetches the ABT daily activity extract (daily.csv): liquor license activity.
 * Normalizes rows into RawLeadDoc. Supports header-based and positional CSV.
 * Filtering: liquor license class, South Florida counties (name match), stale window.
 */

import type { RawLeadDoc } from "./raw-lead-doc";
import { parse } from "csv-parse";

const DBPR_URL_DAILY = "https://www2.myfloridalicense.com/sto/file_download/extracts/daily.csv";

interface ParsedFeed {
  dataRows: string[][];
  headerRow: string[] | null;
  usePositional: boolean;
  sourceLabel: string;
  url: string;
  licenseTokens: readonly string[];
}

/** License type tokens for ABT daily (liquor) extract. */
const LIQUOR_LICENSE_TOKENS = [
  "4COP", "2COP", "1COP", "SRX", "SFS", "COP", "CLUB", "YACHT", "CATERER",
  "SPECIAL", "EVENT", "VENDOR", "BEER", "WINE", "LIQUOR", "PACKAGE",
];

/** County tokens for South Florida (case-insensitive, partial match). */
const SOUTH_FLORIDA_COUNTY_TOKENS = ["DADE", "MIAMI", "BROWARD", "PALM BEACH", "MONROE"];
const HIGH_VALUE_CITY_TOKENS = [
  "MIAMI",
  "FORT LAUDERDALE",
  "BOCA RATON",
  "WEST PALM BEACH",
  "DELRAY BEACH",
  "MIAMI BEACH",
] as const;

const STALE_DAYS = 180;

async function safeFetch(url: string): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "GigxoScraper/1.0 (+https://gigxo.com)" },
    });
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

/** Returns true if the license class string matches any of the given tokens (case-insensitive, partial match). */
function passesLicenseClassFilter(licenseClassCombined: string, tokens: readonly string[]): boolean {
  const lower = (licenseClassCombined || "").toLowerCase();
  return tokens.some((token) => lower.includes(token.toLowerCase()));
}

/** Returns true if county string contains a South Florida county token. */
function passesCountyFilter(countyStr: string): boolean {
  const upper = (countyStr || "").toUpperCase();
  return SOUTH_FLORIDA_COUNTY_TOKENS.some((token) => upper.includes(token.toUpperCase()));
}

/** Returns true when city matches one of the high-value enrichment markets. */
function isHighValueCity(cityStr: string): boolean {
  const upper = (cityStr || "").toUpperCase();
  return HIGH_VALUE_CITY_TOKENS.some((token) => upper.includes(token));
}

/** Parse a date string; returns Date or null if unparseable. */
function parseDate(value: string | null | undefined): Date | null {
  const s = (value || "").trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Returns true if the row should be rejected for being stale (issue date older than STALE_DAYS). Missing/unparseable date = not stale (keep). */
function isStaleLicense(dateStr: string | null | undefined): boolean {
  const d = parseDate(dateStr);
  if (!d) return false; // keep for manual review
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STALE_DAYS);
  return d < cutoff;
}

/** Build one RawLeadDoc from a positional row (FL daily extract). */
function normalizePositionalRow(cells: string[], url: string, sourceLabel: string): RawLeadDoc | null {
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
  const manualReview = !isHighValueCity(city);

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
      highValueCity: !manualReview,
      enrichmentMode: manualReview ? "manual_review" : "auto_enrich",
    },
    status: manualReview ? "manual_review" : null,
    leadCategory: "venue_intelligence",
    leadType: "venue_intelligence",
    source: "dbpr",
  };

  return {
    externalId,
    source: "dbpr",
    sourceType: "dbpr",
    sourceLabel,
    title,
    rawText: rawTextLines.join("\n"),
    url,
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
    first.includes("application number") ||
    first.includes("licensee name") ||
    first.includes("location city") ||
    first.includes("division") ||
    first.includes("board")
  );
}

/** Get date string from header row. */
function getDateFromHeaderRow(row: Record<string, string>): string | null {
  const keys = [
    "Date", "Issue Date", "Approval Date", "Effective Date", "Application Approval Date",
    "Original Issue Date", "Original_Issue_Date",
  ];
  for (const k of keys) {
    const v = (row[k] || "").trim();
    if (v) return v;
  }
  return null;
}

/** Get county string from header row (tries common column names; any header containing "County"). */
function getCountyFromHeaderRow(row: Record<string, string>): string {
  const keys = ["County", "Location County", "License County", "Counties"];
  for (const k of keys) {
    const v = (row[k] || "").trim();
    if (v) return v;
  }
  for (const [k, v] of Object.entries(row)) {
    if ((k || "").toLowerCase().includes("county") && (v || "").trim()) return v.trim();
  }
  return "";
}

/** Fetch one DBPR CSV URL, validate, parse; returns ParsedFeed or null. */
async function fetchAndParseDbprCsv(
  url: string,
  sourceLabel: string,
  licenseTokens: readonly string[] = LIQUOR_LICENSE_TOKENS
): Promise<ParsedFeed | null> {
  const response = await safeFetch(url);
  if (!response) return null;
  if (!response.ok) {
    console.error(`[dbpr-collector] ERROR: HTTP ${response.status} ${response.statusText} from ${url}`);
    return null;
  }
  const csvText = await response.text();
  console.log("[dbpr-collector] Response preview:", csvText.slice(0, 200));
  if (csvText.startsWith("<") || /<html/i.test(csvText)) {
    console.error(
      "[dbpr-collector] ERROR: URL returned HTML instead of CSV. The DBPR URL may be invalid, returning a 404, or requiring authentication. URL:",
      url
    );
    return null;
  }
  let rawRows: string[][];
  try {
    rawRows = await new Promise<string[][]>((resolve, reject) => {
      const records: string[][] = [];
      const parser = parse({
        bom: true,
        skip_empty_lines: true,
        relax_quotes: true,
        relax_column_count: true,
        skip_records_with_error: true,
        trim: true,
      });
      parser.on("readable", function (this: import("stream").Readable) {
        let record: string[];
        while ((record = parser.read()) !== null) {
          records.push(record);
        }
      });
      parser.on("skip", (err: Error) => {
        console.error(`[dbpr-collector] Skipped malformed row on ${sourceLabel}: ${err.message}`);
      });
      parser.on("error", (err) => reject(err));
      parser.on("end", () => resolve(records));
      parser.write(csvText);
      parser.end();
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[dbpr-collector] Parse error on ${sourceLabel}: ${message}`);
    return null;
  }
  if (!rawRows.length) return null;
  const usePositional = !looksLikeHeaderRow(rawRows[0]);
  const dataRows = usePositional ? rawRows : rawRows.slice(1);
  const headerRow = usePositional ? null : rawRows[0];
  return { dataRows, headerRow, usePositional, sourceLabel, url, licenseTokens };
}

export async function collectFromDbpr(options?: DbprCollectorOptions): Promise<RawLeadDoc[]> {
  console.log("[dbpr-collector] Using DBPR daily liquor license feed (daily.csv)");

  const maxResults = Math.min(options?.maxResults ?? 500, 1000);
  const feed = await fetchAndParseDbprCsv(DBPR_URL_DAILY, "DBPR Daily Activity");

  const docs: RawLeadDoc[] = [];
  let dailyKept = 0;
  let wrongLicenseType = 0;
  let outOfMarket = 0;
  let staleLicense = 0;

  if (!feed) {
    console.log("[dbpr-collector] Daily activity: no feed");
    return docs;
  }

  const { dataRows, headerRow, usePositional, sourceLabel, url, licenseTokens } = feed;
  console.log(`[dbpr] ${sourceLabel}: ${dataRows.length} rows downloaded`);
  let kept = 0;
  let wrongType = 0;
  let outOfMarketFeed = 0;
  let staleCount = 0;

  if (usePositional) {
    for (let i = 0; i < dataRows.length && docs.length < maxResults; i++) {
      const row = dataRows[i];
      const divisionCode = getAt(row, POS.divisionCode);
      const county = getAt(row, POS.county);
      const licenseClass = getAt(row, POS.licenseClass);
      const dateStr = getAt(row, POS.date);

      const licenseCombined = `${divisionCode} ${licenseClass}`.trim();
      if (!passesLicenseClassFilter(licenseCombined, licenseTokens)) {
        wrongLicenseType++;
        wrongType++;
        continue;
      }
      if (!passesCountyFilter(county)) {
        outOfMarket++;
        outOfMarketFeed++;
        continue;
      }
      if (isStaleLicense(dateStr)) {
        staleLicense++;
        staleCount++;
        continue;
      }

      const doc = normalizePositionalRow(row, url, sourceLabel);
      if (doc) {
        docs.push(doc);
        kept++;
        dailyKept++;
      }
    }
  } else {
    const headers = headerRow ?? [];
    for (let i = 0; i < dataRows.length && docs.length < maxResults; i++) {
      const cells = dataRows[i];
      const row: Record<string, string> = {};
      headers.forEach((h, j) => {
        row[h ?? ""] = (cells[j] ?? "").trim();
      });
      const normalizedRow: Record<string, string> = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k.trim(), v])
      );

      const dba = (normalizedRow["Licensee Name"] || normalizedRow["DBA"] || "").trim();
      const city = (
        normalizedRow["Location City"] ||
        normalizedRow["Mailing City"] ||
        normalizedRow["City"] ||
        ""
      ).trim();
      const address = (
        normalizedRow["Location Address 1"] ||
        normalizedRow["Mailing Street Address"] ||
        normalizedRow["Mailing Address"] ||
        ""
      ).trim();
      const licenseNumber = (normalizedRow["Application Number"] || normalizedRow["License Number"] || "").trim();
      const primaryStatus = (normalizedRow["Primary Status"] || "").trim();
      const secondaryStatus = (normalizedRow["Secondary Status"] || "").trim();
      const manualReview = !isHighValueCity(city);
      const licenseTypeCode = (normalizedRow["License Type Code"] || "").trim();
      const rankCode = (normalizedRow["Rank Code"] || "").trim();
      const divisionCombined = [licenseTypeCode, rankCode].filter(Boolean).join(" ").trim();
      const division =
        divisionCombined ||
        (
          normalizedRow["Division"] ||
          normalizedRow["Board"] ||
          normalizedRow["Board Number"] ||
          normalizedRow["Class Code"] ||
          normalizedRow["License Type"] ||
          ""
        ).trim();

      if (!dba || !licenseNumber) continue;

      const primaryStatusCode = (
        normalizedRow["Primary Status Code"] ||
        normalizedRow["Primary Status Code "] ||
        normalizedRow["Primary Status"] ||
        ""
      ).trim();
      if (["45", "46", "47", "60", "61"].includes(primaryStatusCode)) continue;
      if (primaryStatusCode !== "10" && primaryStatusCode !== "20") continue;

      if (!passesLicenseClassFilter(division, licenseTokens)) {
        wrongLicenseType++;
        wrongType++;
        continue;
      }
      const countyStr = getCountyFromHeaderRow(normalizedRow);
      if (!passesCountyFilter(countyStr)) {
        outOfMarket++;
        outOfMarketFeed++;
        continue;
      }
      const dateStr = getDateFromHeaderRow(normalizedRow) ?? "";
      if (isStaleLicense(dateStr)) {
        staleLicense++;
        staleCount++;
        continue;
      }

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
        dbpr: { ...normalizedRow, highValueCity: !manualReview, enrichmentMode: manualReview ? "manual_review" : "auto_enrich" },
        status: manualReview ? "manual_review" : null,
        leadCategory: "venue_intelligence",
        leadType: "venue",
        source: "dbpr",
      };
      docs.push({
        externalId,
        source: "dbpr",
        sourceType: "dbpr",
        sourceLabel,
        title,
        rawText: rawTextLines.join("\n"),
        url,
        postedAt: null as any,
        city: city || null,
        metadata,
      });
      kept++;
      dailyKept++;
    }
  }

  console.log(`[dbpr] ${sourceLabel}: ${kept} passed license filter, ${wrongType} wrong type, ${outOfMarketFeed} out of market, ${staleCount} stale`);
  console.log(
    `[dbpr-collector] Daily activity: ${dailyKept} kept | Filtered: ${staleLicense} stale, ${wrongLicenseType} wrong type, ${outOfMarket} out of market`
  );

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
