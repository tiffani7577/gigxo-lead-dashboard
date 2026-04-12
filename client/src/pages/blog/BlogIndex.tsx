import PublicSiteNav from "@/components/PublicSiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { DEFAULT_OG_IMAGE } from "@/lib/meta-tags";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";

const CANONICAL = "https://www.gigxo.com/blog";

const pageTitle = "Blog | Gigxo";
const pageDescription =
  "Festival coverage, field notes, and insider perspectives from the South Florida DJ and live events scene.";

const POSTS = [
  {
    href: "/blog/miami-pride-2026",
    title: "Miami Pride 2026: The Garden of Eve Stage Proved Why South Florida's DJ Scene Is Unstoppable",
    subtitle:
      "We spent Pride weekend at the Garden of Eve stage. Here's what happened when 12 women DJs took over and why it matters for the future of live events in Miami.",
    date: "April 2026",
    thumb: "/images/blog/miami-pride-2026/IMG_2145.jpeg",
    thumbAlt: "Two women DJs smiling at the Garden of Eve booth, crowd behind",
  },
  {
    href: "/blog/tortuga-2026",
    title: "I Was Inside Tortuga 2026 Before Anyone Else",
    subtitle: "Setup day at Tortuga Music Festival — production, the rain, and what the crowd never sees.",
    date: "April 8, 2026",
    thumb: DEFAULT_OG_IMAGE,
    thumbAlt: "Gigxo",
  },
];

export default function BlogIndex() {
  return (
    <div style={{ minHeight: "100vh", background: "#080808", color: "#e8e0d0" }}>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <link rel="canonical" href={CANONICAL} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:url" content={CANONICAL} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={DEFAULT_OG_IMAGE} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={DEFAULT_OG_IMAGE} />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </Helmet>

      <PublicSiteNav />

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "3rem 1.5rem 5rem" }}>
        <p
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "#c9a84c",
            fontWeight: 700,
            marginBottom: "0.75rem",
          }}
        >
          Gigxo blog
        </p>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: "clamp(2rem, 4vw, 3rem)",
            fontWeight: 300,
            color: "#e8e0d0",
            marginBottom: "0.5rem",
              lineHeight: 1.15,
          }}
        >
          Field notes &amp; event stories
        </h1>
        <p style={{ fontFamily: "Inter, sans-serif", color: "#888", fontSize: "1.05rem", marginBottom: "2.5rem", maxWidth: 560 }}>
          {pageDescription}
        </p>

        <div style={{ display: "grid", gap: "1.5rem", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
          {POSTS.map((post) => (
            <div
              key={post.href}
              style={{
                border: "1px solid rgba(201,168,76,0.2)",
                borderRadius: 8,
                overflow: "hidden",
                background: "#0a0a0a",
                transition: "box-shadow 0.2s, border-color 0.2s",
              }}
              className="hover:shadow-lg hover:border-[#c9a84c]/50"
            >
              <Link href={post.href}>
                <div style={{ cursor: "pointer", textDecoration: "none", color: "inherit" }}>
                  <div style={{ aspectRatio: "16 / 10", overflow: "hidden" }}>
                    <img
                      src={post.thumb}
                      alt={post.thumbAlt}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      loading="lazy"
                    />
                  </div>
                  <div style={{ padding: "1.25rem 1.35rem 1.5rem" }}>
                    <p style={{ fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#888", marginBottom: "0.5rem" }}>
                      {post.date}
                    </p>
                    <h2
                      style={{
                        fontFamily: "'Cormorant Garamond', Georgia, serif",
                        fontSize: "1.35rem",
                        fontWeight: 600,
                        color: "#e8e0d0",
                        margin: "0 0 0.5rem",
                        lineHeight: 1.25,
                      }}
                    >
                      {post.title}
                    </h2>
                    <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.95rem", color: "#888", lineHeight: 1.55, margin: "0 0 1rem" }}>
                      {post.subtitle}
                    </p>
                    <span
                      style={{
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: "#c9a84c",
                        fontFamily: "Inter, sans-serif",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                      }}
                    >
                      Read more →
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
