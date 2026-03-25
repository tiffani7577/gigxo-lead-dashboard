import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteFooter } from "@/components/SiteFooter";
import { Building2, Loader2 } from "lucide-react";

function cityFromLocation(location: string | null | undefined): string {
  const s = String(location ?? "").trim();
  if (!s) return "—";
  const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
  return parts[0] ?? s;
}

export default function VenueIntel() {
  const { loading: authLoading, isAuthenticated } = useAuth();
  const { data: eligibility, isLoading: eligLoading } = trpc.venueIntel.getSubscriptionEligibility.useQuery(
    undefined,
    { enabled: isAuthenticated },
  );
  const eligible = !!eligibility?.eligible;

  const { data: venuesData, isLoading: venuesLoading, isError, error } = trpc.venueIntel.getVenues.useQuery(
    { limit: 100, offset: 0 },
    { enabled: isAuthenticated && eligible },
  );

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="border-b bg-white/80 backdrop-blur">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/">
              <span className="font-semibold text-purple-700">Gigxo</span>
            </Link>
            <Link href="/login">
              <Button variant="outline">Sign in</Button>
            </Link>
          </div>
        </header>
        <main className="flex-1 max-w-3xl mx-auto px-4 py-12">
          <Card>
            <CardHeader>
              <CardTitle>Venue intelligence</CardTitle>
              <CardDescription>Sign in to view subscriber venues.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/login">
                <Button>Sign in</Button>
              </Link>
            </CardContent>
          </Card>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (eligLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!eligible) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="border-b bg-white/80 backdrop-blur">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/dashboard" className="text-sm text-slate-600 hover:text-purple-600">
              ← Dashboard
            </Link>
            <Link href="/">
              <span className="font-semibold text-purple-700">Gigxo</span>
            </Link>
          </div>
        </header>
        <main className="flex-1 max-w-3xl mx-auto px-4 py-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Premium subscription required
              </CardTitle>
              <CardDescription>
                South Florida venue intelligence is available with an active Premium subscription. Upgrade to browse
                venues we surface for subscribers.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Link href="/pricing">
                <Button>View pricing</Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="outline">Back to dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (venuesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <p className="text-red-600">{error?.message ?? "Could not load venues."}</p>
        <Link href="/dashboard">
          <Button variant="outline" className="mt-4">
            Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  const items = venuesData?.items ?? [];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <Link href="/dashboard" className="text-sm text-slate-600 hover:text-purple-600 shrink-0">
            ← Dashboard
          </Link>
          <h1 className="text-lg font-semibold text-slate-900 text-center flex-1 truncate">Venue intel</h1>
          <span className="w-14 shrink-0" aria-hidden />
        </div>
      </header>
      <main className="flex-1 max-w-3xl mx-auto px-4 py-8 w-full">
        <p className="text-sm text-slate-500 mb-4">{venuesData?.total ?? 0} venues</p>
        <ul className="space-y-3">
          {items.map((item) => {
            const phoneRaw = (item as { contactPhone?: string | null }).contactPhone;
            const phone = phoneRaw?.trim() || null;
            return (
              <li key={item.id}>
                <Card>
                  <CardContent className="py-4 px-4">
                    <div className="font-medium text-slate-900">{item.title}</div>
                    <div className="text-sm text-slate-600 mt-1">{cityFromLocation(item.location)}</div>
                    {phone ? (
                      <div className="text-sm text-slate-600 mt-1">
                        <a href={`tel:${phone}`} className="text-purple-700 hover:underline">
                          {phone}
                        </a>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
        {items.length === 0 ? (
          <p className="text-slate-500 text-center py-12">No venues available for your subscription yet.</p>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
