/**
 * Dynamic meta tag setter for SEO
 * Updates OG tags, Twitter Card, and canonical URL per page
 */

export const DEFAULT_OG_IMAGE = "https://www.gigxo.com/og-default.png";

/** Production default when window / env are unavailable (e.g. tests). */
const FALLBACK_ORIGIN = "https://www.gigxo.com";

/**
 * Site origin for absolute canonicals and OG URLs.
 * Uses current window in the browser; optional VITE_SITE_ORIGIN in build; else www fallback.
 */
export function getSiteOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  const env =
    typeof import.meta !== "undefined"
      ? (import.meta.env.VITE_SITE_ORIGIN as string | undefined)
      : undefined;
  if (env?.trim()) return env.replace(/\/$/, "");
  return FALLBACK_ORIGIN;
}

/**
 * Absolute canonical URL for a pathname (e.g. "/dj-miami", "/av-work/orlando").
 */
export function canonicalUrlForPathname(pathname: string): string {
  const origin = getSiteOrigin();
  let path = pathname.split("?")[0] || "/";
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1) path = path.replace(/\/+$/, "");
  if (path === "/") return `${origin}/`;
  return `${origin}${path}`;
}

export function setMetaTags(config: {
  title: string;
  description: string;
  url: string;
  image?: string;
}) {
  const imageUrl = config.image?.trim() || DEFAULT_OG_IMAGE;

  // Update document title
  document.title = config.title;

  // Update meta description
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute("content", config.description);

  // Update canonical URL
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }
  canonical.setAttribute("href", config.url);

  // Update OG tags
  updateOrCreateMeta("property", "og:title", config.title);
  updateOrCreateMeta("property", "og:description", config.description);
  updateOrCreateMeta("property", "og:url", config.url);
  updateOrCreateMeta("property", "og:image", imageUrl);

  // Update Twitter Card
  updateOrCreateMeta("name", "twitter:card", "summary_large_image");
  updateOrCreateMeta("name", "twitter:url", config.url);
  updateOrCreateMeta("name", "twitter:title", config.title);
  updateOrCreateMeta("name", "twitter:description", config.description);
  updateOrCreateMeta("name", "twitter:image", imageUrl);
}

function updateOrCreateMeta(attr: "name" | "property", value: string, content: string) {
  let meta = document.querySelector(`meta[${attr}="${value}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute(attr, value);
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", content);
}
