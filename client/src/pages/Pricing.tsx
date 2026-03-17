import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Music, ArrowRight } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";

export default function Pricing() {
  const plans = [
    {
      name: "Pay as you go",
      price: "$3 / $7 / $15",
      description: "per lead",
      badge: null as string | null,
      features: ["$3 discovery leads", "$7 standard leads", "$15 premium leads", "Unlock only what you need", "No subscription"],
      cta: "Browse Gigs",
      href: "/signup",
      highlighted: false,
    },
    {
      name: "Pro",
      price: "$49",
      description: "/month",
      badge: "Best value",
      features: [
        "$35/month in lead credit included (5×$7)",
        "Use your balance or pay per lead",
        "Cancel anytime",
        "South Florida focus",
      ],
      cta: "Go Pro",
      href: "/signup",
      highlighted: true,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
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
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Pricing</h1>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              The performer lead marketplace powered by better intelligence. Discovery leads $3, Standard $7, Premium $15 — or go Pro and get $35/month in lead credit.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
            {plans.map((plan, i) => (
              <Card
                key={i}
                className={`p-8 relative ${
                  plan.highlighted
                    ? "bg-gradient-to-br from-purple-600/20 to-pink-600/20 border-purple-500/50"
                    : "bg-slate-800/50 border-slate-700"
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                    {plan.badge}
                  </span>
                )}
                <h2 className="text-2xl font-bold text-white mb-2">{plan.name}</h2>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  <span className="text-slate-400 ml-2">{plan.description}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-2 text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-purple-400 flex-shrink-0" />
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
                    {plan.cta} <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
              </Card>
            ))}
          </div>

          <div className="max-w-2xl mx-auto text-center">
            <p className="text-slate-400 text-sm">
              All plans include access to curated gig leads for Miami and Fort Lauderdale. No commission on bookings. Lead tiers (standard vs premium) are set by budget and intent — you always see the unlock price before paying.
            </p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
