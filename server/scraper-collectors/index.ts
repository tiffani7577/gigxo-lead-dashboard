/**
 * Collector Registry
 * Import all collectors here to register them
 */

export { runCollectorsInParallel, type RawDocument, type Collector } from "./base";

// Import all collectors to register them
import "./twitter";
import "./facebook";
import "./instagram";
import "./eventbrite";
import "./thumbtack";
import "./nextdoor";
import "./quora";
import "./meetup";

// Note: Reddit, DuckDuckGo, Craigslist, Bing News collectors are still in scraper.ts
// They will be migrated to this directory in the next phase
