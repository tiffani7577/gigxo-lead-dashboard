import { Link } from "wouter";
import { SiteFooter } from "@/components/SiteFooter";
import { PricingPlans } from "@/components/PricingPlans";
import { Helmet } from "react-helmet-async";
import { canonicalUrlForPathname, DEFAULT_OG_IMAGE } from "@/lib/meta-tags";

export default function Pricing() {
  const title = "Gigxo Pricing | DJ & Performer Gig Leads — Pay As You Go or Pro";
  const description =
    "Simple Gigxo pricing: discovery leads $3, standard $7, premium $15 — or Pro $49/month for 15 leads any tier. No commission, no booking fees. Curated Miami & Fort Lauderdale gigs.";
  const url = canonicalUrlForPathname("/pricing");

  return (
    <div style={{ minHeight: '100vh', background: '#f9f7f4' }}>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:image" content={DEFAULT_OG_IMAGE} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={DEFAULT_OG_IMAGE} />
      </Helmet>

      {/* Nav */}
      <nav style={{ borderBottom: '1px solid rgba(201,168,76,0.15)', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect width="28" height="28" rx="4" fill="#c9a84c" fillOpacity="0.12"/>
                <path d="M4 18 Q7 10 10 14 Q13 18 16 10 Q19 2 22 10 Q24 15 26 12" stroke="#c9a84c" strokeWidth="2" strokeLinecap="round" fill="none"/>
              </svg>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#1c1c2e' }}>
                Gig<span style={{ color: '#c9a84c' }}>XO</span>
              </span>
            </div>
          </Link>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Link href="/login">
              <button style={{ padding: '0.5rem 1.25rem', border: '1px solid rgba(201,168,76,0.4)', background: 'transparent', color: '#c9a84c', borderRadius: '2px', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Sign In
              </button>
            </Link>
            <Link href="/signup">
              <button style={{ padding: '0.5rem 1.25rem', background: 'linear-gradient(135deg,#c9a84c,#e8c97a)', color: '#1c1c2e', borderRadius: '2px', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', border: 'none', cursor: 'pointer' }}>
                Get Access
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: '5rem 1.5rem 3rem', textAlign: 'center' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ display: 'inline-block', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: '2px', padding: '0.35rem 1rem', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c9a84c', marginBottom: '1.5rem' }}>
            Transparent Pricing
          </div>
          <h1 style={{ fontSize: 'clamp(2.2rem,5vw,3.5rem)', fontWeight: 900, color: '#1c1c2e', lineHeight: 1.1, marginBottom: '1.25rem', letterSpacing: '-0.02em' }}>
            Pay only for the<br /><span style={{ color: '#c9a84c' }}>leads you want</span>
          </h1>
          <p style={{ fontSize: '1.1rem', color: '#6b6860', lineHeight: 1.7, maxWidth: '560px', margin: '0 auto' }}>
            Discovery leads $3 · Standard $7 · Premium $15 — or go Pro at $49/month for 15 leads any tier.
            No commission. No booking fees. Ever.
          </p>
        </div>
      </section>

      <section style={{ padding: '2rem 1.5rem 6rem' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <PricingPlans variant="light" />
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
