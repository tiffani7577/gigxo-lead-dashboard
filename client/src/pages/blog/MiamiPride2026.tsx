import type { ReactNode } from "react";
import PublicSiteNav from "@/components/PublicSiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";

const BASE = "/images/blog/miami-pride-2026";

const photos = {
  hero: `${BASE}/preview-2.webp`,
  stageOpener: `${BASE}/preview-14.webp`,
  djBooth: `${BASE}/preview-15.webp`,
  twoDJs: `${BASE}/preview-4.webp`,
  twoDJsDaytime: `${BASE}/preview-9.webp`,
  djsSmiling: `${BASE}/preview-10.webp`,
  crowdDancing1: `${BASE}/preview-12.webp`,
  crowdDancing2: `${BASE}/preview-13.webp`,
  vendorPath: `${BASE}/preview-5.webp`,
  humanSign1: `${BASE}/preview-6.webp`,
  humanSign2: `${BASE}/preview-7.webp`,
  carouselGuy: `${BASE}/preview-8.webp`,
  legacyStage: `${BASE}/preview-3.webp`,
  foodVendor: `${BASE}/preview-11.webp`,
};

const CANONICAL = "https://www.gigxo.com/blog/miami-pride-2026";
const META_DESC =
  "We spent Pride weekend at the Garden of Eve stage. Here's what happened when 12 women DJs took over and why it matters for the future of live events in Miami.";

const imgClass =
  "w-full rounded-lg shadow-lg transition-all duration-300 hover:shadow-xl hover:ring-2 hover:ring-[#c9a84c]/50 object-cover";

