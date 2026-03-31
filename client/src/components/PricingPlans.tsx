import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight } from "lucide-react";

export const PRICING_PLANS = [
  {
    name: "Pay as you go",
    price: "$3 / $7 / $15",
    description: "per lead",
    badge: null as string | null,
    features: [
      "$3 discovery leads",
      "$7 standard leads",
      "$15 premium leads",
      "Unlock only what you need",
      "No subscription",
    ],
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
      "15 leads included — any tier, your choice",
      "No commission. No booking fees. Ever.",
      "New leads added daily.",
    ],
    cta: "Go Pro",
    href: "/signup",
    highlighted: true,
  },
] as const;

type PricingPlansProps = {
  /** Dark theme (homepage). False = light footer area */
  variant?: "dark" | "light";
  showFooterNote?: boolean;
};

export function PricingPlans({ variant = "dark", showFooterNote = true }: PricingPlansProps) {
  const isDark = variant === "dark";
  const textMuted = isDark ? "text-slate-300" : "text-slate-600";
  const textBody = isDark ? "text-slate-300" : "text-slate-700";

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="flex flex-col md:flex-row justify-center items-stretch gap-8 md:gap-10">
        {PRICING_PLANS.map((plan, i) => (
          <div
            key={i}
            className={`relative flex-1 min-w-0 max-w-md mx-auto rounded-2xl px-8 py-8 shadow-lg transition-shadow ${
              plan.highlighted
                ? isDark
                  ? "bg-gradient-to-br from-purple-600/25 to-pink-600/20 shadow-purple-900/30 ring-1 ring-purple-400/30"
                  : "bg-gradient-to-br from-purple-50 to-pink-50 shadow-md ring-1 ring-purple-200/60"
                : isDark
                  ? "bg-slate-800/50 shadow-slate-950/40"
                  : "bg-slate-50/90 shadow-slate-200/50"
            }`}
          >
            {plan.badge && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap shadow-sm">
                {plan.badge}
              </span>
            )}
            <h3 className={`text-2xl font-bold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>{plan.name}</h3>
            <div className="mb-6">
              <span className={`text-4xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{plan.price}</span>
              <span className={`ml-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>{plan.description}</span>
            </div>
            <ul className="space-y-3 mb-8">
              {plan.features.map((feature, j) => (
                <li key={j} className={`flex items-start gap-2 ${textBody} text-sm`}>
                  <CheckCircle2 className={`w-4 h-4 mt-0.5 flex-shrink-0 ${plan.highlighted ? "text-purple-400" : "text-purple-500"}`} />
                  {feature}
                </li>
              ))}
            </ul>
            <Link href={plan.href}>
              <Button
                className={`w-full ${
                  plan.highlighted
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                    : isDark
                      ? "bg-slate-700 hover:bg-slate-600 text-white"
                      : "bg-slate-900 hover:bg-slate-800 text-white"
                }`}
              >
                {plan.cta} <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
        ))}
      </div>
      {showFooterNote && (
        <p className={`text-center text-sm mt-10 max-w-xl mx-auto ${textMuted}`}>
          All plans include access to curated gig leads for Miami and Fort Lauderdale. No commission on bookings. Lead
          tiers are set by budget and intent — you always see the unlock price before paying.
        </p>
      )}
    </div>
  );
}
