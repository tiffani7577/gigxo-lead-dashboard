import { useLocation } from "wouter";
import NotFound from "@/pages/NotFound";
import BlogArticle from "./BlogArticle";
import BlogIndex from "./blog/BlogIndex";
import MiamiPride2026 from "./blog/MiamiPride2026";

/**
 * Mirrors `/blog` routes for stale bundles that still hit `/:slug` → SEOLandingPage.
 * Keep in sync with `App.tsx` blog routes.
 */
export default function BlogCatchAll() {
  const [loc] = useLocation();
  const pathOnly = (loc.split("?")[0] || "/").replace(/\/+$/, "") || "/";

  if (pathOnly === "/blog") {
    return <BlogIndex />;
  }
  if (pathOnly === "/blog/miami-pride-2026") {
    return <MiamiPride2026 />;
  }
  if (pathOnly === "/blog/tortuga-2026") {
    return <BlogArticle />;
  }
  return <NotFound />;
}