export default function MiamiPride2026() {
  return (
    <div style={{ minHeight: "100vh", background: "#080808", color: "#e8e0d0" }}>
      <Helmet>
        <title>Miami Pride 2026: The Garden of Eve Stage | Gigxo Field Notes</title>
        <meta name="description" content={META_DESC} />
        <link rel="canonical" href={CANONICAL} />
        <meta property="og:title" content="Miami Pride 2026: The Garden of Eve Stage | Gigxo" />
        <meta property="og:description" content={META_DESC} />
        <meta property="og:url" content={CANONICAL} />
        <meta property="og:type" content="article" />
        <meta property="og:image" content={`https://www.gigxo.com${photos.hero}`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Miami Pride 2026: The Garden of Eve Stage | Gigxo" />
        <meta name="twitter:description" content={META_DESC} />
        <meta name="twitter:image" content={`https://www.gigxo.com${photos.hero}`} />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </Helmet>

      <PublicSiteNav />

      {/* HERO */}
      <div style={{ position: "relative", height: "70vh", minHeight: 320, width: "100%" }}>
        <img
          src={photos.hero}
          alt="Rainbow pride flag canopy over crowd at Miami Pride, red stage lights"
          className={imgClass}
          style={{ height: "100%", width: "100%", objectFit: "cover", borderRadius: 0 }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to bottom, rgba(8,8,8,0.35) 0%, rgba(8,8,8,0.85) 100%)",
            pointerEvents: "none",
          }}
        />
      </div>

      <article style={{ maxWidth: 720, margin: "0 auto", padding: "2.5rem 1.5rem 4rem" }}>
        <header style={{ marginBottom: "2.5rem", textAlign: "center" }}>
          <p
            style={{
              fontSize: "0.65rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#888",
              marginBottom: "1rem",
            }}
          >
            Gigxo Field Notes · April 2026
          </p>
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: "clamp(1.75rem, 4vw, 2.35rem)",
              fontWeight: 600,
              color: "#e8e0d0",
              lineHeight: 1.2,
              margin: "0 0 1rem",
            }}
          >
            MIAMI PRIDE 2026: The Garden of Eve Stage Proved Why South Florida&apos;s DJ Scene Is Unstoppable
          </h1>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "1.05rem", color: "#888", lineHeight: 1.6, margin: 0 }}>
            {META_DESC}
          </p>
        </header>

        <SectionTitle>The Stage That Stole the Show</SectionTitle>
        <Body>
          <p>
            Everyone talks about the main stages. The headliners. The legacy acts with their decades of history and
            built-in crowds.
          </p>
          <p>But if you were actually there at Miami Pride 2026, you know where the real energy was.</p>
          <p>
            The Garden of Eve stage wasn&apos;t just another tent with speakers. It was a statement. Twelve women DJs,
            back-to-back, proving that representation isn&apos;t charity. It&apos;s competitive advantage.
          </p>
          <p>
            Here&apos;s what we saw: People stayed. Between sets, they held their ground. No migration to other stages.
            No phone-scrolling. Just a crowd that knew they were witnessing something specific and didn&apos;t want to
            miss a minute.
          </p>
          <p>
            These weren&apos;t &quot;female DJs.&quot; They were DJs. Artists who happened to be women, operating at a
            level that made gender irrelevant to the quality and completely central to the moment.
          </p>
        </Body>

        <figure style={{ margin: "2rem 0" }}>
          <img src={photos.stageOpener} alt="DJ booth from behind with Pioneer decks, crowd dancing, sunflower ceiling" className={imgClass} loading="lazy" />
        </figure>
        <figure style={{ margin: "2rem 0" }}>
          <img src={photos.twoDJs} alt="Garden of Eve tent — two women DJs with arms raised, sunflower ceiling at night" className={imgClass} loading="lazy" />
        </figure>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-8">
          <img
            src={photos.twoDJsDaytime}
            alt="Two women DJs at the booth from behind, star hair clips, white headphones, sunflower ceiling"
            className={imgClass}
            loading="lazy"
          />
          <img
            src={photos.djsSmiling}
            alt="Two women DJs smiling at the Garden of Eve booth with crowd behind"
            className={imgClass}
            loading="lazy"
          />
        </div>

        <figure style={{ margin: "2rem 0" }}>
          <img src={photos.djBooth} alt="DJ with pink headphones at Pioneer booth, crowd dancing" className={imgClass} loading="lazy" />
        </figure>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-8">
          <img src={photos.crowdDancing1} alt="Crowd dancing in Garden of Eve tent, sunflower ceiling" className={imgClass} loading="lazy" />
          <img src={photos.crowdDancing2} alt="Crowd energy in Garden of Eve tent, man in white hat dancing" className={imgClass} loading="lazy" />
        </div>

        <figure style={{ margin: "2rem 0" }}>
          <img
            src={photos.vendorPath}
            alt="Vendor walkway at night with rainbow flags, stage lit at end of path"
            className={imgClass}
            loading="lazy"
          />
        </figure>

        <SectionTitle>When the Power Died, the Party Didn&apos;t</SectionTitle>
        <Body>
          <p>Technical reality check: The power cut out. Multiple times.</p>
          <p>You know what didn&apos;t happen? Nobody left.</p>
          <p>
            The crowd cheered through the silence. The crew worked fast. And every time the decks came back online, the
            energy surged higher. Not because people were relieved, but because they were still there, still committed,
            still ready.
          </p>
          <p>
            That&apos;s not luck. That&apos;s what happens when talent earns attention. The audience becomes invested.
            They become patient. They become loyal.
          </p>
        </Body>

        <div style={{ margin: "2.5rem auto", maxWidth: "60%", minWidth: 280 }}>
          <img src={photos.carouselGuy} alt="Festival attendee on carousel horse with pride flag" className={imgClass} loading="lazy" />
        </div>

        <SectionTitle>The Legacy Stages Did What Legacy Does</SectionTitle>
        <Body>
          <p>
            The main stages brought out lifelong fans. Established drag performers and EDM DJs who have been building
            their crowds for decades. That kind of connection between performer and audience is earned over years of
            showing up, and it showed.
          </p>
          <p>
            South Florida&apos;s entertainment scene has real roots. The legacy acts earned their spots. And the newer
            artists coming up behind them, the women on the Garden of Eve stage, are building their own legacy right now
            in real time.
          </p>
        </Body>

        <figure style={{ margin: "2rem 0" }}>
          <img src={photos.legacyStage} alt="Dance stage with purple LED screen, DJ performing, red truss frame" className={imgClass} loading="lazy" />
        </figure>

        <SectionTitle>The Fried Oreos Were Incredible</SectionTitle>
        <Body>
          <p>No festival recap is complete without the food report. The fried Oreos were genuinely amazing. That&apos;s all.</p>
        </Body>

        <div style={{ margin: "2.5rem auto", maxWidth: "70%", minWidth: 280 }}>
          <img src={photos.foodVendor} alt="Food vendor stand: Turkey Legs, Sweet Potatoes, Oreos" className={imgClass} loading="lazy" />
        </div>

        <SectionTitle>The Future Already Knows It&apos;s the Future</SectionTitle>
        <Body>
          <p>
            On the way out we stopped at a vendor booth run by a 12-year-old named Braiden. He was managing his entire
            operation himself. Taking orders, handling money, running the whole thing with complete confidence.
          </p>
          <p>
            When we told him he was going to be very successful one day, he looked up and said simply: &quot;I know.&quot;
          </p>
          <p>
            That quiet certainty is exactly what we saw all night at Miami Pride. From the Garden of Eve DJs to the
            legacy performers to a kid running his own business at 12. South Florida doesn&apos;t wait to be told
            it&apos;s great. It just is.
          </p>
        </Body>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-10">
          <img src={photos.humanSign1} alt="#HUMAN illuminated art installation at night" className={imgClass} loading="lazy" />
          <img src={photos.humanSign2} alt="Crowd walking past #HUMAN installation, palm trees, pride flags" className={imgClass} loading="lazy" />
        </div>

        {/* CTA */}
        <section
          style={{
            marginTop: "3rem",
            padding: "2rem",
            border: "2px solid #c9a84c",
            borderRadius: 8,
            background: "#0a0a0a",
            textAlign: "center",
          }}
        >
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: "1.75rem",
              color: "#c9a84c",
              margin: "0 0 1rem",
              fontWeight: 600,
            }}
          >
            Book Your Next Event with Gigxo
          </h2>
          <p style={{ fontSize: "1.1rem", lineHeight: 1.8, color: "#e8e0d0", marginBottom: "1.25rem" }}>
            If you&apos;re a DJ or performer who wants to play events like Miami Pride, Gigxo connects you directly with
            event organizers and venues across South Florida. No middleman. No commission. Real leads starting at $3.
          </p>
          <p style={{ fontSize: "1.1rem", lineHeight: 1.8, color: "#e8e0d0", marginBottom: "1.5rem" }}>
            If you&apos;re an event organizer looking for vetted local talent, post your gig free at{" "}
            <a href="https://www.gigxo.com/book" style={{ color: "#c9a84c" }}>
              gigxo.com/book
            </a>
            .
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "center" }}>
            <Link href="/book">
              <a
                className="inline-block px-6 py-3 rounded-sm font-semibold uppercase tracking-wide text-sm"
                style={{
                  background: "linear-gradient(135deg,#c9a84c,#e8c97a)",
                  color: "#1c1c2e",
                  textDecoration: "none",
                }}
              >
                Post a gig / Book talent
              </a>
            </Link>
            <a
              href="https://www.gigxo.com/book"
              className="inline-block px-6 py-3 rounded-sm font-semibold uppercase tracking-wide text-sm border border-[#c9a84c] text-[#c9a84c] hover:bg-[#c9a84c]/10"
              style={{ textDecoration: "none" }}
            >
              gigxo.com/book
            </a>
          </div>
        </section>
      </article>

      <SiteFooter />
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: "2rem",
        color: "#c9a84c",
        fontWeight: 600,
        margin: "2.5rem 0 1rem",
        lineHeight: 1.2,
      }}
    >
      {children}
    </h2>
  );
}

function Body({ children }: { children: ReactNode }) {
  return (
    <div
      className="space-y-4"
      style={{ fontFamily: "Inter, sans-serif", fontSize: "1.1rem", lineHeight: 1.8, color: "#e8e0d0" }}
    >
      {children}
    </div>
  );
}
