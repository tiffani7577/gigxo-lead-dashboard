import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { generateAllPageConfigs, generatePageConfig, parseSlug } from "@/lib/seoConfig";
import { setMetaTags } from "@/lib/meta-tags";
import { MapPin, Music, ChevronRight } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";

interface FormData {
  eventType: "wedding" | "party" | "birthday" | "corporate" | "other";
  date: string;
  city: string;
  budget: string;
  description: string;
  name: string;
  email: string;
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
  params: { slug: string };
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

export default function SEOLandingPage({ params }: SEOLandingPageProps) {
  const [location] = useLocation();
  const slug = params?.slug || location.split("/").filter(Boolean).pop() || "dj-miami";

  // Parse slug to get service and city
  const parsed = parseSlug(slug);
  const config = parsed ? generatePageConfig(parsed.serviceId, parsed.cityId) : null;
  // Only use config when slug resolved; do not fall back for unknown slugs (avoids wrong page + missing fields)
  const pageConfig = config ?? null;

  const isHirePage = pageConfig?.pageType === "hire";
  const isVenuePage = pageConfig?.pageType === "venue";
  const isHireLikePage = isHirePage || isVenuePage;
  const isBoatContextPage = slug.startsWith("yacht-dj-") || slug.includes("marina") || slug.includes("yacht");
  const isYachtHirePage = isHirePage && slug.startsWith("yacht-dj-");

  // Precompute all SEO configs once for internal linking
  const allConfigs = generateAllPageConfigs();

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
    durationHours: "",
    guestCount: "",
    yachtEventType: "",
    packageType: "dj_only",
    batteryPowered: false,
    compactSetup: true,
  });

  useEffect(() => {
    if (pageConfig) {
      const title = pageConfig.seoTitle ?? pageConfig.heading ?? "";
      const desc = pageConfig.seoDescription ?? "";
      const url = `https://www.gigxo.com/${slug}`;
      setMetaTags({
        title,
        description: desc,
        url,
        image: pageConfig.ogImage,
      });
    } else {
      setMetaTags({
        title: "Gigxo Booking",
        description: "Request a quote for your event.",
        url: `https://www.gigxo.com/${slug}`,
      });
    }
  }, [pageConfig, slug]);

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

  // Unknown slug: render a simple page with title and minimal quote form (no crash)
  if (!pageConfig) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-12 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Gigxo Booking</h1>
            <p className="text-lg opacity-90">Request a quote for your event</p>
          </div>
        </div>
        <div className="max-w-md mx-auto px-4 py-8">
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Tell us about your event</h2>
            {submitted ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-green-800 font-semibold">✓ Thanks for reaching out!</p>
                <p className="text-green-700 text-sm">We'll be in touch soon.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Event Type</label>
                  <Select
                    value={formData.eventType}
                    onValueChange={(value) => setFormData({ ...formData, eventType: value as FormData["eventType"] })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
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
                  <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
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
                  <label className="block text-sm font-medium mb-1">Description</label>
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
                <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700" disabled={submitEventRequest.isPending}>
                  {submitEventRequest.isPending ? "Submitting..." : "Get Matched"}
                </Button>
              </form>
            )}
          </Card>
        </div>
      </div>
    );
  }

  // Normalize optional config so undefined never crashes render
  const heading = pageConfig.heading ?? "";
  const subheading = pageConfig.subheading ?? "";
  const content = pageConfig.content ?? "";
  const defaultCity = pageConfig.defaultCity ?? "Miami, FL";
  const seoTitle = pageConfig.seoTitle ?? heading;
  const seoDescription = pageConfig.seoDescription ?? "";
  const calculatorVariant = pageConfig.calculatorVariant ?? null;

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

  // JSON-LD: Service + BreadcrumbList (FAQPage script lives next to FAQ section)
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
          url: typeof window !== "undefined" ? window.location?.href ?? "" : "",
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
            item: "https://www.gigxo.com",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: heading,
            item: `https://www.gigxo.com/${slug}`,
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
        {/* JSON-LD scripts */}
        <div className="hidden">
          {jsonLdScripts.map((script, idx) => (
            <script key={idx} type="application/ld+json" dangerouslySetInnerHTML={{ __html: script }} />
          ))}
        </div>
      {/* Hero Section */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">{heading}</h1>
            <p className="text-xl md:text-2xl opacity-90">{subheading}</p>
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
              <p className="text-gray-700 mb-4">{content}</p>
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
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold">Browse performers</h3>
                    <p className="text-gray-600">
                      Explore verified profiles, listen to music, and see which performers fit your event.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold">Share a few details</h3>
                    <p className="text-gray-600">
                      Use the quick quote form so we understand timing, location, and the vibe you&apos;re going for.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold">We match and confirm</h3>
                    <p className="text-gray-600">
                      We match you with the best options for your city, then help you lock in the booking.
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* FAQ section — rendered when pageConfig.faq exists */}
            {pageConfig?.faq && pageConfig.faq.length > 0 && (() => {
              try {
                const faqSchema = JSON.stringify({
                  "@context": "https://schema.org",
                  "@type": "FAQPage",
                  mainEntity: pageConfig.faq.map((item) => ({
                    "@type": "Question",
                    name: item.question,
                    acceptedAnswer: {
                      "@type": "Answer",
                      text: item.answer,
                    },
                  })),
                });
                return (
                  <>
                    <script
                      type="application/ld+json"
                      dangerouslySetInnerHTML={{ __html: faqSchema }}
                    />
                    <section className="mt-12">
                      <h2 className="text-2xl font-bold text-slate-900 mb-6">
                        Frequently Asked Questions
                      </h2>
                      <div className="space-y-4">
                        {pageConfig.faq.map((item, i) => (
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
                  </>
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

                  <Button
                    type="submit"
                    className="w-full bg-purple-600 hover:bg-purple-700"
                    disabled={submitEventRequest.isPending}
                  >
                    {submitEventRequest.isPending ? "Submitting..." : pageConfig.leadCTA ?? "Get Matched"}
                  </Button>
                </form>
              )}
            </Card>
          </div>
        </div>
        {/* Fort Lauderdale yacht cluster links */}
        {(() => {
          const fortYachtSlugs = [
            "dj-bahia-mar-marina",
            "dj-pier-sixty-six-marina",
            "dj-port-everglades-yacht",
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
                  Jump between high-intent yacht hire, marina-specific, and pricing pages.
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
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-12 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Gigxo Booking</h1>
            <p className="text-lg opacity-90">Request a quote for your event</p>
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
