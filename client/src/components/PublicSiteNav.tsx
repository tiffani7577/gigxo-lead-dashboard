import { Link } from "wouter";

/** Dark luxury nav — matches Home: Browse Artists, Blog, Pricing, auth. */
export default function PublicSiteNav() {
  return (
    <nav
      style={{
        background: "rgba(8,8,8,0.92)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(201,168,76,0.12)",
        position: "sticky",
        top: 0,
        zIndex: 100,
        padding: "0 2rem",
        height: "68px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Link href="/">
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer" }}>
          <svg width="22" height="18" viewBox="0 0 22 18" fill="none" aria-hidden>
            <rect x="0" y="6" width="3" height="6" rx="1.5" fill="#C9A84C" />
            <rect x="5" y="2" width="3" height="14" rx="1.5" fill="#C9A84C" />
            <rect x="10" y="0" width="3" height="18" rx="1.5" fill="#C9A84C" />
            <rect x="15" y="3" width="3" height="12" rx="1.5" fill="#C9A84C" />
            <rect x="20" y="7" width="2" height="5" rx="1" fill="#C9A84C" />
          </svg>
          <span style={{ fontFamily: "Inter,sans-serif", fontSize: "1.2rem", fontWeight: 800, letterSpacing: "0.05em", color: "#f0ede8" }}>
            Gig<span style={{ color: "#C9A84C" }}>XO</span>
          </span>
        </div>
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
        <Link href="/artists">
          <span
            style={{
              color: "rgba(240,237,232,0.6)",
              fontSize: "0.7rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Browse Artists
          </span>
        </Link>
        <Link href="/blog">
          <span
            style={{
              color: "rgba(240,237,232,0.6)",
              fontSize: "0.7rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Blog
          </span>
        </Link>
        <Link href="/pricing">
          <span
            style={{
              color: "rgba(240,237,232,0.6)",
              fontSize: "0.7rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Pricing
          </span>
        </Link>
        <Link href="/login">
          <button
            type="button"
            style={{
              background: "transparent",
              color: "#f0ede8",
              fontSize: "0.7rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              padding: "0.5rem 1.25rem",
              border: "1px solid rgba(240,237,232,0.25)",
              borderRadius: "2px",
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
              background: "linear-gradient(135deg,#c9a84c,#e8c97a)",
              color: "#1c1c2e",
              fontSize: "0.7rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              padding: "0.5rem 1.25rem",
              border: "none",
              borderRadius: "2px",
              cursor: "pointer",
            }}
          >
            Get Access
          </button>
        </Link>
      </div>
    </nav>
  );
}
