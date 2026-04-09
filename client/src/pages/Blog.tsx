import { SiteFooter } from "@/components/SiteFooter";
import { DEFAULT_OG_IMAGE } from "@/lib/meta-tags";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";

const CANONICAL_ABSOLUTE = "https://www.gigxo.com/blog";

const pageTitle = "Blog | Gigxo";
const pageDescription =
  "Festival coverage, industry news, and insider perspectives from the South Florida music and events scene.";

const ARTICLES = [
  {
    href: "/blog/tortuga-2026",
    title: "I Was Inside Tortuga 2026 Before Anyone Else",
    author: "Leila Cruz",
    date: "April 8, 2026",
    teaser:
      "Setup day at Tortuga Music Festival — production, the rain, and what the crowd never sees.",
  },
];

export default function Blog() {
  const url = CANONICAL_ABSOLUTE;

  return (
    <div style={{ minHeight: "100vh", background: "#f9f7f4" }}>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={DEFAULT_OG_IMAGE} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={DEFAULT_OG_IMAGE} />
      </Helmet>

      <nav
        style={{
          borderBottom: "1px solid rgba(201,168,76,0.15)",
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            padding: "1rem 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link href="/">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect width="28" height="28" rx="4" fill="#c9a84c" fillOpacity="0.12" />
                <path
                  d="M4 18 Q7 10 10 14 Q13 18 16 10 Q19 2 22 10 Q24 15 26 12"
                  stroke="#c9a84c"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
              <span
                style={{
                  fontSize: "1.4rem",
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  color: "#1c1c2e",
                }}
              >
                Gig<span style={{ color: "#c9a84c" }}>XO</span>
              </span>
            </div>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Link href="/blog">
              <span
                style={{
                  padding: "0.35rem 0",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: "#c9a84c",
                  cursor: "pointer",
                }}
              >
                Blog
              </span>
            </Link>
            <Link href="/login">
              <button
                type="button"
                style={{
                  padding: "0.5rem 1.25rem",
                  border: "1px solid rgba(201,168,76,0.4)",
                  background: "transparent",
                  color: "#c9a84c",
                  borderRadius: "2px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                Sign In
              </button>
            </Link>
            <Link href="/signup">
              <button
                type="button"
                style={{
                  padding: "0.5rem 1.25rem",
                  background: "linear-gradient(135deg,#c9a84c,#e8c97a)",
                  color: "#1c1c2e",
                  borderRadius: "2px",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Get Access
              </button>
            </Link>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: "1100px", margin: "0 auto", padding: "3rem 1.5rem 5rem" }}>
        <p
          style={{
            fontSize: "0.7rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#a89870",
            fontWeight: 700,
            marginBottom: "0.75rem",
          }}
        >
          Gigxo blog
        </p>
        <h1
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "clamp(2rem, 4vw, 2.75rem)",
            fontWeight: 700,
            color: "#1c1c2e",
            lineHeight: 1.15,
            margin: "0 0 1rem",
            letterSpacing: "-0.02em",
          }}
        >
          Stories from the Scene
        </h1>
        <p
          style={{
            fontSize: "1.1rem",
            color: "#6b6860",
            lineHeight: 1.65,
            maxWidth: "36rem",
            margin: "0 0 2.75rem",
          }}
        >
          Industry news, festival coverage, and insider perspectives from South Florida
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))",
            gap: "1.5rem",
          }}
        >
          {ARTICLES.map((post) => (
            <Link key={post.href} href={post.href}>
              <article
                style={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  padding: "1.5rem 1.5rem 1.35rem",
                  background: "#ffffff",
                  border: "1px solid rgba(201,168,76,0.22)",
                  borderRadius: "4px",
                  boxShadow: "0 8px 28px rgba(28,28,46,0.06)",
                  cursor: "pointer",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                className="blog-index-card"
              >
                <h2
                  style={{
                    fontFamily: "Georgia, serif",
                    fontSize: "1.2rem",
                    fontWeight: 700,
                    color: "#1c1c2e",
                    lineHeight: 1.35,
                    margin: "0 0 0.75rem",
                  }}
                >
                  {post.title}
                </h2>
                <p style={{ fontSize: "0.82rem", color: "#8a857a", margin: "0 0 0.35rem" }}>
                  <span style={{ fontWeight: 600, color: "#5c584f" }}>{post.author}</span>
                  <span style={{ margin: "0 0.35rem", color: "#d4cfc6" }}>·</span>
                  {post.date}
                </p>
                <p
                  style={{
                    fontSize: "0.95rem",
                    color: "#4a4740",
                    lineHeight: 1.6,
                    margin: "0 0 1.25rem",
                    flex: 1,
                  }}
                >
                  {post.teaser}
                </p>
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#c9a84c",
                  }}
                >
                  Read article →
                </span>
              </article>
            </Link>
          ))}
        </div>
      </main>

      <SiteFooter />
      <style>{`
        .blog-index-card:hover {
          border-color: rgba(201, 168, 76, 0.45);
          box-shadow: 0 12px 36px rgba(28, 28, 46, 0.1);
        }
      `}</style>
    </div>
  );
}
