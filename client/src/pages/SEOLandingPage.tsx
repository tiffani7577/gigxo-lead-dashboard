import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { generateAllPageConfigs, generatePageConfig, parseSlug } from "@/lib/seoConfig";
import { DEFAULT_OG_IMAGE } from "@/lib/meta-tags";

/** Production canonical origin — always https://www.gigxo.com (never http, never bare domain). */
const SEO_PUBLIC_ORIGIN = "https://www.gigxo.com";
import { MapPin, Music, ChevronRight } from "lucide-react";
import { Helmet } from "react-helmet-async";
import NotFound from "@/pages/NotFound";
import { SiteFooter } from "@/components/SiteFooter";

interface FormData {
  eventType: "wedding" | "party" | "birthday" | "corporate" | "other";
  date: string;
  city: string;
  budget: string;
  description: string;
  name: string;
  email: string;
  phone: string;
  // Yacht calculator fields (used when calculatorVariant === "yachtCost")
  durationHours?: string;
  guestCount?: string;
  yachtEventType?: string;
  // Boat entertainment package fields (calculatorVariant === "boatEntertainment")
  packageType?: "dj_only" | "dj_sax" | "dj_percussion";
  batteryPowered?: boolean;
  compactSetup?: boolean;
}

interface SEOLandingPageProps {
  params?: { slug?: string; city?: string };
}

