import { SiteFooter } from "@/components/SiteFooter";
import { DEFAULT_OG_IMAGE } from "@/lib/meta-tags";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";

const CANONICAL_ABSOLUTE = "https://www.gigxo.com/blog/tortuga-2026";

const title = "I Was Inside Tortuga 2026 Before Anyone Else | Gigxo";
const description =
  "Setup day at Tortuga Music Festival 2026 — an insider look at the production, the rain, and what 50,000 people don't see.";

export default function BlogArticle() {
  const url = CANONICAL_ABSOLUTE;

  return (
    <div style={{ minHeight: "100vh", background: "#f9f7f4" }}>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="article" />
        <meta property="og:image" content={DEFAULT_OG_IMAGE} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
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
          <div style={{ display: "flex", gap: "0.75rem" }}>
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

      <article
        style={{
          maxWidth: "42rem",
          margin: "0 auto",
          padding: "3rem 1.5rem 5rem",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          color: "#2d2a26",
        }}
      >
        <p style={{ fontSize: "0.75rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#a89870", marginBottom: "0.75rem", fontWeight: 600 }}>
          Field notes
        </p>
        <h1
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "clamp(1.85rem, 4vw, 2.35rem)",
            fontWeight: 700,
            lineHeight: 1.2,
            color: "#1c1c2e",
            marginBottom: "1.25rem",
            letterSpacing: "-0.02em",
          }}
        >
          I Was Inside Tortuga 2026 Before Anyone Else
        </h1>
        <p style={{ fontSize: "0.95rem", color: "#6b6860", marginBottom: "0.35rem" }}>
          <span style={{ fontWeight: 600, color: "#1c1c2e" }}>Leila Cruz</span>
        </p>
        <p style={{ fontSize: "0.9rem", color: "#8a857a", marginBottom: "2.5rem" }}>April 8, 2026</p>

        <p style={{ fontSize: "1.0625rem", lineHeight: 1.75, marginBottom: "1.5rem" }}>
          The gates weren&apos;t open yet. From the parking lot you could already hear line checks bouncing off the Atlantic &mdash; snare hits and bass that didn&apos;t care about the weather report. I spent setup day at Tortuga Music Festival 2026 walking the same grass fifty thousand people would flatten that weekend, and the weird part is how quiet the crowd energy is when it&apos;s still just vendors, techs, and caffeine.
        </p>

        <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.35rem", fontWeight: 700, color: "#1c1c2e", marginTop: "2.25rem", marginBottom: "1rem" }}>
          What production looks like when nobody&apos;s cheering
        </h2>
        <p style={{ fontSize: "1.0625rem", lineHeight: 1.75, marginBottom: "1.5rem" }}>
          The main stage footprint is deceptively simple from a distance. Up close it&apos;s a city: fly bays, cable runs labeled in tape that will be meaningless by Sunday, cases stacked like Tetris. Stage managers call cues into radios with the calm of people who have done this in every kind of squall. Artists&apos; backline hadn&apos;t fully arrived, but the house PA was already firing &mdash; a reminder that festivals are really logistics festivals, with music at the end.
        </p>

        <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.35rem", fontWeight: 700, color: "#1c1c2e", marginTop: "2.25rem", marginBottom: "1rem" }}>
          The rain doesn&apos;t send anyone home on day zero
        </h2>
        <p style={{ fontSize: "1.0625rem", lineHeight: 1.75, marginBottom: "1.5rem" }}>
          Mid-afternoon the sky bruised and someone joked that Tortuga always keeps a little saltwater in the forecast. Tarps came out; forklifts kept moving. The difference between a fan weekend and a build day is that when the drizzle hits early, nobody posts about it &mdash; they just re-route power and keep climbing trusses. That&apos;s the version of the beach the T-shirts don&apos;t show.
        </p>

        <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.35rem", fontWeight: 700, color: "#1c1c2e", marginTop: "2.25rem", marginBottom: "1rem" }}>
          What fifty thousand people won&apos;t see
        </h2>
        <p style={{ fontSize: "1.0625rem", lineHeight: 1.75, marginBottom: "1.5rem" }}>
          They won&apos;t see the security briefing where everyone agrees which gates swell first. They won&apos;t hear the first full song run at half volume while a dog wanders the empty VIP lawn. They won&apos;t watch a truck driver back a semi into a slot you&apos;d swear was three inches too narrow. Those moments belong to the crew &mdash; and to anyone stubborn enough to show up before the wristbands.
        </p>
        <p style={{ fontSize: "1.0625rem", lineHeight: 1.75, marginBottom: "0" }}>
          By dusk the lights did a full blind: columns of color over bare sand, the ocean dark behind the rigs. For a minute it felt like the festival was already happening, just without the chorus of human noise. Then someone killed the rig, yelled a time stamp into the dark, and the real countdown to doors carried on. I left with wet sneakers and a receipt in my head: next time you sing along at Tortuga, a thousand small decisions already carried you there.
        </p>
      </article>

      <SiteFooter />
    </div>
  );
}
