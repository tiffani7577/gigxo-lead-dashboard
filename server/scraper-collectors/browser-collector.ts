import puppeteer, { Browser, Page } from "puppeteer";

/**
 * Inbound lead capture feature
 * Browser collector base class with proxy rotation and headless rendering
 * Allows collectors to look like real users instead of bots
 */

// Free proxy list for rotation (in production, use paid residential proxies)
const PROXY_LIST = [
  "http://proxy1.example.com:8080",
  "http://proxy2.example.com:8080",
  "http://proxy3.example.com:8080",
];

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
];

let browserInstance: Browser | null = null;
let proxyIndex = 0;

/**
 * Get or create a shared browser instance
 * Reusing browser instance reduces memory and improves performance
 */
async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  // Launch browser without proxy for now (paid proxies would go here)
  browserInstance = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage", // Reduce memory usage
      "--disable-gpu",
      "--single-process", // For sandbox environment
    ],
  });

  return browserInstance;
}

/**
 * Get next proxy in rotation
 */
function getNextProxy(): string | undefined {
  if (PROXY_LIST.length === 0) return undefined;
  const proxy = PROXY_LIST[proxyIndex % PROXY_LIST.length];
  proxyIndex++;
  return proxy;
}

/**
 * Get random user agent to avoid detection
 */
function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Fetch URL with headless browser, looks like real user
 * @param url URL to fetch
 * @param options Configuration options
 * @returns Page content HTML
 */
export async function fetchWithBrowser(
  url: string,
  options?: {
    waitForSelector?: string;
    timeout?: number;
    scrollToBottom?: boolean;
  }
): Promise<string> {
  const browser = await getBrowser();
  let page: Page | null = null;

  try {
    page = await browser.newPage();

    // Set user agent to look like real browser
    await page.setUserAgent(getRandomUserAgent());

    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // Add random delays to mimic human behavior
    await page.setDefaultNavigationTimeout(30000);
    await page.setDefaultTimeout(30000);

    // Navigate to URL
    await page.goto(url, { waitUntil: "networkidle2" });

    // Wait for specific selector if provided
    if (options?.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, {
        timeout: options.timeout || 10000,
      });
    }

    // Scroll to bottom to trigger lazy loading
    if (options?.scrollToBottom) {
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
      await new Promise((r) => setTimeout(r, 2000)); // Wait for content to load
    }

    // Get page content
    const content = await page.content();
    return content;
  } finally {
    if (page) {
      await page.close();
    }
  }
}

/**
 * Extract text content from URL with browser rendering
 * Useful for JavaScript-heavy pages
 */
export async function extractTextWithBrowser(
  url: string,
  selector?: string
): Promise<string> {
  const browser = await getBrowser();
  let page: Page | null = null;

  try {
    page = await browser.newPage();
    await page.setUserAgent(getRandomUserAgent());
    await page.goto(url, { waitUntil: "networkidle2" });

    if (selector) {
      await page.waitForSelector(selector);
      const text = await page.$eval(selector, (el) => el.textContent || "");
      return text;
    }

    const text = await page.evaluate(() => document.body.innerText);
    return text;
  } finally {
    if (page) {
      await page.close();
    }
  }
}

/**
 * Extract all links from a page
 * Useful for following pagination and related links
 */
export async function extractLinksWithBrowser(
  url: string,
  selector?: string
): Promise<string[]> {
  const browser = await getBrowser();
  let page: Page | null = null;

  try {
    page = await browser.newPage();
    await page.setUserAgent(getRandomUserAgent());
    await page.goto(url, { waitUntil: "networkidle2" });

    const links = await page.evaluate((sel) => {
      const elements = sel
        ? Array.from(document.querySelectorAll(sel))
        : Array.from(document.querySelectorAll("a"));
      return elements
        .map((el) => (el as HTMLAnchorElement).href)
        .filter((href) => href && href.startsWith("http"));
    }, selector);

    return links;
  } finally {
    if (page) {
      await page.close();
    }
  }
}

/**
 * Close browser instance (call on app shutdown)
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}
