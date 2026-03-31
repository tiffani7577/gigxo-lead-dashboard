#!/usr/bin/env node
/**
 * Runs react-snap after Vite build. Paths must stay in sync with server/sitemap.ts
 * (service ids × city ids + extra pricing slugs).
 *
 * react-snap depends on Puppeteer 1.x, which ships an old Chromium that cannot parse
 * modern Vite bundles (optional chaining, etc.). Set PUPPETEER_EXECUTABLE_PATH to a
 * recent Chrome/Chromium, or install Google Chrome (macOS path is auto-detected).
 */
const fs = require("fs");
const { run } = require("react-snap");
const pkg = require("../package.json");

function resolveChromeExecutable() {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  if (process.platform === "darwin") {
    const mac = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    if (fs.existsSync(mac)) return mac;
  }
  if (process.platform === "linux") {
    for (const p of [
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
    ]) {
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined;
}

const SERVICES = [
  "dj",
  "wedding-dj",
  "live-band",
  "music-producer",
  "podcast-editor",
  "photographer",
  "videographer",
  "yacht-dj",
  "yacht-dj-cost",
  "boat-entertainment-package",
  "band",
  "dj-gigs",
  "venues-hiring-djs",
  "av-work",
];

const CITIES = [
  "miami",
  "fort-lauderdale",
  "orlando",
  "tampa",
  "jacksonville",
  "boca-raton",
  "west-palm-beach",
  "naples",
  "sarasota",
  "gainesville",
  "tallahassee",
  "pensacola",
  "daytona-beach",
  "melbourne",
  "fort-myers",
  "key-west",
  "clearwater",
  "st-petersburg",
  "ocala",
  "palm-beach",
];

const EXTRA_SEO_SLUGS = [
  "dj-cost-miami",
  "wedding-dj-cost-miami",
  "dj-cost-fort-lauderdale",
  "dj-cost-boca-raton",
];

function buildIncludePaths() {
  const paths = new Set(["/", "/pricing"]);
  for (const serviceId of SERVICES) {
    for (const cityId of CITIES) {
      paths.add(`/${serviceId}-${cityId}`);
    }
  }
  for (const slug of EXTRA_SEO_SLUGS) {
    paths.add(`/${slug}`);
  }
  return Array.from(paths).sort();
}

const reactSnap = pkg.reactSnap || {};
const include = buildIncludePaths();
const puppeteerExecutablePath = resolveChromeExecutable();

if (!puppeteerExecutablePath) {
  console.error(
    "[react-snap] No modern Chrome/Chromium found. Install Google Chrome or set PUPPETEER_EXECUTABLE_PATH.\n" +
      "The bundled Chromium in react-snap is too old to run this app's JavaScript."
  );
  process.exit(1);
}

run({
  ...reactSnap,
  puppeteerExecutablePath,
  include,
})
  .then(() => {
    console.log(`[react-snap] Prerendered ${include.length} routes into ${reactSnap.source || "dist/public"}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
