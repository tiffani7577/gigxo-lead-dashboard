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
  variant?: "dark" | "light";
  showFooterNote?: boolean;
};

export function PricingPlans({ variant = "light", showFooterNote = true }: PricingPlansProps) {
  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 items-stretch gap-6">
        {PRICING_PLANS.map((plan, i) => (
          <div
            key={i}
            className="relative h-full rounded-2xl px-6 py-7 shadow-lg transition-shadow flex flex-col"
            style={plan.highlighted
              ? { background: '#fef9ec', border: '2px solid #c9a84c', boxShadow: '0 8px 30px rgba(201,168,76,0.15)' }
              : { background: '#ffffff', border: '1px solid #e8e4dc', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }
            }
          >
            {plan.badge && (
              <span
                className="absolute -top-3 left-1/2 -translate-x-1/2 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap shadow-sm"
                style={{ background: '#22c55e' }}
              >
                {plan.badge}
              </span>
            )}
            <h3 className="text-2xl font-bold mb-2" style={{ color: '#1c1c2e' }}>{plan.name}</h3>
            <div className="mb-6">
              <span className="text-4xl font-bold" style={{ color: '#c9a84c' }}>{plan.price}</span>
              <span className="ml-2" style={{ color: '#6b6860' }}>{plan.description}</span>
            </div>
            {plan.name === "Pro" && (
              <p className="text-sm font-medium mb-4" style={{ color: '#b8963e' }}>
                Pays for itself with one booking
              </p>
            )}
            <ul className="space-y-3 mb-8 flex-1">
              {plan.features.map((feature, j) => (
                <li key={j} className="flex items-start gap-2 text-sm" style={{ color: '#3d3d55' }}>
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#c9a84c' }} />
                  {feature}
                </li>
              ))}
            </ul>
            <Link href={plan.href}>
              <Button
                className="w-full font-bold"
                style={plan.highlighted
                  ? { background: '#c9a84c', color: '#1c1c2e' }
                  : { background: '#1c1c2e', color: '#ffffff' }
                }
              >
                {plan.cta} <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
        ))}
      </div>
      {showFooterNote && (
        <p className="text-center text-sm mt-10 max-w-xl mx-auto" style={{ color: '#6b6860' }}>
          Clear unlock options: Discovery $3, Standard $7, Premium $15, or Pro at $49/month for 15 leads in any tier.
        </p>
      )}
    </div>
  );
}
