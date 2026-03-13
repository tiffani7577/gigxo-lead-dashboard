import { runFullScrape } from './server/scraper.ts';

const result = await runFullScrape();
console.log('Scraper result:', JSON.stringify(result, null, 2));
process.exit(0);
