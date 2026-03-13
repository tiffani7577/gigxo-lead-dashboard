/**
 * Base Collector Interface & Utilities
 * All collectors implement this interface for consistent orchestration
 */

export interface RawDocument {
  id: string;          // Unique ID for deduplication
  source: string;      // e.g. "reddit", "twitter", "facebook"
  sourceLabel: string; // e.g. "Reddit r/weddingplanning", "Twitter @eventplanner"
  url: string;         // Original post URL
  title: string;
  body: string;
  author?: string;
  createdAt?: Date;
  marketId: string;
}

export interface Collector {
  name: string;
  collect(marketId: string, city: string): Promise<RawDocument[]>;
}

export const COLLECTORS: { [key: string]: Collector } = {};

export function registerCollector(collector: Collector) {
  COLLECTORS[collector.name] = collector;
}

/**
 * Parallel collector execution with timeout and error handling
 */
export async function runCollectorsInParallel(
  marketId: string,
  city: string,
  timeoutMs = 30000
): Promise<RawDocument[]> {
  const collectors = Object.values(COLLECTORS);
  const results: RawDocument[] = [];
  const errors: { collector: string; error: string }[] = [];

  const promises = collectors.map(async (collector) => {
    try {
      const timeout = new Promise<RawDocument[]>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
      );
      const result = Promise.race([collector.collect(marketId, city), timeout]);
      const docs = await result;
      results.push(...docs);
    } catch (err) {
      errors.push({
        collector: collector.name,
        error: err instanceof Error ? err.message : String(err),
      });
      console.log(`[Scraper] ${collector.name} error for ${city}:`, err);
    }
  });

  await Promise.allSettled(promises);

  if (errors.length > 0) {
    console.log(`[Scraper] ${errors.length} collectors failed:`, errors);
  }

  return results;
}
