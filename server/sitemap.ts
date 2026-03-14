/**
 * Dynamic sitemap generator for Gigxo SEO
 * Serves /sitemap.xml with all public pages + artist profiles + dynamic SEO pages
 */
import type { Express } from "express";

// Service and city definitions for dynamic SEO page generation
const SERVICES = [
  { id: "dj", priority: "0.90" },
  { id: "wedding-dj", priority: "0.90" },
  { id: "live-band", priority: "0.90" },
  { id: "music-producer", priority: "0.80" },
  { id: "podcast-editor", priority: "0.80" },
  { id: "photographer", priority: "0.80" },
  { id: "videographer", priority: "0.80" },
];

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
];

export function registerSitemapRoute(app: Express) {
  app.get("/sitemap.xml", async (req, res) => {
    const baseUrl = "https://gigxo.com";
    const now = new Date().toISOString().split("T")[0];

    // Static pages
    const staticPages = [
      { url: "/", priority: "1.0", changefreq: "daily" },
      { url: "/artists", priority: "0.9", changefreq: "daily" },
      { url: "/signup", priority: "0.8", changefreq: "monthly" },
      { url: "/login", priority: "0.5", changefreq: "monthly" },
    ];

    // SEO landing pages - dynamically generated from service + city combinations
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

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600"); // Cache 1 hour
    res.send(xml);
  });
}