/** Turn "/dj-fort-lauderdale" into readable link text e.g. "DJ Fort Lauderdale". */
function formatInternalLinkLabel(path: string): string {
  const segment = path.replace(/^\//, "");
  return segment
    .split("-")
    .map((word) => {
      const lower = word.toLowerCase();
      if (lower === "dj") return "DJ";
      if (lower === "mc") return "MC";
      if (/^\d+$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function toTitleCaseFromSlug(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((word) => {
      if (word.toLowerCase() === "dj") return "DJ";
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function buildExpandedSeoContent(args: { baseContent: string; serviceName: string; cityName: string }) {
  const { baseContent, serviceName, cityName } = args;
  return [
    `${baseContent} If you are searching for ${serviceName.toLowerCase()} in ${cityName}, focus on performers with proven experience in the exact type of event you are planning. A wedding reception, private birthday, corporate activation, and nightclub booking each require different pacing, music selection, and technical setup. The best results come from sharing your date range, guest profile, desired energy level, and must-play genres early. When you provide this information up front, the match process is faster and you avoid back-and-forth with providers who are not aligned with your goals.`,
    `${cityName} events also have local factors that influence who you should hire and how you should budget. Venue rules, load-in windows, neighborhood noise policies, parking access, and weather backup plans can all affect execution quality. Experienced local talent plans around these details before event day, including setup timing, sound checks, and contingency options for outdoor spaces. This is especially important for waterfront venues, rooftop locations, and multi-room properties where audio coverage and transitions need careful coordination.`,
    `When comparing options, ask practical questions beyond price: what is included in the package, how many hours are covered, what equipment is provided, and what overtime policy applies. Review recent performance clips, event photos, and references from similar events in ${cityName}. Clear communication on arrival time, announcements, song preferences, and timeline checkpoints can make the difference between a smooth event and a stressful one. Strong ${serviceName.toLowerCase()} providers also confirm backup plans for equipment and staffing so your event remains protected if conditions change.`,
    `A smart booking process balances value and confidence. Set a realistic budget, define non-negotiables, and prioritize responsiveness during outreach. In most cases, the right fit is the provider who understands your audience, communicates clearly, and can execute consistently under real event conditions. If you are planning an event in ${cityName}, use this page to compare options, ask better questions, and shortlist ${serviceName.toLowerCase()} professionals who can deliver the experience you want.`,
  ].join("\n\n");
}

function buildDefaultSeoFaq(serviceName: string, cityName: string) {
  return [
    {
      question: `How much does ${serviceName.toLowerCase()} cost in ${cityName}?`,
      answer: `Pricing in ${cityName} depends on event type, duration, date, setup complexity, and demand. Ask for a detailed quote that breaks out performance time, equipment, travel, and any add-ons so you can compare options accurately.`,
    },
    {
      question: `Where can I find reliable ${serviceName.toLowerCase()} in ${cityName}?`,
      answer: `Start with providers who have local event history, recent media, and clear communication. Prioritize professionals who can share references for events similar to yours in ${cityName}.`,
    },
    {
      question: `How far in advance should I book ${serviceName.toLowerCase()} in ${cityName}?`,
      answer: `For peak dates, book as early as possible. Weddings and major weekends can fill quickly, while weekday or off-season events may have more flexibility.`,
    },
    {
      question: `What should be included in a ${serviceName.toLowerCase()} quote in ${cityName}?`,
      answer: `A complete quote should list coverage hours, equipment, setup and teardown, travel, overtime rates, and any special production needs for your venue.`,
    },
    {
      question: `What details help me get better ${serviceName.toLowerCase()} matches in ${cityName}?`,
      answer: `Share your event date, venue, guest count, timeline, style preferences, and budget range. The more specific your brief, the easier it is to match you with the right options.`,
    },
  ];
}

export default function SEOLandingPage({ params }: SEOLandingPageProps) {
  const [locationPath] = useLocation();
  const pathOnly = (locationPath.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  const slug =
    params?.slug?.trim() ||
    (() => {
      const segs = pathOnly.split("/").filter(Boolean);
      if (segs[0] === "av-work" && segs[1]) return `av-work-${segs[1]}`;
      return segs[segs.length - 1] || "";
    })() ||
    "dj-miami";
  /** Self-referencing canonical: pathname from the current URL (e.g. /dj-miami, /av-work/orlando). No trailing slash. */
  const gigxoCanonicalUrl = pathOnly === "/" ? SEO_PUBLIC_ORIGIN : `${SEO_PUBLIC_ORIGIN}${pathOnly}`;

  // Parse slug to get service and city
  const parsed = parseSlug(slug);
  const config = parsed ? generatePageConfig(parsed.serviceId, parsed.cityId) : null;
  // Precompute all SEO configs once for internal linking (also used as fallback for manual-only slugs)
  const allConfigs = generateAllPageConfigs();
  // Fall back to allConfigs for manual-only slugs (e.g. band-miami, corporate-event-band-miami)
  const pageConfig = config ?? allConfigs[slug] ?? null;

  const isHirePage = pageConfig?.pageType === "hire";
  const isVenuePage = pageConfig?.pageType === "venue";
  const isHireLikePage = isHirePage || isVenuePage;
  const isBoatContextPage = slug.startsWith("yacht-dj-") || slug.includes("marina") || slug.includes("yacht");
  const isYachtHirePage = isHirePage && slug.startsWith("yacht-dj-");

  // Smarter default event type for yacht/venue pages based on slug + config
  const inferredEventType: FormData["eventType"] =
    slug.includes("wedding")
      ? "wedding"
      : slug.includes("corporate")
      ? "corporate"
      : (pageConfig?.defaultEventType as "wedding" | "party" | "birthday" | "corporate" | "other") || "party";

  const [formData, setFormData] = useState<FormData>({
    eventType: inferredEventType,
    date: "",
    city: pageConfig?.defaultCity || "Miami, FL",
    budget: "",
    description: "",
    name: "",
    email: "",
    phone: "",
    durationHours: "",
    guestCount: "",
    yachtEventType: "",
    packageType: "dj_only",
    batteryPowered: false,
    compactSetup: true,
  });

  const submitEventRequest = trpc.inbound.submitEventRequest.useMutation();
  const { data: artistsData } = trpc.directory.searchArtists.useQuery(
    isHireLikePage
      ? {
          // Use the default city string for location filter (e.g. "Miami, FL")
          location: pageConfig?.defaultCity ?? "Miami, FL",
          limit: 24,
          offset: 0,
        }
      : // Avoid unnecessary query on pure calculator/info pages
        {
          limit: 0,
          offset: 0,
        },
  );
  const { data: leadsSummary } = trpc.leads.getPublicSummary.useQuery(
    pageConfig?.defaultCity
      ? { location: pageConfig.defaultCity, serviceHint: parsed?.serviceId?.includes("dj") ? "dj" : parsed?.serviceId?.includes("band") ? "band" : undefined }
      : { location: "", serviceHint: "" },
    { enabled: !!pageConfig?.defaultCity }
  );

  const hireArtists = (artistsData?.artists ?? []).filter((artist: any) => {
    if (!isBoatContextPage) return true;
    const genres = (artist.genres as string[]) ?? [];
    return genres.some((g) => /yacht|boat|marina/i.test(g));
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Build a richer description when a calculator variant is active
      let finalDescription = formData.description;
      if (pageConfig?.calculatorVariant === "yachtCost") {
        const parts: string[] = [];
        if (formData.durationHours) parts.push(`Duration: ${formData.durationHours} hours`);
        if (formData.guestCount) parts.push(`Guests: ${formData.guestCount}`);
        if (formData.yachtEventType) parts.push(`Yacht event type: ${formData.yachtEventType}`);
        if (formData.city) parts.push(`Primary city: ${formData.city}`);
        const calcSummary = parts.length ? `\n\nYacht DJ cost calculator:\n- ${parts.join("\n- ")}` : "";
        finalDescription = `${formData.description || "Yacht DJ cost request"}${calcSummary}`;
      } else if (pageConfig?.calculatorVariant === "boatEntertainment") {
        const parts: string[] = [];
        if (formData.packageType) {
          const label =
            formData.packageType === "dj_only"
              ? "DJ only"
              : formData.packageType === "dj_sax"
              ? "DJ + sax"
              : "DJ + percussion";
          parts.push(`Package: ${label}`);
        }
        parts.push(`Battery-powered setup: ${formData.batteryPowered ? "Yes" : "No"}`);
        parts.push(`Compact setup preferred: ${formData.compactSetup ? "Yes" : "No"}`);
        if (formData.city) parts.push(`Primary city: ${formData.city}`);
        const calcSummary = `\n\nBoat entertainment package builder:\n- ${parts.join("\n- ")}`;
        finalDescription = `${formData.description || "Boat entertainment package request"}${calcSummary}`;
      }

      // Ensure eventDate is a full ISO datetime string for Zod
      const eventDateIso =
        formData.date && formData.date.trim().length > 0
          ? new Date(`${formData.date}T00:00:00`).toISOString()
          : new Date().toISOString();

      await submitEventRequest.mutateAsync({
        eventType: formData.eventType,
        eventDate: eventDateIso,
        city: formData.city,
        budget: formData.budget ? parseInt(formData.budget) : undefined,
        description: finalDescription,
        contactName: formData.name,
        contactEmail: formData.email,
        contactPhone: formData.phone.trim() || undefined,
        pageSlug: slug,
      });
      setSubmitted(true);
      setTimeout(() => {
        setFormData({
          eventType: (pageConfig?.defaultEventType as "wedding" | "party" | "birthday" | "corporate" | "other") || "party",
          date: "",
          city: pageConfig?.defaultCity ?? "Miami, FL",
          budget: "",
          description: "",
          name: "",
          email: "",
          phone: "",
          durationHours: "",
          guestCount: "",
          yachtEventType: "",
          packageType: "dj_only",
          batteryPowered: false,
          compactSetup: true,
        });
        setSubmitted(false);
      }, 3000);
    } catch (error) {
      console.error("Error submitting form:", error);
    }
  };

  if (!pageConfig) {
    return <NotFound />;
  }

  // Normalize optional config so undefined never crashes render
  const heading = pageConfig.heading ?? "";
  const subheading = pageConfig.subheading ?? "";
  const content = pageConfig.content ?? "";
  const defaultCity = pageConfig.defaultCity ?? "Miami, FL";
  const seoTitle = pageConfig.seoTitle ?? heading;
  const seoDescription = pageConfig.seoDescription ?? "";
  const seoH1 = pageConfig.seoH1 ?? heading;
  const calculatorVariant = pageConfig.calculatorVariant ?? null;
  const ogImageUrl = pageConfig.ogImage?.trim() || DEFAULT_OG_IMAGE;
  const serviceLabel = parsed?.serviceId?.replace(/-/g, " ") ?? "entertainment";
  const cityLabel = parsed?.cityId?.replace(/-/g, " ") ?? "Florida";
  const cityName = parsed?.cityId ? toTitleCaseFromSlug(parsed.cityId) : defaultCity;
  const serviceName = parsed?.serviceId ? toTitleCaseFromSlug(parsed.serviceId) : "Entertainment Services";
  const expandedContent = buildExpandedSeoContent({
    baseContent: content,
    serviceName,
    cityName,
  });
  const faqItems = (Array.isArray(pageConfig.faq) ? pageConfig.faq : [])
    .slice(0, 5)
    .concat(buildDefaultSeoFaq(serviceName, cityName))
    .slice(0, 5);

  // Internal linking helpers (match by serviceId + "-" + cityId so multi-part slugs work)
  const relatedLinks = (() => {
    if (!parsed) return { otherCities: [] as string[], relatedServices: [] as string[] };
    const { serviceId, cityId } = parsed;
    const currentSlug = `${serviceId}-${cityId}`;
    const otherCities: string[] = [];
    const relatedServices: string[] = [];

    Object.keys(allConfigs).forEach((key) => {
      if (key === currentSlug) return;
      if (key.startsWith(serviceId + "-")) otherCities.push(`/${key}`);
      else if (key.endsWith("-" + cityId)) relatedServices.push(`/${key}`);
    });

    return { otherCities, relatedServices };
  })();

  // JSON-LD: Service + BreadcrumbList only. FAQPage must NOT be pushed here — it is emitted once inside the FAQ <section> below (avoids duplicate FAQPage).
  const jsonLdScripts: string[] = [];
  try {
    jsonLdScripts.push(
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Service",
        name: heading,
        description: seoDescription,
        areaServed: {
          "@type": "City",
          name: defaultCity,
        },
        offers: {
          "@type": "Offer",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
          url: gigxoCanonicalUrl,
          name: isYachtHirePage ? "Yacht DJ hire in Miami" : heading,
        },
      }),
    );
    jsonLdScripts.push(
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: SEO_PUBLIC_ORIGIN,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: seoH1,
            item: gigxoCanonicalUrl,
          },
        ],
      }),
    );
  } catch {
    // Swallow JSON-LD errors; never crash page rendering
  }

  try {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Helmet>
          <title>{seoTitle}</title>
          <meta name="description" content={seoDescription} />
          <meta name="robots" content="index, follow" />
          <link rel="canonical" href={gigxoCanonicalUrl} />
          <meta property="og:title" content={seoTitle} />
          <meta property="og:description" content={seoDescription} />
          <meta property="og:url" content={gigxoCanonicalUrl} />
          <meta property="og:image" content={ogImageUrl} />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={seoTitle} />
          <meta name="twitter:description" content={seoDescription} />
          <meta name="twitter:image" content={ogImageUrl} />
        </Helmet>
        {/* JSON-LD scripts */}
        <div className="hidden">
          {jsonLdScripts
            .filter((script) => !script.includes('"@type":"FAQPage"'))
            .map((script, idx) => (
              <script key={idx} type="application/ld+json" dangerouslySetInnerHTML={{ __html: script }} />
            ))}
        </div>
      {/* Hero Section */}
        <section style={{ position: 'relative', minHeight: '70vh', display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
          <img
            src="/images/hero_v2_night.jpg"
            alt={`${cityName} DJ`}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(8,8,8,0.2) 0%, rgba(8,8,8,0.75) 70%, rgba(8,8,8,1) 100%)' }} />
          <div style={{ position: 'relative', zIndex: 2, padding: '0 4rem 4rem', maxWidth: 860 }}>
            <p className="section-label" style={{ marginBottom: '1rem' }}>
              {cityName} · South Florida
            </p>
            <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(2.5rem,6vw,4.5rem)', fontWeight: 300, lineHeight: 1.1, margin: '0 0 1rem' }}>{seoH1}</h1>
            <p style={{ fontSize: '1rem', color: 'rgba(240,237,232,0.7)', maxWidth: 520, lineHeight: 1.7 }}>
              Connect with verified private event leads in {cityName} — no middlemen, no commissions.
            </p>
          </div>
        </section>

        {/* Keyword-rich imagery for SEO (decorative / context) */}
        <div className="max-w-6xl mx-auto px-4 -mt-6 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl overflow-hidden shadow-md ring-1 ring-purple-100">
            <img
              src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663413300520/gBCQOfgDRZNMeqCT.jpg"
              alt={`${seoH1} — DJ and live music for events in ${defaultCity}`}
              className="w-full h-44 sm:h-40 object-cover"
              loading="lazy"
              width={640}
              height={280}
            />
            <img
              src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663413300520/cfKhGCAitiAmvTKa.jpg"
              alt={`${serviceLabel} event entertainment and party booking in ${defaultCity} via Gigxo`}
              className="w-full h-44 sm:h-40 object-cover"
              loading="lazy"
              width={640}
              height={280}
            />
            <img
              src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663413300520/tRkmkWCAeEumIllR.jpg"
              alt={`Wedding and corporate ${serviceLabel} services ${cityLabel} Florida — Gigxo`}
              className="w-full h-44 sm:h-40 object-cover sm:col-span-1"
              loading="lazy"
              width={640}
              height={280}
            />
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="md:col-span-2">
            <Card className="p-8 mb-8">
              <h2 className="text-2xl font-bold mb-4">
                {isHireLikePage ? "About These Performers" : "About This Service"}
              </h2>
              {isHireLikePage && leadsSummary && leadsSummary.count > 0 && (
                <p className="text-sm text-emerald-700 font-medium mb-3">
                  {leadsSummary.count} gig{leadsSummary.count !== 1 ? "s" : ""} in this area right now
                </p>
              )}
              <div className="text-gray-700 mb-4 whitespace-pre-line leading-7">{expandedContent}</div>
              {isBoatContextPage && (
                <p className="text-sm text-gray-600">
                  This page highlights yacht-focused DJs in Miami and nearby marinas. We prioritize performers familiar
                  with compact, boat-safe setups and can match you with battery-powered or low-profile systems when
                  needed.
                </p>
              )}
            </Card>

            <Card className="p-8">
              <h2 className="text-2xl font-bold mb-6">{isHireLikePage ? "How Booking Works" : "How It Works"}</h2>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 text-white rounded-full flex items-center justify-center font-bold" style={{background:'#c9a84c'}}>
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold">Tell us about your event</h3>
                    <p className="text-gray-600">
                      Share your date, location, and what you&apos;re looking for. Takes under 60 seconds.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 text-white rounded-full flex items-center justify-center font-bold" style={{background:'#c9a84c'}}>
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold">We match you with verified talent</h3>
                    <p className="text-gray-600">
                      We surface the best-fit performers for your city and event type — all vetted, all real.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 text-white rounded-full flex items-center justify-center font-bold" style={{background:'#c9a84c'}}>
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold">Book direct, pay nothing extra</h3>
                    <p className="text-gray-600">
                      Connect directly with your performer. No booking fees, no commission — ever.
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* FAQ section — always render 5 search-style questions */}
            {faqItems.length > 0 && (() => {
              try {
                const faqSchema = JSON.stringify({
                  "@context": "https://schema.org",
                  "@type": "FAQPage",
                  mainEntity: faqItems.map((item) => ({
                    "@type": "Question",
                    name: item.question,
                    acceptedAnswer: {
                      "@type": "Answer",
                      text: item.answer,
                    },
                  })),
                });
                return (
                  <section className="mt-12">
                    <script
                      key={`faq-jsonld-${slug}`}
                      type="application/ld+json"
                      dangerouslySetInnerHTML={{ __html: faqSchema }}
                    />
                    <h2 className="text-2xl font-bold text-slate-900 mb-6">
                      Frequently Asked Questions
                    </h2>
                    <div className="space-y-4">
                      {faqItems.map((item, i) => (
                        <div key={i} className="border border-slate-200 rounded-lg p-5">
                          <h3 className="font-semibold text-slate-900 mb-2">
                            {item.question}
                          </h3>
                          <p className="text-slate-600 text-sm leading-relaxed">
                            {item.answer}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              } catch {
                return null;
              }
            })()}

            {/* Hire / venue-specific performer grid */}
            {isHireLikePage && (
              <Card className="p-8 mt-8">
                <h2 className="text-2xl font-bold mb-4">Featured performers in this city</h2>
                {hireArtists.length === 0 ? (
                  <p className="text-gray-600 text-sm">
                    We&apos;re still onboarding performers for this combination. Submit the quote form and we&apos;ll
                    match you manually.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {hireArtists.map((artist: any) => {
                      const photo = artist.photoUrl || artist.avatarUrl;
                      const profileUrl = artist.slug ? `/artist/${artist.slug}` : null;
                      return (
                        <div
                          key={artist.id}
                          className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm"
                        >
                          <div className="aspect-video bg-slate-100 relative overflow-hidden">
                            {photo ? (
                              <img
                                src={photo}
                                alt={artist.displayName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-100 to-slate-100">
                                <div className="w-14 h-14 rounded-full bg-slate-200 flex items-center justify-center">
                                  <Music className="w-7 h-7 text-slate-500" />
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="p-4">
                            <h3 className="font-semibold text-sm text-slate-900 truncate mb-1">
                              {artist.displayName}
                            </h3>
                            <div className="flex items-center gap-1 text-slate-500 text-xs mb-3">
                              <MapPin className="w-3 h-3" />
                              <span className="truncate">{artist.location}</span>
                            </div>
                            {profileUrl ? (
                              <Link href={profileUrl}>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full border-slate-300 text-slate-700 hover:bg-slate-100 text-xs gap-1"
                                >
                                  View profile <ChevronRight className="w-3 h-3" />
                                </Button>
                              </Link>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled
                                className="w-full border-slate-200 text-slate-400 bg-transparent text-xs"
                              >
                                Profile not public
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            )}

            {/* Internal linking */}
            {(relatedLinks.otherCities.length > 0 || relatedLinks.relatedServices.length > 0) && (
              <Card className="p-6 mt-8">
                <h2 className="text-xl font-bold mb-3">More options</h2>
                <div className="space-y-2 text-sm">
                  {relatedLinks.otherCities.length > 0 && (
                    <div>
                      <p className="font-medium text-slate-800 mb-1">Nearby cities for this service:</p>
                      <div className="flex flex-wrap gap-2">
                        {relatedLinks.otherCities.slice(0, 4).map((path) => (
                          <Link key={path} href={path}>
                            <a className="text-purple-700 hover:text-purple-900 underline text-xs">
                              {formatInternalLinkLabel(path)}
                            </a>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {relatedLinks.relatedServices.length > 0 && (
                    <div>
                      <p className="font-medium text-slate-800 mb-1">Other services in this city:</p>
                      <div className="flex flex-wrap gap-2">
                        {relatedLinks.relatedServices.slice(0, 4).map((path) => (
                          <Link key={path} href={path}>
                            <a className="text-purple-700 hover:text-purple-900 underline text-xs">
                              {formatInternalLinkLabel(path)}
                            </a>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* Lead Capture / Calculator */}
          <div>
            <Card className="p-6 sticky top-4">
              <h2 className="text-xl font-bold mb-4">
                {calculatorVariant === "yachtCost"
                  ? "Yacht DJ pricing calculator"
                  : calculatorVariant === "boatEntertainment"
                  ? "Boat entertainment package builder"
                  : "Tell us about your event"}
              </h2>
              {/* Helpful booking details for yacht / marina / venue pages */}
              {isHireLikePage && isBoatContextPage && (
                <div className="mb-4 rounded-md bg-purple-50 border border-purple-100 px-3 py-2 text-xs text-slate-700">
                  <p className="font-semibold mb-1">Helpful booking details to include:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Marina / departure point (e.g. Bahia Mar, Pier Sixty-Six, Port Everglades)</li>
                    <li>Yacht size or vessel type</li>
                    <li>Approximate guest count</li>
                    <li>Event duration or charter window</li>
                    <li>Power availability (shore power vs. generator)</li>
                    <li>Indoor vs. outdoor deck or mixed layout</li>
                    <li>DJ only vs. DJ + add-ons (sax, percussion, lighting)</li>
                  </ul>
                </div>
              )}
              {submitted ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <p className="text-green-800 font-semibold">✓ Thanks for reaching out!</p>
                  <p className="text-green-700 text-sm">We'll connect you with professionals soon.</p>
                </div>
              ) : (
                <div style={{ background: '#111', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '4px', padding: '2rem', maxWidth: '560px' }}>
                  <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Calculator-specific fields */}
                  {calculatorVariant === "yachtCost" && (
                    <>
                      <div>
                        <label className="block text-sm font-medium mb-1">Duration (hours)</label>
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          value={formData.durationHours || ""}
                          onChange={(e) => setFormData({ ...formData, durationHours: e.target.value })}
                          placeholder="e.g., 4"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Guest count</label>
                        <Input
                          type="number"
                          min={1}
                          max={200}
                          value={formData.guestCount || ""}
                          onChange={(e) => setFormData({ ...formData, guestCount: e.target.value })}
                          placeholder="e.g., 40"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Yacht / boat event type</label>
                        <Input
                          type="text"
                          value={formData.yachtEventType || ""}
                          onChange={(e) => setFormData({ ...formData, yachtEventType: e.target.value })}
                          placeholder="Sunset cruise, birthday, corporate, etc."
                        />
                      </div>
                    </>
                  )}

                  {calculatorVariant === "boatEntertainment" && (
                    <>
                      <div>
                        <label className="block text-sm font-medium mb-1">Entertainment package</label>
                        <Select
                          value={formData.packageType || "dj_only"}
                          onValueChange={(value) =>
                            setFormData({ ...formData, packageType: value as FormData["packageType"] })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dj_only">DJ only</SelectItem>
                            <SelectItem value="dj_sax">DJ + sax</SelectItem>
                            <SelectItem value="dj_percussion">DJ + percussion</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-sm font-medium">Battery-powered setup needed?</label>
                        <Button
                          type="button"
                          variant={formData.batteryPowered ? "default" : "outline"}
                          size="sm"
                          onClick={() => setFormData({ ...formData, batteryPowered: !formData.batteryPowered })}
                        >
                          {formData.batteryPowered ? "Yes" : "No / not sure"}
                        </Button>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-sm font-medium">Compact setup preferred?</label>
                        <Button
                          type="button"
                          variant={formData.compactSetup ? "default" : "outline"}
                          size="sm"
                          onClick={() => setFormData({ ...formData, compactSetup: !formData.compactSetup })}
                        >
                          {formData.compactSetup ? "Yes" : "Standard OK"}
                        </Button>
                      </div>
                    </>
                  )}

                  {/* Core event + contact fields (shared) */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Event Type</label>
                    <Select
                      value={formData.eventType}
                      onValueChange={(value) => setFormData({ ...formData, eventType: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="wedding">Wedding</SelectItem>
                        <SelectItem value="party">Party</SelectItem>
                        <SelectItem value="birthday">Birthday</SelectItem>
                        <SelectItem value="corporate">Corporate</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Event Date</label>
                    <Input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">City</label>
                    <Input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="City, State"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Budget ($)</label>
                    <Input
                      type="number"
                      value={formData.budget}
                      onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                      placeholder="e.g., 1500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Event Description</label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Tell us about your event..."
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Your Name</label>
                    <Input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Your name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="your@email.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Phone Number</label>
                    <Input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="Your phone number"
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn-gold"
                    style={{ width: '100%' }}
                    disabled={submitEventRequest.isPending}
                  >
                    {submitEventRequest.isPending ? "Sending your request..." : pageConfig.leadCTA ?? "Get My Free Quote"}
                  </button>
                  </form>
                </div>
              )}
            </Card>
          </div>
        </div>
        {/* Fort Lauderdale yacht cluster links */}
        {(() => {
          const fortYachtSlugs = [
            "yacht-dj-fort-lauderdale",
            "yacht-dj-cost-miami",
            "yacht-dj-cost-fort-lauderdale",
          ];
          const available = fortYachtSlugs
            .map((s) => ({ slug: s, cfg: allConfigs[s] }))
            .filter((x) => !!x.cfg);
          if (!available.length) return null;
          return (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-base">Fort Lauderdale yacht & marina pages</CardTitle>
                <CardDescription className="text-xs">
                  Jump between Fort Lauderdale yacht hire and yacht DJ pricing pages.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 text-xs">
                {available.map(({ slug }) => (
                  <Link key={slug} href={`/${slug}`}>
                    <a className="px-2 py-1 rounded-full border border-purple-200 text-purple-800 hover:bg-purple-50">
                      {slug.replace(/-/g, " ")}
                    </a>
                  </Link>
                ))}
              </CardContent>
            </Card>
          );
        })()}
      </div>
      <SiteFooter />
    </div>
  );
  } catch (err) {
    console.error("Error rendering SEOLandingPage:", err);
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Helmet>
          <title>Gigxo | Page unavailable</title>
          <meta name="description" content="Something went wrong loading this Gigxo page. Try again or contact support." />
        </Helmet>
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-12 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Something went wrong</h1>
            <p className="text-lg opacity-90">We couldn&apos;t load this page. Please refresh or try again later.</p>
          </div>
        </div>
        <div className="max-w-md mx-auto px-4 py-8">
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Tell us about your event</h2>
            <p className="text-sm text-slate-600">
              Something went wrong loading this page. Please refresh or try again later.
            </p>
          </Card>
        </div>
      </div>
    );
  }
}
