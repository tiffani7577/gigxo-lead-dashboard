import { useAuth } from "@/_core/hooks/useAuth";
import { PricingPlans } from "@/components/PricingPlans";
import { canonicalUrlForPathname } from "@/lib/meta-tags";
import { Helmet } from "react-helmet-async";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Lock, MapPin, Calendar, Sparkles } from "lucide-react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { SiteFooter } from "@/components/SiteFooter";

// Helper: format budget from cents
function formatBudget(cents: number | null): string {
  if (!cents) return "Budget TBD";
  if (cents >= 100000) return `$${(cents / 100000).toFixed(0)}k`;
  if (cents >= 10000) return `$${(cents / 100).toLocaleString()}`;
  return `$${(cents / 100).toFixed(0)}`;
}

// Helper: performer type label
const PERFORMER_LABELS: Record<string, string> = {
  dj: "DJ", solo_act: "Solo Act", small_band: "Small Band", large_band: "Large Band",
  singer: "Singer", instrumentalist: "Instrumentalist", immersive_experience: "Immersive",
  hybrid_electronic: "Hybrid Electronic", photographer: "Photographer", videographer: "Videographer",
  audio_engineer: "Audio Engineer", other: "Other",
};

function FeaturedLeads() {
  const { data: leads, isLoading } = trpc.leads.getFeatured.useQuery();

  if (isLoading) {
    return (
      <section style={{ padding: '6rem 2rem', background: '#0a0a0a', borderTop: '1px solid rgba(201,168,76,0.08)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '3rem', fontWeight: 300, color: '#f0ede8' }}>Featured Gigs This Week</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1.5rem' }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ background: '#ffffff', border: '1px solid rgba(201,168,76,0.1)', borderRadius: '4px', padding: '1.5rem', animation: 'pulse 2s infinite' }}>
                <div style={{ height: '2rem', background: '#f0ede6', borderRadius: '2px', marginBottom: '1rem', width: '60%' }} />
                <div style={{ height: '1rem', background: '#f0ede6', borderRadius: '2px', marginBottom: '0.5rem', width: '80%' }} />
                <div style={{ height: '1rem', background: '#f0ede6', borderRadius: '2px', width: '50%' }} />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!leads || !Array.isArray(leads) || leads.length === 0) return null;

  return (
    <section style={{ padding: '6rem 2rem', background: '#0a0a0a', borderTop: '1px solid rgba(201,168,76,0.08)' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 1rem', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '2px', marginBottom: '1.25rem' }}>
            <Sparkles style={{ width: '14px', height: '14px', color: '#c9a84c' }} />
            <span style={{ fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#c9a84c', fontWeight: 600 }}>Live Opportunities</span>
          </div>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(2rem,4vw,3.5rem)', fontWeight: 300, color: '#f0ede8', marginBottom: '0.75rem' }}>
            Featured Gigs This Week
          </h2>
          <div style={{ width: '40px', height: '1px', background: '#c9a84c', margin: '1rem auto' }} />
          <p style={{ color: 'rgba(240,237,232,0.5)', fontSize: '0.875rem', maxWidth: '480px', margin: '0 auto' }}>
            The highest-paying leads currently on the platform. Sign up to unlock direct contact info.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
          {leads.map((lead, idx) => (
            <div key={lead.id} className="card-luxury" style={{ background: '#ffffff', border: '1px solid rgba(201,168,76,0.15)', borderRadius: '4px', overflow: 'hidden', transition: 'all 0.3s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(201,168,76,0.4)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(201,168,76,0.15)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}>
              {/* Card header */}
              <div className="lead-card-header" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2rem', fontWeight: 700, color: '#c9a84c' }}>{formatBudget(lead.budget)}</span>
                {lead.performerType && (
                  <span style={{ fontSize: '0.6rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(240,237,232,0.5)', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', padding: '0.3rem 0.7rem', borderRadius: '2px' }}>
                    {PERFORMER_LABELS[lead.performerType] ?? lead.performerType}
                  </span>
                )}
              </div>
              {/* Card body */}
              <div style={{ padding: '1.25rem 1.5rem' }}>
                <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.2rem', fontWeight: 600, color: '#f0ede8', marginBottom: '0.5rem' }}>{lead.title}</h3>
                <div style={{ fontSize: '0.75rem', color: 'rgba(240,237,232,0.45)', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <MapPin style={{ width: '12px', height: '12px' }} />{lead.location}
                </div>
                {lead.eventDate && (
                  <div style={{ fontSize: '0.75rem', color: 'rgba(240,237,232,0.45)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Calendar style={{ width: '12px', height: '12px' }} />
                    {new Date(lead.eventDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                )}
                {lead.description && (
                  <p style={{ fontSize: '0.8rem', color: 'rgba(240,237,232,0.5)', lineHeight: 1.6, marginBottom: '1.25rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{lead.description}</p>
                )}
                {/* Locked state */}
                <div style={{ borderTop: '1px solid rgba(201,168,76,0.1)', paddingTop: '1rem' }}>
                  <div style={{ fontSize: '0.65rem', color: 'rgba(240,237,232,0.3)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Lock style={{ width: '10px', height: '10px' }} /> Contact info locked</span>
                    <span>👁 {12 + idx * 5} viewed</span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: '1px', marginBottom: '0.4rem', width: '75%' }} />
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: '1px', width: '50%' }} />
                </div>
              </div>
              {/* CTA */}
              <div style={{ padding: '0 1.5rem 1.5rem' }}>
                <Link href="/signup">
                  <button type="button" className="btn-gold" style={{ width: '100%' }}>
                    Unlock Lead · Discovery $3 · Standard $7 · Premium $15
                  </button>
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center' }}>
          <Link href="/signup">
            <button style={{ background: 'transparent', color: '#f0ede8', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '0.7rem', padding: '0.85rem 2rem', borderRadius: '2px', border: '1px solid rgba(240,237,232,0.25)', cursor: 'pointer', transition: 'all 0.3s' }}>
              See All Available Gigs <ArrowRight style={{ display: 'inline', width: '14px', height: '14px', marginLeft: '0.5rem' }} />
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, user, navigate]);

  if (isAuthenticated && user) return null;

  const homeTitle = "Gigxo — Gig Leads for DJs & Live Artists";
  const homeDescription = "Browse verified gig leads for DJs and performers across the US. Unlock contact info from $7. No commission, no middleman.";
  const homeCanonical = canonicalUrlForPathname("/");
  const homeOg = `${homeCanonical.replace(/\/$/, "")}/og-default.png`;

  return (
    <div style={{ background: '#f9f7f4', minHeight: '100vh' }}>
      <Helmet>
        <title>{homeTitle}</title>
        <meta name="description" content={homeDescription} />
        <link rel="canonical" href={homeCanonical} />
        <meta property="og:title" content={homeTitle} />
        <meta property="og:description" content={homeDescription} />
        <meta property="og:url" content={homeCanonical} />
        <meta property="og:image" content={homeOg} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={homeTitle} />
        <meta name="twitter:description" content={homeDescription} />
        <meta name="twitter:image" content={homeOg} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </Helmet>

      {/* ── NAV ── */}
      <nav
        style={{
          background: 'rgba(8,8,8,0.92)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(201,168,76,0.12)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          padding: '0 2rem',
          height: '68px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <svg width="22" height="18" viewBox="0 0 22 18" fill="none">
            <rect x="0" y="6" width="3" height="6" rx="1.5" fill="#C9A84C"/>
            <rect x="5" y="2" width="3" height="14" rx="1.5" fill="#C9A84C"/>
            <rect x="10" y="0" width="3" height="18" rx="1.5" fill="#C9A84C"/>
            <rect x="15" y="3" width="3" height="12" rx="1.5" fill="#C9A84C"/>
            <rect x="20" y="7" width="2" height="5" rx="1" fill="#C9A84C"/>
          </svg>
          <span style={{ fontFamily: 'Inter,sans-serif', fontSize: '1.2rem', fontWeight: 800, letterSpacing: '0.05em' }}>
            Gig<span style={{ color: '#C9A84C' }}>XO</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <Link href="/artists">
            <span style={{ color: 'rgba(240,237,232,0.6)', fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'none' }}>Browse Artists</span>
          </Link>
          <Link href="/pricing">
            <span style={{ color: 'rgba(240,237,232,0.6)', fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'none' }}>Pricing</span>
          </Link>
          <Link href="/login">
            <button style={{ background: 'transparent', color: '#f0ede8', fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0.5rem 1.25rem', border: '1px solid rgba(240,237,232,0.25)', borderRadius: '2px', cursor: 'pointer' }}>Sign In</button>
          </Link>
          <Link href="/signup">
            <button style={{ background: 'linear-gradient(135deg,#c9a84c,#e8c97a)', color: '#1c1c2e', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0.5rem 1.25rem', border: 'none', borderRadius: '2px', cursor: 'pointer' }}>Get Access</button>
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <img src="/images/hero_v2_golden.jpg" alt="Luxury yacht party Fort Lauderdale" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        <div className="hero-overlay" style={{ position: 'absolute', inset: 0 }} />
        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', maxWidth: '900px', padding: '0 2rem' }}>
          <p className="section-label" style={{ marginBottom: '1.5rem' }}>Fort Lauderdale · South Florida</p>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(3rem,8vw,6rem)', fontWeight: 300, lineHeight: 1.05, margin: '0 0 2rem' }}>
            <span style={{ display: 'block' }}>Real Gig Leads.</span>
            <span style={{ display: 'block', color: 'var(--gold)' }}>Zero Commission.</span>
          </h1>
          <p style={{ fontSize: '1.1rem', color: 'rgba(240,237,232,0.75)', maxWidth: '560px', margin: '0 auto 2.5rem', lineHeight: 1.7, fontWeight: 300 }}>
            Verified private event leads for DJs and live artists across South Florida. Unlock direct contact from $7 — no middleman, no booking fees, ever.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '4rem' }}>
            <button className="btn-gold" onClick={() => navigate('/gigs')}>
              See Today's Leads
            </button>
            <button className="btn-ghost" onClick={() => navigate('/signup')}>
              Join Free
            </button>
          </div>
          <div style={{ display: 'flex', gap: '3rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {[{ value: '50+', label: 'Artists Earning' }, { value: '$0', label: 'Commission Ever' }, { value: 'From $7', label: 'Per Lead Unlock' }, { value: 'Daily', label: 'New Leads Added' }].map((s) => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.8rem', color: 'var(--gold)' }}>{s.value}</div>
                <div style={{ fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(240,237,232,0.5)', marginTop: '0.35rem' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured article */}
      <section
        style={{
          padding: "1.35rem 2rem",
          background: "rgba(10,10,10,0.96)",
          borderBottom: "1px solid rgba(201,168,76,0.14)",
        }}
      >
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              padding: "1.25rem 1.5rem",
              borderRadius: "4px",
              border: "1px solid rgba(201,168,76,0.22)",
              background: "rgba(201,168,76,0.06)",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
              <div>
                <p
                  style={{
                    fontSize: "0.62rem",
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "#c9a84c",
                    fontWeight: 700,
                    marginBottom: "0.45rem",
                  }}
                >
                  Featured article
                </p>
                <h2
                  style={{
                    fontFamily: "Cormorant Garamond, serif",
                    fontSize: "clamp(1.2rem, 2.5vw, 1.55rem)",
                    fontWeight: 600,
                    color: "#f0ede8",
                    lineHeight: 1.25,
                    margin: 0,
                  }}
                >
                  I Was Inside Tortuga 2026 Before Anyone Else
                </h2>
                <p style={{ margin: "0.5rem 0 0", fontSize: "0.88rem", color: "rgba(240,237,232,0.55)", maxWidth: "36rem", lineHeight: 1.55 }}>
                  Setup day at Tortuga Music Festival — production, weather, and what the crowd never sees.
                </p>
              </div>
              <Link href="/blog/tortuga-2026">
                <button
                  type="button"
                  style={{
                    flexShrink: 0,
                    padding: "0.55rem 1.35rem",
                    background: "linear-gradient(135deg,#c9a84c,#e8c97a)",
                    color: "#1c1c2e",
                    border: "none",
                    borderRadius: "2px",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  Read More
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="trust-bar" style={{ padding: '1.25rem 2rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '1.5rem', overflowX: 'auto' }}>
          <span className="section-label" style={{ whiteSpace: 'nowrap' }}>Leads From</span>
          <div style={{ width: '1px', height: '16px', background: 'rgba(201,168,76,0.3)', flexShrink: 0 }} />
          {['Bahia Mar Marina', 'Pier Sixty-Six', 'Port Everglades', 'Las Olas Riverfront', 'W Fort Lauderdale', 'Marriott Harbor Beach', 'Hard Rock Hollywood'].map((v, i) => (
            <span key={i} style={{ fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(240,237,232,0.45)', whiteSpace: 'nowrap' }}>{v}</span>
          ))}
        </div>
      </div>

      {/* ── SPLIT SECTION ── */}
      <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '8rem 2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6rem', alignItems: 'center' }}>
        <div>
          <p style={{ fontSize: '0.65rem', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#c9a84c', fontWeight: 500, marginBottom: '1rem' }}>Why Gigxo</p>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(2.5rem,4vw,4rem)', fontWeight: 300, lineHeight: 1.1, color: '#f0ede8', marginBottom: '1.5rem' }}>
            Built for artists who<br /><em style={{ color: '#c9a84c', fontStyle: 'italic' }}>want to make money</em>
          </h2>
          <p style={{ color: 'rgba(240,237,232,0.6)', lineHeight: 1.8, marginBottom: '2rem', fontSize: '0.95rem' }}>
            Every lead on Gigxo is curated and verified. No spam, no tire-kickers. We specialize in the South Florida market — from 17th Street Causeway to Bahia Mar, Port Everglades, and beyond. Unlock direct contact info and book without a middleman.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2.5rem' }}>
            {["Verified yacht, marina & private event leads","Direct contact — no booking fees, ever","Fort Lauderdale, Miami, Palm Beach coverage","New leads added daily"].map((f,i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ color: '#c9a84c', fontSize: '0.6rem' }}>◆</span>
                <span style={{ fontSize: '0.875rem', color: 'rgba(240,237,232,0.7)' }}>{f}</span>
              </div>
            ))}
          </div>
          <Link href="/signup">
            <button style={{ background: 'linear-gradient(135deg,#c9a84c,#e8c97a)', color: '#1c1c2e', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.75rem', padding: '0.85rem 2rem', borderRadius: '2px', border: 'none', cursor: 'pointer' }}>
              Unlock a Lead Today
            </button>
          </Link>
        </div>
        <div style={{ position: 'relative' }}>
          <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663413300520/FfzDPmosjlPHpdHO.jpg" alt="Luxury yacht event Fort Lauderdale"
            style={{ width: '100%', height: '520px', objectFit: 'cover', borderRadius: '2px', display: 'block' }} />
          <div style={{ position: 'absolute', bottom: '2rem', left: '-2rem', background: '#ffffff', border: '1px solid rgba(201,168,76,0.3)', padding: '1.25rem 1.5rem', borderRadius: '2px', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
            <div style={{ fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#c9a84c', marginBottom: '0.4rem' }}>Latest Lead</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.3rem', color: '#f0ede8', fontWeight: 600 }}>Yacht Charter · Fort Lauderdale</div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(240,237,232,0.5)', marginTop: '0.25rem' }}>17th St Marina · Premium Lead</div>
          </div>
        </div>
      </section>

      {/* ── PHOTO STRIP ── */}
      <section style={{ padding: '0 2rem 6rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem' }}>
          <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663413300520/SBBXIrGvxQBmkJQD.jpg" alt="Intracoastal boat party Fort Lauderdale"
            style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '2px' }} />
          <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663413300520/tRkmkWCAeEumIllR.jpg" alt="Festival DJ gig South Florida"
            style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '2px' }} />
          <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663413300520/cfKhGCAitiAmvTKa.jpg" alt="Nightclub DJ Miami"
            style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '2px' }} />
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ background: '#0a0a0a', padding: '6rem 2rem', borderTop: '1px solid rgba(201,168,76,0.08)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '5rem' }}>
            <p style={{ fontSize: '0.65rem', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#c9a84c', fontWeight: 500, marginBottom: '1rem' }}>The Process</p>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(2rem,4vw,3.5rem)', fontWeight: 300, color: '#f0ede8' }}>How Gigxo Works</h2>
            <div style={{ width: '40px', height: '1px', background: '#c9a84c', margin: '1rem auto' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '3rem' }}>
            {[
              { step: "01", title: "Create Your Profile", desc: "Tell us your genres, location, and what you're looking for. We'll match you with the right leads." },
              { step: "02", title: "Browse Matched Leads", desc: "See verified gigs that match your profile. View budget, location, and event details — all free." },
              { step: "03", title: "Unlock & Book Direct", desc: "Pay once to unlock contact info. Discovery $3, Standard $7, Premium $15. No commission, no middleman. Ever." },
            ].map(item => (
              <div key={item.step} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '4rem', fontWeight: 300, color: 'rgba(201,168,76,0.2)', lineHeight: 1, marginBottom: '1rem' }}>{item.step}</div>
                <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.4rem', fontWeight: 600, color: '#f0ede8', marginBottom: '0.75rem' }}>{item.title}</h3>
                <p style={{ fontSize: '0.875rem', color: 'rgba(240,237,232,0.5)', lineHeight: 1.7 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED LEADS ── */}
      <FeaturedLeads />

      {/* ── PRICING ── */}
      <section style={{ padding: '6rem 2rem', background: '#f9f7f4' }} id="pricing">
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <p style={{ fontSize: '0.65rem', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#c9a84c', fontWeight: 500, marginBottom: '1rem' }}>Membership</p>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(2rem,4vw,3.5rem)', fontWeight: 300, color: '#f0ede8' }}>Simple, Transparent Pricing</h2>
            <div style={{ width: '40px', height: '1px', background: '#c9a84c', margin: '1rem auto' }} />
            <p style={{ color: 'rgba(240,237,232,0.5)', fontSize: '0.875rem' }}>No hidden fees. No commission. Pay per unlock or go Pro.</p>
          </div>
          <PricingPlans variant="dark" />
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ position: 'relative', padding: '8rem 2rem', overflow: 'hidden', textAlign: 'center' }}>
        <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663413300520/DGyYNygOEkAmMcmQ.jpg" alt="Miami skyline from yacht"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.15 }} />
        <div style={{ position: 'relative', zIndex: 2, maxWidth: '600px', margin: '0 auto' }}>
          <p style={{ fontSize: '0.65rem', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#c9a84c', fontWeight: 500, marginBottom: '1.5rem' }}>Start Booking</p>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(2.5rem,5vw,4.5rem)', fontWeight: 300, color: '#f0ede8', lineHeight: 1.1, marginBottom: '1.5rem' }}>
            Your Next Gig<br /><em style={{ color: '#c9a84c' }}>Is Already Here</em>
          </h2>
          <p style={{ color: 'rgba(240,237,232,0.55)', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '2.5rem' }}>
            50+ artists are already booking through Gigxo. Join free, browse leads instantly, and unlock direct contact from $7. No commission. No booking fees. Ever.
          </p>
          <Link href="/signup">
            <button style={{ background: 'linear-gradient(135deg,#c9a84c,#e8c97a)', color: '#1c1c2e', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.8rem', padding: '1rem 2.5rem', borderRadius: '2px', border: 'none', cursor: 'pointer' }}>
              Get Access Free
            </button>
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
