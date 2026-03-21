/**
 * Dynamic meta tag setter for SEO landing pages
 * Updates OG tags, Twitter Card, and canonical URL per page
 */

const DEFAULT_OG_IMAGE = "https://www.gigxo.com/og-default.png";

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
  if (metaDesc) metaDesc.setAttribute('content', config.description);

  // Update canonical URL
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', config.url);

  // Update OG tags
  updateOrCreateMeta('property', 'og:title', config.title);
  updateOrCreateMeta('property', 'og:description', config.description);
  updateOrCreateMeta('property', 'og:url', config.url);
  updateOrCreateMeta('property', 'og:image', imageUrl);

  // Update Twitter Card
  updateOrCreateMeta('name', 'twitter:card', 'summary_large_image');
  updateOrCreateMeta('name', 'twitter:url', config.url);
  updateOrCreateMeta('name', 'twitter:title', config.title);
  updateOrCreateMeta('name', 'twitter:description', config.description);
  updateOrCreateMeta('name', 'twitter:image', imageUrl);
}

function updateOrCreateMeta(attr: 'name' | 'property', value: string, content: string) {
  let meta = document.querySelector(`meta[${attr}="${value}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attr, value);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}
