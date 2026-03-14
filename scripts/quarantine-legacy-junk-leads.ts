/**
 * One-off: mark legacy low-quality gigxo leads as trash + hidden.
 * Targets source = gigxo with junk patterns: URL titles, article/sports/news hiring.
 * Run: npx tsx scripts/quarantine-legacy-junk-leads.ts
 */
import "dotenv/config";
import { and, eq, isNull, not, or } from "drizzle-orm";
import { gigLeads } from "../drizzle/schema";
import { getDb } from "../server/db";

// Patterns that indicate junk (legacy Google RSS, article headlines, sports hiring, URL-only titles)
function isJunkTitle(title: string | null): boolean {
  const t = (title ?? "").trim();
  if (!t) return false;
  // Title is a URL
  if (/^https?:\/\//i.test(t)) return true;
  // Title is mostly a URL (e.g. single token with .com/.org)
  if (t.length > 35 && (t.includes(".com") || t.includes(".org") || t.includes(".net")) && t.split(/\s+/).length <= 2)
    return true;
  // Article/news source suffix
  if (/\s*[-|]\s*(Google Alerts|Reuters|ESPN|CNN|Yahoo|Fox News|NBC|CBS|USA Today|Washington Post|NPR|BBC|The Guardian|HuffPost|BuzzFeed|Vice|Axios|Politico|CNBC|MarketWatch|Forbes|Bloomberg|AP News|Associated Press|Sports Illustrated|Bleacher Report)/i.test(t))
    return true;
  return false;
}

function isJunkTitleOrDescription(title: string | null, description: string | null): boolean {
  const t = (title ?? "").trim();
  const d = (description ?? "").trim();
  const combined = `${t} ${d}`.toLowerCase();

  if (isJunkTitle(title)) return true;

  // Article suffix in description
  if (/\s*[-|]\s*(Google Alerts|Reuters|ESPN|CNN|Yahoo|Fox News|NBC|CBS|USA Today|Washington Post|NPR|BBC|The Guardian|HuffPost|BuzzFeed|Vice|Axios|Politico|CNBC|MarketWatch|Forbes|Bloomberg|AP News|Associated Press|Sports Illustrated|Bleacher Report)/i.test(d))
    return true;

  // Sports/news hiring (hire + sports/news context, not entertainment)
  const hasHire = /\bhire(s|d|ing)?\b/.test(combined);
  const sportsNewsContext = /\b(coach|gm\b|general manager|assistant coach|head coach|nfl|nba|mlb|quarterback|linebacker|bills\b|dolphins\b|news\b|reporter|editor\b|writer\b|journalist|sport(s)?\b|team\s+hiring|front\s+office)/i.test(combined);
  if (hasHire && sportsNewsContext) return true;

  // Description is dominated by a URL
  if (d.length > 50 && /^https?:\/\//.test(d.trim())) return true;

  return false;
}

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("DATABASE_URL not set or connection failed.");
    process.exit(1);
  }

  // Only consider source = gigxo, not already trash
  const candidates = await db
    .select({ id: gigLeads.id, title: gigLeads.title, description: gigLeads.description })
    .from(gigLeads)
    .where(
      and(
        eq(gigLeads.source, "gigxo"),
        or(isNull(gigLeads.leadType), not(eq(gigLeads.leadType, "trash")))
      )
    );

  const toQuarantine: number[] = [];
  for (const row of candidates) {
    if (isJunkTitleOrDescription(row.title, row.description)) toQuarantine.push(row.id);
  }

  if (toQuarantine.length === 0) {
    console.log("[quarantine-legacy-junk] No legacy gigxo rows matched junk patterns. Exiting.");
    process.exit(0);
  }

  // Mark as hidden so they disappear from marketplace (admin can still see/filter in explorer).
  // leadType=trash not set here in case DB enum does not include 'trash'; isHidden alone quarantines.
  for (const id of toQuarantine) {
    await db
      .update(gigLeads)
      .set({ isHidden: true })
      .where(eq(gigLeads.id, id));
  }

  console.log("[quarantine-legacy-junk] Marked as isHidden=true:", toQuarantine.length);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
