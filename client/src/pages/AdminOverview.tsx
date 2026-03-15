/**
 * Admin command center: unified overview with business metrics, recent signups,
 * lead quality, venue intelligence status, and quick actions.
 */
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { useState } from "react";
import {
  Users,
  Music,
  UserPlus,
  Zap,
  ExternalLink,
  Loader2,
  XCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type SignupRow = {
  id: number;
  email: string;
  name: string | null;
  joinedAt: Date;
  emailVerified: boolean;
  leadsUnlocked: number;
  totalSpentDollars: number;
  subscriptionStatus: string;
};

export default function AdminOverview() {
  const { user, isAuthenticated } = useAuth();
  const [signupFilter, setSignupFilter] = useState<"7d" | "30d" | "all">("7d");
  const [selectedUser, setSelectedUser] = useState<SignupRow | null>(null);

  const { data: overview, isLoading: overviewLoading } =
    trpc.admin.getAdminOverview.useQuery(undefined, {
      enabled: user?.role === "admin",
    });
  const { data: signups = [], isLoading: signupsLoading } =
    trpc.admin.getRecentSignups.useQuery(
      { filter: signupFilter },
      { enabled: user?.role === "admin" }
    );
  const { data: leadQuality, isLoading: qualityLoading } =
    trpc.admin.getLeadQualitySnapshot.useQuery(undefined, {
      enabled: user?.role === "admin",
    });
  const { data: venueStatus, isLoading: venueLoading } =
    trpc.admin.getVenueIntelligenceStatus.useQuery(undefined, {
      enabled: user?.role === "admin",
    });
  const { data: pendingLeads = [], refetch: refetchPending } =
    trpc.admin.getPendingLeads.useQuery(undefined, {
      enabled: user?.role === "admin",
    });

  const runDbpr = trpc.admin.runDbprPipeline.useMutation({
    onSuccess: (d) => {
      toast.success(`DBPR: ${(d as { inserted: number }).inserted} inserted`);
      refetchPending();
    },
    onError: (e) => toast.error(e.message),
  });
  const runScraper = trpc.admin.runScraper.useMutation({
    onSuccess: () => {
      toast.success("Scraper started");
      refetchPending();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2 text-slate-900">Access Denied</h1>
          <p className="text-slate-600">Admin access required</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Page title */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">
            Admin Command Center
          </h1>
          <div className="flex gap-2">
            <Link href="/admin/queue">
              <Button variant="outline" size="sm">
                Lead Queue
              </Button>
            </Link>
            <Link href="/admin/leads-explorer">
              <Button variant="outline" size="sm">
                Lead Explorer
              </Button>
            </Link>
          </div>
        </div>

        {/* SECTION 1 — Business metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Business metrics</CardTitle>
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading…
              </div>
            ) : overview ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-4">
                <div className="rounded-lg border bg-slate-50/50 p-3">
                  <div className="text-xs text-slate-500 uppercase tracking-wide">
                    Total users
                  </div>
                  <div className="text-xl font-semibold">{overview.users.total}</div>
                </div>
                <div className="rounded-lg border bg-slate-50/50 p-3">
                  <div className="text-xs text-slate-500 uppercase tracking-wide">
                    Verified users
                  </div>
                  <div className="text-xl font-semibold">
                    {overview.users.verified}
                  </div>
                </div>
                <div className="rounded-lg border bg-slate-50/50 p-3">
                  <div className="text-xs text-slate-500 uppercase tracking-wide">
                    Users w/ unlocks
                  </div>
                  <div className="text-xl font-semibold">
                    {overview.users.withUnlocks}
                  </div>
                </div>
                <div className="rounded-lg border bg-slate-50/50 p-3">
                  <div className="text-xs text-slate-500 uppercase tracking-wide">
                    Total revenue
                  </div>
                  <div className="text-xl font-semibold">
                    ${overview.revenue.totalDollars.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="rounded-lg border bg-slate-50/50 p-3">
                  <div className="text-xs text-slate-500 uppercase tracking-wide">
                    Avg revenue/user
                  </div>
                  <div className="text-xl font-semibold">
                    ${overview.revenue.avgPerUser.toFixed(2)}
                  </div>
                </div>
                <div className="rounded-lg border bg-slate-50/50 p-3">
                  <div className="text-xs text-slate-500 uppercase tracking-wide">
                    Leads (marketplace)
                  </div>
                  <div className="text-xl font-semibold">
                    {overview.leads.total}
                  </div>
                </div>
                <div className="rounded-lg border bg-slate-50/50 p-3">
                  <div className="text-xs text-slate-500 uppercase tracking-wide">
                    Approved
                  </div>
                  <div className="text-xl font-semibold text-emerald-600">
                    {overview.leads.approved}
                  </div>
                </div>
                <div className="rounded-lg border bg-slate-50/50 p-3">
                  <div className="text-xs text-slate-500 uppercase tracking-wide">
                    Pending
                  </div>
                  <div className="text-xl font-semibold text-amber-600">
                    {overview.leads.pending}
                  </div>
                </div>
                <div className="rounded-lg border bg-slate-50/50 p-3">
                  <div className="text-xs text-slate-500 uppercase tracking-wide">
                    Pro subscribers
                  </div>
                  <div className="text-xl font-semibold">
                    {overview.proSubscribers}
                  </div>
                </div>
                <div className="rounded-lg border bg-slate-50/50 p-3">
                  <div className="text-xs text-slate-500 uppercase tracking-wide">
                    Signups today / week
                  </div>
                  <div className="text-xl font-semibold">
                    {overview.users.signupsToday} / {overview.users.signupsWeek}
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* SECTION 2 — Recent signups */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent user signups</CardTitle>
            <div className="flex gap-1">
              {(["7d", "30d", "all"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setSignupFilter(f)}
                  className={`px-2 py-1 rounded text-sm ${
                    signupFilter === f
                      ? "bg-purple-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {f === "7d" ? "7 days" : f === "30d" ? "30 days" : "All"}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {signupsLoading ? (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading…
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Verified</TableHead>
                    <TableHead>Unlocks</TableHead>
                    <TableHead>Spent</TableHead>
                    <TableHead>Subscription</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {signups.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => setSelectedUser(row)}
                    >
                      <TableCell className="font-medium">{row.email}</TableCell>
                      <TableCell>{row.name || "—"}</TableCell>
                      <TableCell>{formatDate(row.joinedAt)}</TableCell>
                      <TableCell>
                        {row.emailVerified ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <span className="text-slate-400">No</span>
                        )}
                      </TableCell>
                      <TableCell>{row.leadsUnlocked}</TableCell>
                      <TableCell>
                        ${row.totalSpentDollars.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row.subscriptionStatus === "Pro"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {row.subscriptionStatus}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {signups.length === 0 && !signupsLoading && (
              <p className="text-slate-500 py-4 text-center">
                No signups in this period.
              </p>
            )}
          </CardContent>
        </Card>

        {/* User detail modal */}
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>User detail</DialogTitle>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-slate-500">Email:</span>{" "}
                  {selectedUser.email}
                </p>
                <p>
                  <span className="text-slate-500">Name:</span>{" "}
                  {selectedUser.name || "—"}
                </p>
                <p>
                  <span className="text-slate-500">Joined:</span>{" "}
                  {formatDate(selectedUser.joinedAt)}
                </p>
                <p>
                  <span className="text-slate-500">Email verified:</span>{" "}
                  {selectedUser.emailVerified ? "Yes" : "No"}
                </p>
                <p>
                  <span className="text-slate-500">Leads unlocked:</span>{" "}
                  {selectedUser.leadsUnlocked}
                </p>
                <p>
                  <span className="text-slate-500">Total spent:</span>{" "}
                  ${selectedUser.totalSpentDollars.toFixed(2)}
                </p>
                <p>
                  <span className="text-slate-500">Subscription:</span>{" "}
                  {selectedUser.subscriptionStatus}
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* SECTION 3 — Lead quality snapshot */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Lead quality snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {qualityLoading ? (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading…
              </div>
            ) : leadQuality ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-slate-500 uppercase">
                      Approved
                    </div>
                    <div className="text-lg font-semibold text-emerald-600">
                      {leadQuality.approved}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-slate-500 uppercase">
                      Manual pending
                    </div>
                    <div className="text-lg font-semibold text-amber-600">
                      {leadQuality.pending}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-slate-500 uppercase">
                      With contact info
                    </div>
                    <div className="text-lg font-semibold">
                      {leadQuality.withContact}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-slate-500 uppercase">
                      Without contact
                    </div>
                    <div className="text-lg font-semibold text-slate-500">
                      {leadQuality.withoutContact}
                    </div>
                  </div>
                </div>
                {leadQuality.avgIntentScore != null && (
                  <p className="text-sm text-slate-600">
                    Average intent score:{" "}
                    <strong>{leadQuality.avgIntentScore}</strong>
                  </p>
                )}
                <div>
                  <div className="text-xs text-slate-500 uppercase mb-2">
                    Leads by source
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {leadQuality.bySource.map(({ source, count }) => (
                      <Badge key={source} variant="secondary">
                        {source}: {count}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* SECTION 4 — Venue intelligence */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Venue intelligence status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {venueLoading ? (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading…
              </div>
            ) : venueStatus ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-slate-500 uppercase">
                      Total DBPR venues
                    </div>
                    <div className="text-lg font-semibold">
                      {venueStatus.totalDbprVenues}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-slate-500 uppercase">
                      Outreach today
                    </div>
                    <div className="text-lg font-semibold">
                      {venueStatus.outreachSentToday}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-slate-500 uppercase">
                      Outreach this week
                    </div>
                    <div className="text-lg font-semibold">
                      {venueStatus.outreachSentThisWeek}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-slate-500 uppercase">
                      With contact email
                    </div>
                    <div className="text-lg font-semibold text-emerald-600">
                      {venueStatus.withContactEmail}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-slate-500 uppercase">
                      Missing contact
                    </div>
                    <div className="text-lg font-semibold text-amber-600">
                      {venueStatus.missingContactInfo}
                    </div>
                  </div>
                </div>
                {venueStatus.recentReplies.length > 0 && (
                  <div>
                    <div className="text-xs text-slate-500 uppercase mb-2">
                      Recent outreach replies
                    </div>
                    <ul className="space-y-1 text-sm">
                      {venueStatus.recentReplies.map((r) => (
                        <li key={r.id} className="flex items-center gap-2">
                          <Badge variant="outline">{r.outreachStatus}</Badge>
                          <span className="font-medium">{r.title}</span>
                          <span className="text-slate-500">— {r.location}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* SECTION 5 — Quick actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => runDbpr.mutate({})}
              disabled={runDbpr.isPending}
            >
              {runDbpr.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Zap className="w-4 h-4 mr-1" />
              )}
              Run DBPR pipeline
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => runScraper.mutate({})}
              disabled={runScraper.isPending}
            >
              {runScraper.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Music className="w-4 h-4 mr-1" />
              )}
              Fetch performer leads
            </Button>
            <Link href="/admin/queue">
              <Button variant="outline" size="sm" className="relative">
                <Users className="w-4 h-4 mr-1" />
                View pending approvals
                {pendingLeads.length > 0 && (
                  <Badge className="ml-1 bg-amber-500">
                    {pendingLeads.length}
                  </Badge>
                )}
              </Button>
            </Link>
            <Link href="/admin/artist-growth">
              <Button variant="outline" size="sm">
                <UserPlus className="w-4 h-4 mr-1" />
                View users
              </Button>
            </Link>
            <a
              href="https://search.google.com/search-console"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="ghost" size="sm">
                <ExternalLink className="w-4 h-4 mr-1" />
                Google Search Console
              </Button>
            </a>
            <a
              href="https://railway.app/dashboard"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="ghost" size="sm">
                <ExternalLink className="w-4 h-4 mr-1" />
                Railway dashboard
              </Button>
            </a>
            <a
              href="https://dashboard.stripe.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="ghost" size="sm">
                <ExternalLink className="w-4 h-4 mr-1" />
                Stripe dashboard
              </Button>
            </a>
            <a
              href="https://console.apify.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="ghost" size="sm">
                <ExternalLink className="w-4 h-4 mr-1" />
                Apify console
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
    </DashboardLayout>
  );
}
