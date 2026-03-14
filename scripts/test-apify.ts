/**
 * Test Apify collector only — no DB insert.
 * Run: npx tsx scripts/test-apify.ts
 */
import "dotenv/config";
import { collectFromApify } from "../server/scraper-collectors/apify-collector";

function main() {
  console.log("--- Apify collector test ---\n");

  collectFromApify()
    .then((docs) => {
      const reddit = docs.filter((d) => d.sourceLabel === "Apify Reddit");
      const googleSerp = docs.filter((d) => d.sourceLabel === "Google Search");
      const craigslist = docs.filter((d) => d.source === "craigslist");
      const facebook = docs.filter((d) => d.sourceLabel === "Apify Facebook Groups");
      const twitter = docs.filter((d) => d.sourceLabel === "Apify Twitter");
      const linkedin = docs.filter((d) => d.sourceLabel === "Apify LinkedIn");
      const googleMaps = docs.filter((d) => d.sourceLabel === "Apify Google Maps");

      console.log("Results by actor:");
      console.log("  Reddit:      ", reddit.length);
      console.log("  Google SERP:", googleSerp.length);
      console.log("  Craigslist:  ", craigslist.length);
      console.log("  Facebook:   ", facebook.length);
      console.log("  Twitter:     ", twitter.length);
      console.log("  LinkedIn:    ", linkedin.length);
      console.log("  Google Maps: ", googleMaps.length);
      console.log("  Total:       ", docs.length);
      console.log("");

      const take3 = (arr: typeof docs) => arr.slice(0, 3);

      console.log("--- First 3 Reddit (data shape) ---");
      take3(reddit).forEach((d, i) => {
        console.log(`[${i + 1}]`, JSON.stringify({
          externalId: d.externalId,
          source: d.source,
          sourceLabel: d.sourceLabel,
          title: d.title?.slice(0, 60),
          url: d.url?.slice(0, 50),
          city: d.city,
          metadata: d.metadata,
        }, null, 2));
      });

      console.log("\n--- First 3 Google SERP (data shape) ---");
      take3(googleSerp).forEach((d, i) => {
        console.log(`[${i + 1}]`, JSON.stringify({
          externalId: d.externalId,
          source: d.source,
          sourceLabel: d.sourceLabel,
          title: d.title?.slice(0, 60),
          url: d.url?.slice(0, 50),
          city: d.city,
          metadata: d.metadata,
        }, null, 2));
      });

      console.log("\n--- First 3 Facebook (data shape) ---");
      take3(facebook).forEach((d, i) => {
        console.log(`[${i + 1}]`, JSON.stringify({
          externalId: d.externalId,
          source: d.source,
          sourceLabel: d.sourceLabel,
          title: d.title?.slice(0, 60),
          url: d.url?.slice(0, 50),
          city: d.city,
          metadata: d.metadata,
        }, null, 2));
      });

      console.log("\n--- First 3 Twitter (data shape) ---");
      take3(twitter).forEach((d, i) => {
        console.log(`[${i + 1}]`, JSON.stringify({
          externalId: d.externalId,
          source: d.source,
          sourceLabel: d.sourceLabel,
          title: d.title?.slice(0, 60),
          url: d.url?.slice(0, 50),
          city: d.city,
          metadata: d.metadata,
        }, null, 2));
      });

      console.log("\n--- First 3 LinkedIn (data shape) ---");
      take3(linkedin).forEach((d, i) => {
        console.log(`[${i + 1}]`, JSON.stringify({
          externalId: d.externalId,
          source: d.source,
          sourceLabel: d.sourceLabel,
          title: d.title?.slice(0, 60),
          url: d.url?.slice(0, 50),
          city: d.city,
          metadata: d.metadata,
        }, null, 2));
      });

      console.log("\n--- First 3 Craigslist (data shape) ---");
      take3(craigslist).forEach((d, i) => {
        console.log(`[${i + 1}]`, JSON.stringify({
          externalId: d.externalId,
          source: d.source,
          sourceLabel: d.sourceLabel,
          title: d.title?.slice(0, 60),
          url: d.url?.slice(0, 50),
          city: d.city,
          metadata: d.metadata,
        }, null, 2));
      });

      console.log("\n--- First 3 Google Maps (data shape) ---");
      take3(googleMaps).forEach((d, i) => {
        console.log(`[${i + 1}]`, JSON.stringify({
          externalId: d.externalId,
          source: d.source,
          sourceLabel: d.sourceLabel,
          title: d.title?.slice(0, 60),
          url: d.url?.slice(0, 50),
          city: d.city,
          metadata: d.metadata,
        }, null, 2));
      });

      console.log("\n--- End ---");
    })
    .catch((err) => {
      console.error("Error:", err);
      process.exit(1);
    });
}

main();
