import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight } from "lucide-react";

export const PRICING_PLANS = [
  {
    name: "Discovery",
    price: "$3",
    description: "per lead",
    badge: null as string | null,
    features: [
      "Get the post link",
      "See the original listing source",
      "Best for quick lead checks",
    ],
    cta: "Start with Discovery",
    href: "/signup",
    highlighted: false,
  },
  {
    name: "Standard",
    price: "$7",
    description: "per lead",
    badge: null as string | null,
    features: [
      "Get partial contact info",
      "Faster outreach than Discovery",
      "Great for consistent booking flow",
    ],
    cta: "Unlock Standard Leads",
    href: "/signup",
    highlighted: false,
  },
  {
    name: "Premium",
    price: "$15",
    description: "per lead",
    badge: null as string | null,
    features: [
      "Get direct email and phone",
      "Contact decision-makers directly",
      "Highest-intent lead access",
    ],
    cta: "Unlock Premium Leads",
    href: "/signup",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$49",
    description: "/month",
    badge: "Best value",
    features: [
      "15 leads included each month (any tier)",
      "Pays for itself with one booking",
      "vs paying $3-$15 per lead every time",
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
    <div className="w-full max-w-6xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 items-stretch gap-6">
        {PRICING_PLANS.map((plan, i) => (
          <div
            key={i}
            className={`relative h-full rounded-2xl px-6 py-7 shadow-lg transition-shadow flex flex-col ${
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
            {plan.name === "Pro" && (
              <p className={`text-sm font-medium mb-4 ${isDark ? "text-purple-200" : "text-purple-700"}`}>
                Pays for itself with one booking
              </p>
            )}
            <ul className="space-y-3 mb-8 flex-1">
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
          Clear unlock options: Discovery $3, Standard $7, Premium $15, or Pro at $49/month for 15 leads in any tier.
        </p>
      )}
    </div>
  );
}
