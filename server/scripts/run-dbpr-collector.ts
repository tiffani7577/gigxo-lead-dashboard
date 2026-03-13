import { collectFromDbpr } from "../scraper-collectors/dbpr-collector.ts";

async function main() {
  const docs = await collectFromDbpr({ maxResults: 500 });
  console.log("DBPR docs count:", docs.length);
}

main().catch((err) => {
  console.error("[run-dbpr-collector] Error:", err);
  process.exit(1);
});

