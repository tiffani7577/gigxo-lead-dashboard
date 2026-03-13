import fetch from 'node-fetch';

const apiKey = process.env.SCRAPER_API_KEY;
if (!apiKey) {
  console.error('SCRAPER_API_KEY not set');
  process.exit(1);
}

const testUrl = 'https://sfbay.craigslist.org/search/ggg?query=dj+needed&format=json';
const proxyUrl = `https://api.scraperapi.com/?api_key=${apiKey}&url=${encodeURIComponent(testUrl)}&country_code=us`;

console.log('Testing Craigslist via ScraperAPI...');
console.log('URL:', testUrl);

fetch(proxyUrl, { timeout: 20000 })
  .then(res => {
    console.log(`Status: ${res.status}`);
    return res.text();
  })
  .then(text => {
    console.log('Response length:', text.length);
    if (text.length > 0) {
      try {
        const json = JSON.parse(text);
        console.log('JSON parsed successfully');
        console.log('Items count:', Array.isArray(json) ? json.length : (json.items ? json.items.length : 'unknown'));
        console.log('First 500 chars:', text.slice(0, 500));
      } catch (e) {
        console.log('Not JSON, first 500 chars:', text.slice(0, 500));
      }
    }
  })
  .catch(err => {
    console.error('Error:', err.message);
  });
