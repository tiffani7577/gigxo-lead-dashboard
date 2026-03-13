import fetch from 'node-fetch';

const apiKey = process.env.SCRAPER_API_KEY;
if (!apiKey) {
  console.error('SCRAPER_API_KEY not set');
  process.exit(1);
}

const testUrl = 'https://sfbay.craigslist.org/search/ggg?query=dj&format=json';
const proxyUrl = `https://api.scraperapi.com/?api_key=${apiKey}&url=${encodeURIComponent(testUrl)}&country_code=us`;

console.log('Testing ScraperAPI key...');
fetch(proxyUrl, { timeout: 15000 })
  .then(res => {
    console.log(`Status: ${res.status}`);
    if (res.status === 200) {
      console.log('✓ ScraperAPI key is valid');
      process.exit(0);
    } else if (res.status === 401 || res.status === 403) {
      console.error('✗ ScraperAPI key is invalid or unauthorized');
      process.exit(1);
    } else {
      console.log(`Status ${res.status} - may be temporary`);
      process.exit(0);
    }
  })
  .catch(err => {
    console.error('✗ Request failed:', err.message);
    process.exit(1);
  });
