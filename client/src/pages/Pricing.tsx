import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Music } from "lucide-react";
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
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
      <nav className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <Music className="w-8 h-8 text-purple-500" />
              <span className="text-2xl font-bold text-white">Gigxo</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="outline" className="border-purple-500 text-purple-400 hover:bg-purple-500/10">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                Sign Up Free
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <section className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Gigxo pricing for gig leads</h1>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              The performer lead marketplace powered by better intelligence. Discovery leads $3, Standard $7, Premium
              $15 — or go Pro: $49/month, 15 leads any tier, no commission or booking fees, new leads daily.
            </p>
          </div>

          <PricingPlans variant="dark" />
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
