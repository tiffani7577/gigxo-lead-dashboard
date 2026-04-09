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
          It&apos;s 7am on Fort Lauderdale Beach and I am soaked through my shoes.
        </p>
        <p style={{ fontSize: "1.0625rem", lineHeight: 1.75, marginBottom: "1.5rem" }}>
          The rain is coming down hard — not a Florida drizzle, a full sideways downpour — and I&apos;m staring at a wooden ramp bolted to the back of the MainStage. It&apos;s maybe 16 feet long, rises about five feet off the ground, and the panels are slick with rainwater. My coworker pulls me aside before we start.
        </p>
        <p style={{ fontSize: "1.0625rem", lineHeight: 1.75, marginBottom: "1.5rem" }}>
          &quot;Be careful on that ramp,&quot; she says. &quot;I fell through one like it a few years ago. Really bad foot injury.&quot;
        </p>
        <p style={{ fontSize: "1.0625rem", lineHeight: 1.75, marginBottom: "1.5rem" }}>
          I nod. Then we grab the case — easily 500, sometimes closer to 1,000 pounds of production equipment — get a running start, and push it up anyway. Sometimes you need four people. Sometimes the crane just has to take it because there&apos;s no other option. For the first two hours of Tortuga 2026 setup day, that was the job. Soaked, running, pushing, repeat.
        </p>
        <p style={{ fontSize: "1.0625rem", lineHeight: 1.75, marginBottom: "1.5rem" }}>
          This is what a major music festival looks like before 50,000 people show up.
        </p>

        <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.35rem", fontWeight: 700, color: "#1c1c2e", marginTop: "2.25rem", marginBottom: "1rem" }}>
          THE STAGE IS RIGHT ON THE OCEAN
        </h2>
        <p style={{ fontSize: "1.0625rem", lineHeight: 1.75, marginBottom: "1.5rem" }}>
          Nothing prepares you for the MainStage at Tortuga. It sits directly on the sand — not near the beach, not overlooking the beach — on it, practically touching the water. A clear plastic barrier lines the ocean&apos;s edge along the front, separating the Atlantic from the festival grounds.
        </p>
        <p style={{ fontSize: "1.0625rem", lineHeight: 1.75, marginBottom: "1.5rem" }}>
          Out front, the stage extends into the crowd with a thrust — a narrow peninsula about 20 feet deep that juts out at center stage. When an artist walks out on it, they&apos;re surrounded on three sides by the audience. That&apos;s not an accident. That&apos;s design.
        </p>
        <p style={{ fontSize: "1.0625rem", lineHeight: 1.75, marginBottom: "1.5rem" }}>
          The LED screen anchoring the back of the stage is enormous. We&apos;re talking 100 feet or more. Aligning it takes most of the day and a crew that knows exactly what they&apos;re doing. And then there&apos;s the rigging — the kind of overhead infrastructure that takes hours just to load in, requires specialized equipment, and has to be perfect before anything else can happen.
        </p>

        <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.35rem", fontWeight: 700, color: "#1c1c2e", marginTop: "2.25rem", marginBottom: "1rem" }}>
          FOUR TRUCKS. ONE ARTIST.
        </h2>
        <p style={{ fontSize: "1.0625rem", lineHeight: 1.75, marginBottom: "1.5rem" }}>
          At some point during load-in, someone on the crew made a comment about all the trucks lined up behind the stage. One of the senior audio engineers — a guy who clearly had done this a hundred times — just laughed.
        </p>
        <p style={{ fontSize: "1.0625rem", lineHeight: 1.75, marginBottom: "1.5rem" }}>
          &quot;All four of those are mine,&quot; he said. &quot;For Post Malone. Chu mean.&quot;
        </p>
        <p style={{ fontSize: "1.0625rem", lineHeight: 1.75, marginBottom: "1.5rem" }}>
          Four trucks. One set. That&apos;s the scale of what Tortuga brings to Fort Lauderdale every year.
        </p>

        <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.35rem", fontWeight: 700, color: "#1c1c2e", marginTop: "2.25rem", marginBottom: "1rem" }}>
          MORNING CHAOS, AFTERNOON MAGIC
        </h2>
        <p style={{ fontSize: "1.0625rem", lineHeight: 1.75, marginBottom: "1.5rem" }}>
          The first half of setup day was genuinely brutal. Rain, heavy equipment, slippery surfaces, the kind of physical work that doesn&apos;t get talked about when people post their festival highlight reels. The crew is a mix of South Florida locals and touring production nationals who travel the festival circuit — people who do this weekend after weekend across the country, and people who know this beach like their backyard.
        </p>
        <p style={{ fontSize: "1.0625rem", lineHeight: 1.75, marginBottom: "1.5rem" }}>
          By midday the storm broke.
        </p>
        <p style={{ fontSize: "1.0625rem", lineHeight: 1.75, marginBottom: "1.5rem" }}>
          And Fort Lauderdale did what Fort Lauderdale does — it transformed almost instantly. Blue skies. Warm air. The horizon filled in with sailboats, cruise ships, and jet skis moving across the Atlantic. Earlier in the morning, massive ships had been anchored out in the distance in the fog and rain, looking like something out of another century. Eerie and cinematic in the best way.
        </p>
        <p style={{ fontSize: "1.0625rem", lineHeight: 1.75, marginBottom: "1.5rem" }}>
          By afternoon, it was paradise.
        </p>

        <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.35rem", fontWeight: 700, color: "#1c1c2e", marginTop: "2.25rem", marginBottom: "1rem" }}>
          THE SECOND STAGE AND THE BEACH LAYOUT
        </h2>
        <p style={{ fontSize: "1.0625rem", lineHeight: 1.75, marginBottom: "1.5rem" }}>
          Beyond the main stage, Tortuga sprawls down the beach in a way that gives the whole festival a different energy than your typical landlocked event. The second stage glows in the distance — about a quarter mile down the shoreline — visible from the main area like a lighthouse. Giant tents are going up in between, colorful and lit, creating their own atmosphere along the sand.
        </p>
        <p style={{ fontSize: "1.0625rem", lineHeight: 1.75, marginBottom: "1.5rem" }}>
          It&apos;s a big footprint. Plan your day accordingly. And plan your exit — because if last year was any indicator, the streets around Fort Lauderdale Beach after the final set are not for the faint of heart. Forty-five minutes to get off the beach block is not an exaggeration. It&apos;s basically a Tortuga tradition at this point.
        </p>

        <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.35rem", fontWeight: 700, color: "#1c1c2e", marginTop: "2.25rem", marginBottom: "1rem" }}>
          THE ENERGY THIS YEAR
        </h2>
        <p style={{ fontSize: "1.0625rem", lineHeight: 1.75, marginBottom: "1.5rem" }}>
          Without getting into specifics, the vibe on set this year felt noticeably more collaborative than previous years. The crew worked hard, moved fast, and looked out for each other — even when the conditions were rough. That matters more than people realize. When the leads set a good tone, the whole production runs better. And today, despite the rain and the chaos and the physical grind of it all, people were genuinely taking care of each other on that ramp.
        </p>

        <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.35rem", fontWeight: 700, color: "#1c1c2e", marginTop: "2.25rem", marginBottom: "1rem" }}>
          WHAT THIS WEEKEND IS GOING TO LOOK LIKE
        </h2>
        <p style={{ fontSize: "1.0625rem", lineHeight: 1.75, marginBottom: "1.5rem" }}>
          Rain or shine — and based on today, probably both — Tortuga 2026 is going to be something. The production scale is there. The location is still one of the most unique festival settings in the country. And the city of Fort Lauderdale does this better every year.
        </p>
        <p style={{ fontSize: "1.0625rem", lineHeight: 1.75, marginBottom: "1.5rem" }}>
          If you&apos;re going this weekend, get there early. Wear shoes you don&apos;t mind ruining. Find the second stage. And when Post Malone walks out on that thrust into the crowd — remember that four trucks worth of equipment made that moment possible, and a crew of people got soaked in the rain making sure it was perfect.
        </p>

        <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.35rem", fontWeight: 700, color: "#1c1c2e", marginTop: "2.25rem", marginBottom: "1rem" }}>
          FOR SOUTH FLORIDA PERFORMERS AND CREW
        </h2>
        <p style={{ fontSize: "1.0625rem", lineHeight: 1.75, marginBottom: "1.5rem" }}>
          Events like Tortuga are a reminder of just how much live production happens in this region every single year. Fort Lauderdale, Miami, West Palm — the South Florida market runs year-round with festivals, corporate events, private bookings, and everything in between.
        </p>
        <p style={{ fontSize: "1.0625rem", lineHeight: 1.75, marginBottom: "1.5rem" }}>
          If you&apos;re a DJ, band, AV tech, or live performer looking for your next booking, Gigxo connects South Florida performers directly with real clients — no commission, no middleman. Leads start at $7.{" "}
          <Link href="/" style={{ color: "#a07830", fontWeight: 600 }}>
            gigxo.com
          </Link>
        </p>

        <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.35rem", fontWeight: 700, color: "#1c1c2e", marginTop: "2.25rem", marginBottom: "1rem" }}>
          COME BACK AFTER THE WEEKEND
        </h2>
        <p style={{ fontSize: "1.0625rem", lineHeight: 1.75, marginBottom: "1.5rem" }}>
          Full Tortuga 2026 recap dropping Monday. More on the performances, the production, and what it actually looked like when 50,000 people finally showed up.
        </p>
        <p style={{ fontSize: "1.0625rem", lineHeight: 1.75, marginBottom: "1.5rem" }}>
          Tortuga Music Festival 2026 runs April 11–13 on Fort Lauderdale Beach. Main stage doors open at noon daily.
        </p>
        <p style={{ fontSize: "1.0625rem", lineHeight: 1.75, marginBottom: "0", color: "#6b6860" }}>
          Leila Cruz covers live events and the South Florida music scene for Gigxo.
        </p>
      </article>

      <SiteFooter />
    </div>
  );
}
