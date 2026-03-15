/**
 * Dynamic sitemap generator for Gigxo SEO
 * Serves /sitemap.xml with all public pages + artist profiles + dynamic SEO pages
 * Services and cities match client/src/lib/seoConfig.ts (13 services × 12 cities).
 */
import type { Express } from "express";

// Synced with client/src/lib/seoConfig.ts — 13 services
const SERVICES = [
  { id: "dj", priority: "0.90" },
  { id: "wedding-dj", priority: "0.90" },
  { id: "live-band", priority: "0.90" },
  { id: "music-producer", priority: "0.80" },
  { id: "podcast-editor", priority: "0.80" },
  { id: "photographer", priority: "0.80" },
  { id: "videographer", priority: "0.80" },
  { id: "yacht-dj", priority: "0.90" },
  { id: "yacht-dj-cost", priority: "0.90" },
  { id: "boat-entertainment-package", priority: "0.80" },
  { id: "band", priority: "0.90" },
  { id: "dj-gigs", priority: "0.80" },
  { id: "venues-hiring-djs", priority: "0.80" },
];

// Synced with client/src/lib/seoConfig.ts — 12 cities
const CITIES = [
  "miami",
  "fort-lauderdale",
  "boca-raton",
  "west-palm-beach",
  "orlando",
  "tampa",
  "jacksonville",
  "naples",
  "key-west",
  "bahia-mar-marina",
  "pier-sixty-six-marina",
  "port-everglades-yacht",
];

function minimalSitemap(baseUrl: string): string {
  const now = new Date().toISOString().split("T")[0];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;
}

export function registerSitemapRoute(app: Express) {
  app.get("/sitemap.xml", async (req, res) => {
    const baseUrl = "https://gigxo.com";
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600"); // Cache 1 hour

    try {
      const now = new Date().toISOString().split("T")[0];

      // Static pages
      const staticPages = [
        { url: "/", priority: "1.0", changefreq: "daily" },
        { url: "/pricing", priority: "0.8", changefreq: "monthly" },
        { url: "/signup", priority: "0.8", changefreq: "monthly" },
        { url: "/login", priority: "0.5", changefreq: "monthly" },
        { url: "/privacy", priority: "0.3", changefreq: "monthly" },
        { url: "/terms", priority: "0.3", changefreq: "monthly" },
        { url: "/artists", priority: "0.9", changefreq: "daily" },
      ];

      // SEO landing pages - service × city (matches seoConfig)
      const seoPages: Array<{ url: string; priority: string; changefreq: string }> = [];
      for (const service of SERVICES) {
        for (const city of CITIES) {
          const slug = `${service.id}-${city}`;
          seoPages.push({
            url: `/${slug}`,
            priority: service.priority,
            changefreq: "weekly",
          });
        }
      }

      // Dynamic artist profile pages
      let artistPages: Array<{ url: string; priority: string; changefreq: string }> = [];
      try {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (db) {
          const { artistProfiles, users } = await import("../drizzle/schema");
          const { isNotNull, eq } = await import("drizzle-orm");
          const profiles = await db
            .select({ slug: artistProfiles.slug, email: users.email })
            .from(artistProfiles)
            .innerJoin(users, eq(artistProfiles.userId, users.id))
            .where(isNotNull(artistProfiles.slug));

          const isSeedEmail = (email: string | null) => (email ?? "").toLowerCase().endsWith("@gigxo.local");
          artistPages = profiles
            .filter(p => p.slug && !isSeedEmail(p.email))
            .map(p => ({
              url: `/artist/${p.slug}`,
              priority: "0.7",
              changefreq: "weekly",
            }));
        }
      } catch (e) {
        console.error("[Sitemap] Failed to load artist profiles:", e);
      }

      const allPages = [...staticPages, ...seoPages, ...artistPages];

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${allPages
  .map(
    page => `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

      res.send(xml);
    } catch (err) {
      console.error("[Sitemap] Handler error:", err);
      res.send(minimalSitemap(baseUrl));
    }
  });
}
