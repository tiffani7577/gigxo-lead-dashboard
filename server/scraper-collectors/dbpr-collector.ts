/**
 * DBPR collector — structured venue/business intelligence source.
 *
 * This collector is intentionally lightweight: it reads a CSV export from
 * DBPR (configured via the DBPR_VENUE_CSV_URL environment variable) and
 * normalizes each row into RawLeadDoc. The CSV can be any DBPR download
 * that includes at least establishment name and city.
 *
 * If the environment variable is not set or the fetch fails, the collector
 * returns an empty array so the rest of the pipeline remains stable.
 */

import type { RawLeadDoc } from "./raw-lead-doc";
import { parse } from "csv-parse/sync";

const DBPR_URL = process.env.DBPR_VENUE_CSV_URL;
if (!DBPR_URL) {
  throw new Error("DBPR_VENUE_CSV_URL is not set");
}
console.log("DBPR collector downloading:", DBPR_URL);

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

export async function collectFromDbpr(options?: DbprCollectorOptions): Promise<RawLeadDoc[]> {
  const maxResults = Math.min(options?.maxResults ?? 200, 1000);
  const response = await safeFetch(DBPR_URL);
  if (!response) return [];

  console.log("DBPR fetch status:", response.status);

  const csvText = await response.text();

  console.log("DBPR CSV length:", csvText.length);
  console.log("DBPR CSV preview:", csvText.slice(0, 300));

  const rows = parse(csvText, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Array<Record<string, string>>;

  console.log("DBPR rows parsed:", rows.length);
  if (rows.length > 0) {
    console.log("DBPR sample row:", rows[0]);
  }

  if (!rows.length) return [];

  const docs: RawLeadDoc[] = [];

  for (const row of rows) {
    const dba = (row["DBA"] || "").trim();
    const city = (row["Location City"] || "").trim();
    const address = (row["Location Address 1"] || "").trim();
    const licenseNumber = (row["License Number"] || "").trim();
    const primaryStatus = (row["Primary Status"] || "").trim();
    const secondaryStatus = (row["Secondary Status"] || "").trim();

    if (!dba || !licenseNumber) continue;

    const title = `${dba}${city ? " – " + city : ""}`;

    const rawTextLines = [
      `Name: ${dba}`,
      `License: ${licenseNumber}`,
      `Status: ${primaryStatus}/${secondaryStatus}`,
      `Address: ${address}`,
      `City: ${city}`,
    ];

    const externalId = `dbpr-${licenseNumber}`;

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

  console.log("[dbpr-collector] Normalized DBPR rows:", docs.length);
  return docs;
}

