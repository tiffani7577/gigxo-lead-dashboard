import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, CheckCircle2, Zap, Users, TrendingUp, Music, MapPin, Calendar, Lock, Sparkles } from "lucide-react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

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
      <section className="py-20 bg-slate-800/30 border-t border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-3">Featured Gigs</h2>
            <p className="text-slate-400">Top paying opportunities available right now</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 animate-pulse">
                <div className="h-4 bg-slate-700 rounded mb-3 w-3/4" />
                <div className="h-3 bg-slate-700 rounded mb-2 w-1/2" />
                <div className="h-3 bg-slate-700 rounded mb-6 w-2/3" />
                <div className="h-8 bg-slate-700 rounded" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!leads || leads.length === 0) return null;

  return (
    <section className="py-20 bg-slate-800/30 border-t border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-full mb-4">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-semibold text-yellow-400">Live Opportunities</span>
          </div>
          <h2 className="text-4xl font-bold text-white mb-3">Featured Gigs This Week</h2>
          <p className="text-slate-400 max-w-xl mx-auto">The highest-paying leads currently available on the platform. Sign up to unlock contact info and book directly.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {leads.map((lead) => (
            <Card key={lead.id} className="bg-slate-900 border-slate-700 hover:border-purple-500/50 transition-all duration-200 overflow-hidden group">
              {/* Budget badge */}
              <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-b border-slate-700 px-5 py-3 flex items-center justify-between">
                <span className="text-2xl font-bold text-white">{formatBudget(lead.budget)}</span>
                {lead.performerType && (
                  <span className="text-xs font-medium bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full">
                    {PERFORMER_LABELS[lead.performerType] ?? lead.performerType}
                  </span>
                )}
              </div>

              <div className="p-5 space-y-3">
                <h3 className="font-semibold text-white text-lg leading-tight">{lead.title}</h3>

                <div className="flex items-center gap-1.5 text-sm text-slate-400">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{lead.location}</span>
                </div>

                {lead.eventDate && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-400">
                    <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{new Date(lead.eventDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  </div>
                )}

                {lead.description && (
                  <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">{lead.description}</p>
                )}

                {/* Blurred contact teaser */}
                <div className="pt-2 border-t border-slate-700">
                  <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Contact info locked
                  </p>
                  <div className="space-y-1.5">
                    <div className="h-3 bg-slate-700 rounded blur-[2px] opacity-60 w-3/4" />
                    <div className="h-3 bg-slate-700 rounded blur-[2px] opacity-60 w-1/2" />
                  </div>
                </div>
              </div>

              <div className="px-5 pb-5">
                <Link href="/signup">
                  <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-sm">
                    <Lock className="w-3.5 h-3.5 mr-2" /> Unlock for ${lead.unlockPriceCents ? (lead.unlockPriceCents / 100).toFixed(0) : "7"}
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <Link href="/signup">
            <Button variant="outline" size="lg" className="border-slate-600 text-slate-300 hover:bg-slate-700">
              See All Available Gigs <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  // If authenticated, redirect to dashboard (must be in useEffect, not render)
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, user, navigate]);

  if (isAuthenticated && user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="w-8 h-8 text-purple-500" />
            <span className="text-2xl font-bold text-white">Gigxo</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/artists">
              <Button variant="ghost" className="text-slate-300 hover:text-white hidden sm:inline-flex">
                Browse Artists
              </Button>
            </Link>
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

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: Hero Text */}
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="inline-block px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-full">
                  <p className="text-sm font-semibold text-purple-400">🎵 Founded by artists, for artists</p>
                </div>
                <h1 className="text-5xl sm:text-6xl font-bold text-white leading-tight">
                  Find Your Next <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Gig</span>
                </h1>
                <p className="text-xl text-slate-300">
                  Book DJs, bands, and performers across South Florida. Discover verified gig opportunities matched to your style, location, and budget. $7 per lead. No commission.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/signup">
                  <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white w-full sm:w-auto">
                    Get Started Free <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
                <Button asChild variant="outline" size="lg" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                  <a href="#how-it-works">Learn More</a>
                </Button>
              </div>

              {/* Social Proof */}
              <div className="pt-4 border-t border-slate-700">
                <p className="text-sm text-slate-400 mb-3">Trusted by artists across South Florida — Miami, Fort Lauderdale, Boca, West Palm</p>
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 border-2 border-slate-900" />
                    ))}
                  </div>
                  <p className="text-sm text-slate-300">
                    <span className="font-semibold text-white">50+</span> artists already booking
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Feature Cards */}
            <div className="space-y-4">
              <Card className="bg-slate-800/50 border-slate-700 p-6 hover:border-purple-500/50 transition-colors">
                <div className="flex gap-4">
                  <Zap className="w-6 h-6 text-purple-400 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-white mb-2">AI-Matched Gigs</h3>
                    <p className="text-sm text-slate-300">Only see opportunities that match your style, location, and budget</p>
                  </div>
                </div>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700 p-6 hover:border-purple-500/50 transition-colors">
                <div className="flex gap-4">
                  <CheckCircle2 className="w-6 h-6 text-purple-400 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-white mb-2">Verified Opportunities</h3>
                    <p className="text-sm text-slate-300">Every gig is curated and verified by our team. No spam, no scams</p>
                  </div>
                </div>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700 p-6 hover:border-purple-500/50 transition-colors">
                <div className="flex gap-4">
                  <Users className="w-6 h-6 text-purple-400 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-white mb-2">Community First</h3>
                    <p className="text-sm text-slate-300">Connect with other artists, share experiences, and grow together</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-slate-800/50 border-t border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">How Gigxo Works</h2>
            <p className="text-lg text-slate-300">Three simple steps to your next gig</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Create Your Profile",
                description: "Tell us your genres, location, and what you're looking for. We'll match you with the perfect gigs.",
                icon: Music,
              },
              {
                step: "2",
                title: "Browse Matched Gigs",
                description: "See gigs that match your profile. View details, budget, and location—all for free.",
                icon: TrendingUp,
              },
              {
                step: "3",
                title: "Unlock & Book",
                description: "Pay $7 to unlock contact info and book directly. No middleman, no commission.",
                icon: CheckCircle2,
              },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="relative">
                  <Card className="bg-slate-900 border-slate-700 p-8 h-full">
                    <div className="absolute -top-4 -left-4 w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white font-bold">
                      {item.step}
                    </div>
                    <Icon className="w-8 h-8 text-purple-400 mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-3">{item.title}</h3>
                    <p className="text-slate-300">{item.description}</p>
                  </Card>
                  {i < 2 && (
                    <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-purple-500 to-transparent" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Featured Leads */}
      <FeaturedLeads />

      {/* Pricing */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Simple, Transparent Pricing</h2>
            <p className="text-lg text-slate-300">No hidden fees. No commission. Just pure value.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              {
                name: "Single Lead",
                price: "$7",
                description: "per unlock",
                badge: null as string | null,
                features: ["Unlock contact info", "Direct booking", "No commission", "First unlock just $1"],
                cta: "Get Started",
                href: "/signup",
                highlighted: false,
              },
              {
                name: "10-Pack",
                price: "$49",
                description: "10 unlocks",
                badge: "Save $21" as string | null,
                features: ["10 lead unlocks", "$4.90 per lead", "Use anytime", "Never expires"],
                cta: "Buy 10-Pack",
                href: "/signup",
                highlighted: true,
              },
              {
                name: "25-Pack",
                price: "$99",
                description: "25 unlocks",
                badge: "Save $76" as string | null,
                features: ["25 lead unlocks", "$3.96 per lead", "Use anytime", "Never expires"],
                cta: "Buy 25-Pack",
                href: "/signup",
                highlighted: false,
              },
            ].map((plan, i) => (
              <Card
                key={i}
                className={`p-8 relative ${
                  plan.highlighted
                    ? "bg-gradient-to-br from-purple-600/20 to-pink-600/20 border-purple-500/50"
                    : "bg-slate-800/50 border-slate-700"
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">{plan.badge}</span>
                )}
                <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  <span className="text-slate-400 ml-2">{plan.description}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-2 text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-purple-400" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link href={plan.href}>
                  <Button
                    className={`w-full ${
                      plan.highlighted
                        ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                        : "bg-slate-700 hover:bg-slate-600"
                    }`}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-20 border-t border-slate-700 bg-gradient-to-r from-purple-600/10 to-pink-600/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">Ready to Find Your Next Gig?</h2>
          <p className="text-lg text-slate-300 mb-8">
            Join 50+ artists already booking through Gigxo. Your first unlock is just $1 — try it risk-free.
          </p>
          <Link href="/signup">
            <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white">
              Sign Up Now <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-700 bg-slate-900/50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-400 text-sm">
          <p>© 2026 Gigxo. Founded by artists, for artists.</p>
        </div>
      </footer>
    </div>
  );
}
