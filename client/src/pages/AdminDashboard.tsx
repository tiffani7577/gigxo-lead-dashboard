import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { useMemo, useState } from "react";
import { Loader2, CheckCircle2, XCircle, Plus, TrendingUp, Users, DollarSign, Music, RefreshCw, Send, Bot, UserX, LayoutDashboard, Eye, EyeOff, Bookmark, BookmarkCheck, ExternalLink, Phone, Mail, Megaphone, Bell, Copy, Check, Search } from "lucide-react";
import GrowthWorksheet from "./GrowthWorksheet";
import { toast } from "sonner";

function formatBudget(cents: number | null) {
  if (!cents) return "TBD";
  return `$${(cents / 100).toLocaleString()}`;
}

function getLeadSourceLabel(lead: any): string {
  // 1) Direct field, if present
  if (lead.sourceSlug && typeof lead.sourceSlug === "string") {
    const trimmed = lead.sourceSlug.trim();
    if (trimmed) return trimmed;
  }

  const description: string = typeof lead.description === "string" ? lead.description : "";

  // 2) Extract from description line like "Source: slug-here"
  if (description.includes("Source: ")) {
    const line = description
      .split("\n")
      .find((l) => l.trim().startsWith("Source: "));
    if (line) {
      const extracted = line.replace("Source:", "").trim();
      if (extracted) return extracted;
    }
  }

  // 3) Infer from known SEO slugs by matching on keywords in title/description
  const title: string = typeof lead.title === "string" ? lead.title : "";
  const text = `${title}\n${description}`.toLowerCase();

  const slugCandidates: { slug: string; hints: string[] }[] = [
    {
      slug: "yacht-dj-fort-lauderdale",
      hints: ["yacht dj fort lauderdale", "17th street marina", "yacht dj ft lauderdale"],
    },
    {
      slug: "private-yacht-party-dj-fort-lauderdale",
      hints: ["private yacht party", "private yacht dj", "friends-only yacht"],
    },
    {
      slug: "luxury-yacht-entertainment-fort-lauderdale",
      hints: ["luxury yacht", "vip charter", "uhnw", "brand activation"],
    },
    {
      slug: "last-minute-yacht-dj-fort-lauderdale",
      hints: ["last-minute", "last minute", "same-day", "same day"],
    },
    {
      slug: "corporate-yacht-event-dj-fort-lauderdale",
      hints: ["corporate", "client cruise", "exec offsite", "business event"],
    },
    {
      slug: "yacht-bachelorette-party-dj-fort-lauderdale",
      hints: ["bachelorette", "hen party", "girls weekend"],
    },
    {
      slug: "yacht-live-music-fort-lauderdale",
      hints: ["live music", "band", "sax", "acoustic", "quartet"],
    },
    {
      slug: "yacht-dj-miami",
      hints: ["miami yacht", "biscayne bay", "miami yacht party"],
    },
    {
      slug: "hire-yacht-dj-fort-lauderdale",
      hints: ["hire a yacht dj", "hire yacht dj", "book yacht dj"],
    },
    {
      slug: "17th-street-yacht-dj-fort-lauderdale",
      hints: ["17th street", "17th st causeway", "bahia mar", "pier 66"],
    },
  ];

  for (const candidate of slugCandidates) {
    if (candidate.hints.some((h) => text.includes(h))) {
      return candidate.slug;
    }
  }

  // 4) Fallbacks for non-SEO but still client-submitted leads
  const leadType = (lead.leadType || "").toString();
  const source = (lead.source || "").toString();

  if (leadType === "client_submitted" || source === "gigxo") {
    return "Gigxo client lead";
  }

  // 5) Default
  return "Unknown";
}

export default function AdminDashboard() {
  const { user, isAuthenticated } = useAuth();
  const [adminSection, setAdminSection] = useState<"leads" | "worksheet" | "outreach">("leads");
  const [showAddForm, setShowAddForm] = useState(false);
  const [leadFilter, setLeadFilter] = useState<"all" | "approved" | "pending" | "rejected">("pending");
  const [filterPerformerType, setFilterPerformerType] = useState<string>("all");
  const [scrapeCity, setScrapeCity] = useState<string>("all");
  const [scrapePerformerType, setScrapePerformerType] = useState<string>("all");
  const [leadPod, setLeadPod] = useState<"marketplace" | "venue" | "artist" | "growth">("marketplace");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    eventType: "Wedding",
    performerType: "dj",
    budget: 1000,
    location: "Miami, FL",
    eventDate: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
  });

  const utils = trpc.useUtils();

  // Fetch leads by status
  const { data: leads, isLoading: leadsLoading, refetch: refetchLeads } = trpc.admin.getAllLeads.useQuery(
    { status: leadFilter, limit: 100, performerType: filterPerformerType === "all" ? undefined : filterPerformerType },
    { enabled: user?.role === "admin" }
  );

  // Fetch analytics
  const { data: analytics, refetch: refetchAnalytics } = trpc.admin.getAnalytics.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  // Route pending lead (Artist Lead / Venue Intel / Client Request / Reject)
  const { mutate: routeLead, isPending: isRouting } = trpc.admin.routeLead.useMutation({
    onSuccess: (_, variables) => {
      refetchLeads();
      refetchAnalytics();
      const msg = variables.action === "reject" ? "Lead rejected" : "Lead routed and published!";
      toast.success(msg);
    },
    onError: (e) => toast.error(e.message),
  });

  // Legacy approve/reject still used for "Restore" on rejected leads
  const { mutate: approveLead, isPending: isApproving } = trpc.admin.approveLead.useMutation({
    onSuccess: () => { refetchLeads(); refetchAnalytics(); toast.success("Lead restored to pending"); },
    onError: (e) => toast.error(e.message),
  });

  // Toggle hide/show lead
  const { mutate: toggleHide } = trpc.admin.toggleHideLead.useMutation({
    onSuccess: () => { refetchLeads(); toast.success("Lead visibility updated"); },
    onError: (e) => toast.error(e.message),
  });

  // Reserve lead for owner
  const { mutate: reserveLead } = trpc.admin.reserveLead.useMutation({
    onSuccess: () => { refetchLeads(); toast.success("Lead reservation updated"); },
    onError: (e) => toast.error(e.message),
  });

  // Set custom price
  const { mutate: setLeadPrice } = trpc.admin.setLeadPrice.useMutation({
    onSuccess: () => { refetchLeads(); toast.success("Lead price updated"); },
    onError: (e) => toast.error(e.message),
  });

  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [priceInput, setPriceInput] = useState<string>("");
  const [editingLeadId, setEditingLeadId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<any>({
    title: "",
    location: "",
    eventType: "",
    budget: "",
    description: "",
    contactName: "",
    contactEmail: "",
    leadType: "",
    leadCategory: "",
    leadTier: "" as string | null,
    status: "",
    notes: "",
    followUpAt: "",
    unlockPriceDollars: "",
  });

  const leadSourceStats = useMemo(() => {
    if (!leads || leads.length === 0) return [];

    const totals: Record<string, { count: number; valueCents: number }> = {};

    for (const lead of leads as any[]) {
      const slug = getLeadSourceLabel(lead) || "Gigxo client lead";
      const budgetCents = typeof lead.budget === "number" ? lead.budget : null;

      if (!totals[slug]) {
        totals[slug] = { count: 0, valueCents: 0 };
      }
      totals[slug].count += 1;
      if (budgetCents && budgetCents > 0) {
        totals[slug].valueCents += budgetCents;
      }
    }

    const totalLeads = (leads as any[]).length;
    const rows = Object.entries(totals).map(([slug, stats]) => ({
      slug,
      count: stats.count,
      valueCents: stats.valueCents,
      percent: totalLeads > 0 ? (stats.count / totalLeads) * 100 : 0,
    }));

    rows.sort((a, b) => b.count - a.count);

    // Lightweight debug summary
    console.log(
      "[admin] lead source summary",
      Object.fromEntries(rows.map((r) => [r.slug, r.count]))
    );

    return rows;
  }, [leads]);

  // Update lead
  const { mutate: updateLead, isPending: isUpdating } = trpc.admin.updateLead.useMutation({
    onSuccess: () => {
      console.log("[edit] save succeeded");
      setEditingLeadId(null);
      refetchLeads();
      toast.success("Lead updated!");
    },
    onError: (e) => {
      console.log("[edit] save failed:", e.message, e);
      toast.error(e.message);
    },
  });

  const openEditModal = (lead: any) => {
    setEditingLeadId(lead.id);
    setEditFormData({
      title: lead.title || "",
      location: lead.location || "",
      eventType: lead.eventType || "",
      budget: lead.budget ? String(lead.budget / 100) : "",
      description: lead.description || "",
      contactName: lead.contactName || "",
      contactEmail: lead.contactEmail || "",
      leadType: lead.leadType ?? "",
      leadCategory: lead.leadCategory ?? "",
      leadTier: (lead as any).leadTier ?? "",
      status: (lead as any).status ?? "",
      notes: (lead as any).notes ?? "",
      followUpAt: (lead as any).followUpAt ? new Date(lead.followUpAt).toISOString().slice(0, 16) : "",
      unlockPriceDollars: (lead as any).unlockPriceCents != null ? (lead as any).unlockPriceCents / 100 : "",
    });
  };

  const handleSaveEdit = () => {
    console.log("[edit] saving leadId:", editingLeadId, "data:", editFormData);
    if (!editingLeadId) {
      toast.error("No lead selected for editing");
      return;
    }
    updateLead({
      leadId: editingLeadId,
      title: editFormData.title || undefined,
      location: editFormData.location || undefined,
      eventType: editFormData.eventType || undefined,
      budget: editFormData.budget ? Number(editFormData.budget) : undefined,
      description: editFormData.description || undefined,
      contactName: editFormData.contactName || undefined,
      contactEmail: editFormData.contactEmail || undefined,
      leadType: editFormData.leadType || undefined,
      leadCategory: editFormData.leadCategory || undefined,
      leadTier: editFormData.leadTier ? editFormData.leadTier : null,
      status: editFormData.status || undefined,
      notes: editFormData.notes || undefined,
      followUpAt: editFormData.followUpAt ? new Date(editFormData.followUpAt).toISOString() : undefined,
      unlockPriceCents: editFormData.unlockPriceDollars
        ? Math.round(Number(editFormData.unlockPriceDollars) * 100)
        : undefined,
    });
  };

  // Add manual lead
  const { mutate: addManualLead, isPending: isAdding } = trpc.admin.addManualLead.useMutation({
    onSuccess: () => {
      setFormData({
        title: "", description: "", eventType: "Wedding", performerType: "dj", budget: 1000,
        location: "Miami, FL", eventDate: "", contactName: "", contactEmail: "", contactPhone: "",
      });
      setShowAddForm(false);
      refetchLeads();
      refetchAnalytics();
      toast.success("Lead added and published!");
    },
    onError: (e) => toast.error(e.message),
  });

  // Trigger daily digest
  const { mutate: triggerDigest, isPending: isSendingDigest } = trpc.admin.triggerDailyDigest.useMutation({
    onSuccess: (data) => toast.success(data.message),
    onError: (e) => toast.error(e.message),
  });

  // Run scraper
  const [lastPipelineStats, setLastPipelineStats] = useState<{ collected: number; filtered: number; classified: number; saved: number; sourceCounts?: Record<string, number> } | null>(null);
  const { mutate: runScraper, isPending: isScraping } = trpc.admin.runScraper.useMutation({
    onSuccess: (data) => {
      const sourceCounts = (data as any).sourceCounts as Record<string, number> | undefined;
      setLastPipelineStats({
        collected: data.collected,
        filtered: data.filtered,
        classified: data.classified,
        saved: (data as any).saved ?? (data as any).inserted ?? 0,
        sourceCounts,
      });

      const parts: string[] = [];
      if (sourceCounts) {
        for (const [source, count] of Object.entries(sourceCounts)) {
          parts.push(`${source}: ${count}`);
        }
      }

      const breakdown = parts.length ? ` [${parts.join(" · ")}]` : "";
      toast.success(
        `Scraper done! Collected ${data.collected} → Classified ${data.classified} → ${data.saved} saved${breakdown}`,
        { duration: 8000 }
      );
      refetchLeads();
      refetchAnalytics();
    },
    onError: (e) => toast.error(e.message),
  });

  // Trigger re-engagement
  const { mutate: triggerReEngage, isPending: isReEngaging } = trpc.admin.triggerReEngagement.useMutation({
    onSuccess: (data) => toast.success(data.message),
    onError: (e) => toast.error(e.message),
  });

  // Drip emails
  const { mutate: sendDay3Drip, isPending: isSendingDay3 } = trpc.automation.sendDay3Drip.useMutation({
    onSuccess: (data: { sent: number }) => toast.success(`Day-3 drip sent to ${data.sent} artist${data.sent !== 1 ? 's' : ''}!`),
    onError: (e: { message: string }) => toast.error(e.message),
  });
  const { mutate: sendDay7Drip, isPending: isSendingDay7 } = trpc.automation.sendDay7Drip.useMutation({
    onSuccess: (data: { sent: number }) => toast.success(`Day-7 referral drip sent to ${data.sent} artist${data.sent !== 1 ? 's' : ''}!`),
    onError: (e: { message: string }) => toast.error(e.message),
  });
  const { mutate: sendNewLeadAlerts, isPending: isSendingAlerts } = trpc.automation.sendNewLeadAlerts.useMutation({
    onSuccess: (data: { sent: number }) => toast.success(`New lead alerts sent to ${data.sent} artist${data.sent !== 1 ? 's' : ''}!`),
    onError: (e: { message: string }) => toast.error(e.message),
  });

  // Outreach templates
  const { data: outreachTemplates } = trpc.automation.getOutreachTemplates.useQuery(undefined, { enabled: user?.role === 'admin' });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

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
    <div className="min-h-screen bg-slate-50">
      {/* Top Nav */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
              <Music className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg">Gigxo Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAdminSection("leads")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                adminSection === "leads" ? "bg-purple-600 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Lead Queue
            </button>
            <button
              onClick={() => setAdminSection("worksheet")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1 ${
                adminSection === "worksheet" ? "bg-purple-600 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Growth Worksheet
            </button>
            <button
              onClick={() => setAdminSection("outreach")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1 ${
                adminSection === "outreach" ? "bg-purple-600 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Megaphone className="w-3.5 h-3.5" />
              Outreach
            </button>
            <Link href="/admin/leads-explorer">
              <button
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1 text-slate-600 hover:bg-slate-100"
              >
                <Search className="w-3.5 h-3.5" />
                Lead Explorer
              </button>
            </Link>
            <div className="w-px h-5 bg-slate-200 mx-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerDigest()}
              disabled={isSendingDigest}
            >
              {isSendingDigest ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
              Digest
            </Button>
            <select
              value={scrapeCity}
              onChange={(e) => setScrapeCity(e.target.value)}
              className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-400"
              title="Select city to scrape"
            >
              <option value="all">All Cities</option>
              <option value="miami">Miami</option>
              <option value="nyc">New York City</option>
              <option value="la">Los Angeles</option>
              <option value="chicago">Chicago</option>
              <option value="houston">Houston</option>
              <option value="dallas">Dallas</option>
              <option value="atlanta">Atlanta</option>
              <option value="las_vegas">Las Vegas</option>
              <option value="nashville">Nashville</option>
              <option value="orlando">Orlando</option>
              <option value="phoenix">Phoenix</option>
              <option value="dc">Washington DC</option>
            </select>
            <select
              value={scrapePerformerType}
              onChange={(e) => setScrapePerformerType(e.target.value)}
              className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-400"
              title="Select performer type to focus on"
            >
              <option value="all">All Types</option>
              <option value="dj">DJ</option>
              <option value="solo_act">Solo Act</option>
              <option value="small_band">Small Band</option>
              <option value="large_band">Large Band</option>
              <option value="singer">Singer</option>
              <option value="instrumentalist">Instrumentalist</option>
              <option value="photo_video">Photo / Video</option>
              <option value="photo_booth">Photo Booth</option>
              <option value="makeup_artist">Makeup Artist</option>
              <option value="emcee">Emcee / Host</option>
              <option value="princess_character">Princess / Character</option>
              <option value="immersive_experience">Immersive Experience</option>
              <option value="hybrid_electronic">Hybrid Electronic</option>
              <option value="photographer">Photographer</option>
              <option value="videographer">Videographer</option>
              <option value="audio_engineer">Audio Engineer</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => runScraper({ marketId: scrapeCity === "all" ? undefined : scrapeCity, leadsPerCity: 15, focusPerformerType: scrapePerformerType === "all" ? undefined : scrapePerformerType })}
              disabled={isScraping}
            >
              {isScraping ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Search className="w-4 h-4 mr-1" />}
              Fetch Leads
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerReEngage()}
              disabled={isReEngaging}
            >
              {isReEngaging ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <UserX className="w-4 h-4 mr-1" />}
              Re-Engage
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { refetchLeads(); refetchAnalytics(); }}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
            <a href="/dashboard" className="text-sm text-purple-600 hover:underline">Artist View →</a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Growth Worksheet Section */}
        {adminSection === "worksheet" && (
          <div className="bg-zinc-950 min-h-screen -mx-4 px-4 py-6 rounded-lg">
            <GrowthWorksheet />
          </div>
        )}

        {/* Outreach & Automation Section */}
        {adminSection === "outreach" && (
          <div className="space-y-8">
            {/* Drip Email Controls */}
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">Automated Email Campaigns</h2>
              <p className="text-sm text-slate-500 mb-4">One-click campaigns that run against your live artist database. No capital required.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-purple-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <Bell className="w-4 h-4 text-purple-500" />
                      Day-3 Drip
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-slate-500 mb-3">Sends to artists who signed up 2–4 days ago with zero unlocks. Shows a blurred lead preview + ROI math to nudge first purchase.</p>
                    <Button size="sm" className="w-full" onClick={() => sendDay3Drip()} disabled={isSendingDay3}>
                      {isSendingDay3 ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                      Send Day-3 Drip
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-green-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <Users className="w-4 h-4 text-green-500" />
                      Day-7 Referral Push
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-slate-500 mb-3">Sends to artists who joined 6–8 days ago. Includes their personal referral link + pre-written copy to paste into DJ Facebook groups.</p>
                    <Button size="sm" className="w-full bg-green-600 hover:bg-green-700" onClick={() => sendDay7Drip()} disabled={isSendingDay7}>
                      {isSendingDay7 ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                      Send Day-7 Drip
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-blue-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <Bell className="w-4 h-4 text-blue-500" />
                      New Lead Alerts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-slate-500 mb-3">Notifies artists whose performer type matches leads approved in the last 24 hours. Drives same-day unlocks.</p>
                    <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => sendNewLeadAlerts({})} disabled={isSendingAlerts}>
                      {isSendingAlerts ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Bell className="w-4 h-4 mr-1" />}
                      Send Lead Alerts
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Social Outreach Templates */}
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">Social Outreach Templates</h2>
              <p className="text-sm text-slate-500 mb-4">Pre-written copy for DJ Facebook groups, Instagram, TikTok, and DMs. Click to copy, then paste directly.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(outreachTemplates ?? []).map((tpl) => (
                  <Card key={tpl.id} className="border-slate-200">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Badge variant="outline" className="text-xs mb-1">{tpl.channel}</Badge>
                          <CardTitle className="text-sm font-semibold text-slate-800">{tpl.subject}</CardTitle>
                          <p className="text-xs text-slate-400 mt-0.5">Audience: {tpl.audience}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={() => copyToClipboard(tpl.body, tpl.id)}
                        >
                          {copiedId === tpl.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 rounded p-3 whitespace-pre-wrap">{tpl.body}</p>
                      {tpl.suggestedGroups.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-slate-500 mb-1">Post in:</p>
                          <div className="flex flex-wrap gap-1">
                            {tpl.suggestedGroups.map((g) => (
                              <span key={g} className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">{g}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}

        {adminSection === "leads" && (
        <>
        {/* Analytics Cards */}
        {analytics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <Music className="w-3.5 h-3.5" /> Total Leads
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-slate-900">{analytics.leads.total}</p>
                <p className="text-xs text-slate-500 mt-0.5">{analytics.leads.approved} approved · {analytics.leads.pending} pending</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> Users
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-slate-900">{analytics.users.total}</p>
                <p className="text-xs text-slate-500 mt-0.5">{analytics.unlocks.total} total unlocks</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" /> Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-emerald-600">${analytics.revenue.total.toFixed(2)}</p>
                <p className="text-xs text-slate-500 mt-0.5">{analytics.revenue.transactions} transactions</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> Avg per Unlock
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-purple-600">$7.00</p>
                <p className="text-xs text-slate-500 mt-0.5">Flat rate pricing</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Pipeline Stats — shown after last scraper run */}
        {lastPipelineStats && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Search className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-semibold text-slate-700">Last Pipeline Run</span>
              <span className="text-xs text-slate-400 ml-auto">Collected → Filtered → Classified → High-Confidence</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-100 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-slate-800">{lastPipelineStats.collected}</p>
                <p className="text-xs text-slate-500 mt-0.5">Raw Docs</p>
              </div>
              <div className="text-slate-300 text-lg">→</div>
              <div className="flex-1 bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-blue-700">{lastPipelineStats.filtered}</p>
                <p className="text-xs text-slate-500 mt-0.5">Passed Filter</p>
              </div>
              <div className="text-slate-300 text-lg">→</div>
              <div className="flex-1 bg-violet-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-violet-700">{lastPipelineStats.classified}</p>
                <p className="text-xs text-slate-500 mt-0.5">AI Classified</p>
              </div>
              <div className="text-slate-300 text-lg">→</div>
              <div className="flex-1 bg-green-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-green-700">{lastPipelineStats.saved}</p>
                <p className="text-xs text-slate-500 mt-0.5">Saved to Queue</p>
              </div>
            </div>
          </div>
        )}

        {/* Lead Sources (SEO / attribution overview) */}
        {leadSourceStats.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900">Lead Sources</h2>
              <p className="text-xs text-slate-500">Grouped by source slug and estimated budget value</p>
            </div>
            <div className="text-xs">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200 text-slate-500 font-semibold">
                <span className="flex-1 pr-2">Source slug</span>
                <span className="w-16 text-right">Leads</span>
                <span className="w-16 text-right">% share</span>
                <span className="w-28 text-right">Est. value</span>
              </div>
              {leadSourceStats.map((row) => (
                <div
                  key={row.slug}
                  className="flex items-center justify-between py-1 border-b border-slate-100 last:border-b-0"
                >
                  <span className="flex-1 pr-2 text-[11px] text-slate-700 truncate">{row.slug}</span>
                  <span className="w-16 text-right text-slate-800">{row.count}</span>
                  <span className="w-16 text-right text-slate-500">
                    {row.percent.toFixed(0)}%
                  </span>
                  <span className="w-28 text-right text-slate-800">
                    {row.valueCents > 0 ? `$${(row.valueCents / 100).toLocaleString()}` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lead Management */}
          <div className="lg:col-span-2 space-y-4">
            {/* Performer Type Filter */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-slate-500">Category:</span>
              <select
                value={filterPerformerType}
                onChange={(e) => setFilterPerformerType(e.target.value)}
                className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-400"
              >
                <option value="all">All Categories</option>
                <option value="dj">🎧 DJ</option>
                <option value="solo_act">🎤 Solo Act</option>
                <option value="small_band">🎸 Small Band</option>
                <option value="large_band">🎺 Large Band</option>
                <option value="singer">🎙 Singer</option>
                <option value="instrumentalist">🎹 Instrumentalist</option>
                <option value="photo_video">📸 Photo / Video</option>
                <option value="photo_booth">🖼 Photo Booth</option>
                <option value="makeup_artist">💄 Makeup Artist</option>
                <option value="emcee">🎙 Emcee / Host</option>
                <option value="princess_character">👑 Princess / Character</option>
                <option value="immersive_experience">✨ Immersive Experience</option>
                <option value="hybrid_electronic">🎛 Hybrid Electronic</option>
                <option value="photographer">📷 Photographer</option>
                <option value="videographer">🎥 Videographer</option>
                <option value="audio_engineer">🎙 Audio Engineer</option>
              </select>
              {filterPerformerType !== "all" && (
                <button onClick={() => setFilterPerformerType("all")} className="text-xs text-slate-400 hover:text-slate-600">✕ Clear</button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="bg-white rounded-xl border border-slate-200 p-1 flex gap-1">
              {(["pending", "approved", "all", "rejected"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setLeadFilter(status)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors capitalize ${
                    leadFilter === status
                      ? "bg-purple-600 text-white"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {status}
                  {status === "pending" && analytics && analytics.leads.pending > 0 && (
                    <span className="ml-1.5 bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full">
                      {analytics.leads.pending}
                    </span>
                  )}
                </button>
              ))}
            </div>

        {/* Pod selector for lead routing */}
        <div className="flex items-center justify-between mb-3">
          <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-medium text-slate-600">
            <button
              onClick={() => setLeadPod("marketplace")}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1 ${
                leadPod === "marketplace" ? "bg-purple-600 text-white" : "hover:bg-slate-200"
              }`}
            >
              Marketplace
            </button>
            <button
              onClick={() => setLeadPod("venue")}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1 ${
                leadPod === "venue" ? "bg-purple-600 text-white" : "hover:bg-slate-200"
              }`}
            >
              Venue Intelligence
            </button>
            <button
              onClick={() => setLeadPod("artist")}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1 ${
                leadPod === "artist" ? "bg-purple-600 text-white" : "hover:bg-slate-200"
              }`}
            >
              Artist Acquisition
            </button>
            <button
              onClick={() => setLeadPod("growth")}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1 ${
                leadPod === "growth" ? "bg-purple-600 text-white" : "hover:bg-slate-200"
              }`}
            >
              Growth / CRM
            </button>
          </div>
          <span className="text-xs text-slate-400">
            {leadPod === "marketplace" && "Artist-facing leads (scraped + client-submitted + referrals)"}
            {leadPod === "venue" && "Signals for venue outreach and B2B monetization"}
            {leadPod === "artist" && "Lightweight space for tracking high-value artists"}
            {leadPod === "growth" && "Placeholder for segmentation and follow-up workflows"}
          </span>
        </div>

        {/* Lead List */}
            {leadsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
              </div>
            ) : leads && leads.length > 0 ? (
              <div className="space-y-3">
                {leads
                  .filter((lead: any) => {
                    const lt = (lead as any).leadType as string | undefined;
                    if (leadPod === "marketplace") {
                      // Default pod: artist marketplace opportunities
                      if (!lt) return true;
                      return lt === "scraped_signal" || lt === "client_submitted" || lt === "referral";
                    }
                    if (leadPod === "venue") {
                      // Venue intelligence + manual outreach
                      return lt === "venue_intelligence" || lt === "manual_outreach";
                    }
                    if (leadPod === "artist") {
                      // Artist acquisition placeholder: for now, surface client_submitted and referral leads
                      return lt === "client_submitted" || lt === "referral";
                    }
                    if (leadPod === "growth") {
                      // Growth / CRM placeholder: show everything for now
                      return true;
                    }
                    return true;
                  })
                  .map((lead) => (
                  <div key={lead.id} className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-slate-900 truncate">{lead.title}</h3>
                          {(lead as any).performerType && (
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium capitalize">
                              {(lead as any).performerType === 'dj' ? '🎧 DJ' :
                               (lead as any).performerType === 'solo_act' ? '🎤 Solo Act' :
                               (lead as any).performerType === 'small_band' ? '🎸 Small Band' :
                               (lead as any).performerType === 'large_band' ? '🎺 Large Band' :
                               (lead as any).performerType === 'singer' ? '🎙 Singer' :
                               (lead as any).performerType === 'instrumentalist' ? '🎹 Instrumentalist' :
                               (lead as any).performerType === 'photo_video' ? '📸 Photo/Video' :
                               (lead as any).performerType === 'photo_booth' ? '🖼 Photo Booth' :
                               (lead as any).performerType === 'makeup_artist' ? '💄 Makeup Artist' :
                               (lead as any).performerType === 'emcee' ? '🎙 Emcee' :
                               (lead as any).performerType === 'princess_character' ? '👑 Princess/Character' :
                               (lead as any).performerType === 'immersive_experience' ? '✨ Immersive' :
                               (lead as any).performerType === 'hybrid_electronic' ? '🎛 Hybrid Electronic' :
                               (lead as any).performerType === 'photographer' ? '📷 Photographer' :
                               (lead as any).performerType === 'videographer' ? '🎥 Videographer' :
                               (lead as any).performerType === 'audio_engineer' ? '🎙 Audio Engineer' :
                               (lead as any).performerType}
                            </span>
                          )}
                          {((lead as any).unlockPriceCents ?? 700) >= 1500 && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">⭐ Premium</span>
                          )}
                          <Badge
                            variant="outline"
                            className={
                              lead.isApproved ? "border-green-200 text-green-700 bg-green-50" :
                              lead.isRejected ? "border-red-200 text-red-700 bg-red-50" :
                              "border-amber-200 text-amber-700 bg-amber-50"
                            }
                          >
                            {lead.isApproved ? "Approved" : lead.isRejected ? "Rejected" : "Pending"}
                          </Badge>
                          {/* Source badge — Reddit, Facebook, DBPR, Inbound, etc. */}
                          <Badge
                            variant="outline"
                            className={
                              lead.source === 'eventbrite' ? 'border-orange-300 text-orange-700 bg-orange-50 font-semibold' :
                              lead.source === 'craigslist' ? 'border-purple-300 text-purple-700 bg-purple-50 font-semibold' :
                              lead.source === 'theknot' ? 'border-pink-300 text-pink-700 bg-pink-50 font-semibold' :
                              lead.source === 'weddingwire' ? 'border-rose-300 text-rose-700 bg-rose-50 font-semibold' :
                              lead.source === 'thumbtack' ? 'border-blue-300 text-blue-700 bg-blue-50 font-semibold' :
                              lead.source === 'facebook' ? 'border-indigo-300 text-indigo-700 bg-indigo-50 font-semibold' :
                              lead.source === 'reddit' ? 'border-orange-200 text-orange-700 bg-orange-50 font-semibold' :
                              lead.source === 'nextdoor' ? 'border-teal-300 text-teal-700 bg-teal-50 font-semibold' :
                              lead.source === 'manual' ? 'border-slate-400 text-slate-700 bg-slate-100 font-semibold' :
                              lead.source === 'inbound' ? 'border-green-300 text-green-700 bg-green-50 font-semibold' :
                              lead.source === 'dbpr' ? 'border-emerald-300 text-emerald-700 bg-emerald-50 font-semibold' :
                              lead.source === 'sunbiz' ? 'border-sky-300 text-sky-700 bg-sky-50 font-semibold' :
                              lead.source === 'google_maps' ? 'border-sky-200 text-sky-700 bg-sky-50 font-semibold' :
                              'border-violet-300 text-violet-700 bg-violet-50 font-semibold'
                            }
                          >
                            {(lead as any).sourceLabel ? String((lead as any).sourceLabel) :
                             lead.source === 'gigxo' ? 'Web Scraped' :
                             lead.source === 'eventbrite' ? 'Eventbrite' :
                             lead.source === 'craigslist' ? 'Craigslist' :
                             lead.source === 'reddit' ? 'Reddit' :
                             lead.source === 'facebook' ? 'Facebook' :
                             lead.source === 'thumbtack' ? 'Thumbtack' :
                             lead.source === 'inbound' ? 'Inbound' :
                             lead.source === 'dbpr' ? 'DBPR' :
                             lead.source === 'manual' ? 'Manual' :
                             lead.source ? String(lead.source).charAt(0).toUpperCase() + String(lead.source).slice(1) : 'Unknown'}
                          </Badge>
                          {/* Intent score */}
                          {(lead as any).intentScore != null && (
                            <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                              Score {(lead as any).intentScore}
                            </span>
                          )}
                          {/* Contact info indicator: green dot = has contact, gray = none */}
                          <span
                            className="inline-flex items-center gap-1 text-xs"
                            title={lead.contactEmail || lead.contactPhone ? "Has contact info" : "No contact info"}
                          >
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                lead.contactEmail || lead.contactPhone ? "bg-green-500" : "bg-slate-300"
                              }`}
                            />
                            {lead.contactEmail || lead.contactPhone ? "Contact" : "No contact"}
                          </span>
                          {(lead as any).leadType === "venue_intelligence" && (
                            <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50 font-semibold">
                              Venue Intelligence
                            </Badge>
                          )}
                          {(lead as any).leadTier && (
                            <Badge variant="outline" className="border-slate-300 text-slate-600 bg-slate-50 text-xs">
                              {(lead as any).leadTier === "starter_friendly" && "Starter"}
                              {(lead as any).leadTier === "standard" && "Standard"}
                              {(lead as any).leadTier === "premium" && "Premium"}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-500">
                          {lead.eventType} · {lead.location} · {formatBudget(lead.budget)}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {!lead.isApproved && !lead.isRejected && (
                          <div className="flex flex-wrap gap-1.5">
                            <Button
                              onClick={() => routeLead({ leadId: lead.id, action: "artist_lead", unlockPriceCents: (lead as any).leadTier === "starter_friendly" ? 100 : undefined })}
                              disabled={isRouting}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 h-8 text-xs"
                            >
                              🎵 Artist Lead
                            </Button>
                            <Button
                              onClick={() => routeLead({ leadId: lead.id, action: "venue_intel" })}
                              disabled={isRouting}
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 h-8 text-xs text-white"
                            >
                              🏢 Venue Intel
                            </Button>
                            <Button
                              onClick={() => routeLead({ leadId: lead.id, action: "client_request" })}
                              disabled={isRouting}
                              size="sm"
                              className="bg-purple-600 hover:bg-purple-700 h-8 text-xs text-white"
                            >
                              📋 Client Request
                            </Button>
                            <Button
                              onClick={() => routeLead({ leadId: lead.id, action: "reject", reason: "Quality check" })}
                              disabled={isRouting}
                              size="sm"
                              variant="outline"
                              className="border-red-200 text-red-600 hover:bg-red-50 h-8 text-xs"
                            >
                              <XCircle className="w-3.5 h-3.5 mr-0.5" />
                              Reject
                            </Button>
                          </div>
                        )}
                        {lead.isRejected && (
                          <Button
                            onClick={() => approveLead({ leadId: lead.id })}
                            disabled={isApproving}
                            size="sm"
                            variant="outline"
                            className="h-8"
                          >
                            Restore
                          </Button>
                        )}
                      </div>
                    </div>
                    {/* Raw text preview for quick routing decision */}
                    {lead.description && (
                      <div className="mb-2">
                        {/* Admin-visible source label extracted from description (if present) */}
                        {lead.description.includes("Source: ") && (
                          <p className="text-[11px] text-slate-500 mb-1">
                            <span className="font-semibold">Source slug:</span>{" "}
                            {lead.description
                              .split("\n")
                              .find((line) => line.startsWith("Source: "))
                              ?.replace("Source: ", "")
                              .trim() || "unknown"}
                          </p>
                        )}
                        <p className="text-sm text-slate-600 line-clamp-4 bg-slate-50 rounded-lg px-2 py-1.5 font-mono">
                          {lead.description}
                        </p>
                      </div>
                    )}

                    {/* Contact info — always visible to admin */}
                    <div className="bg-slate-50 rounded-lg px-3 py-2 mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                      {lead.contactName && <span className="font-medium text-slate-700">{lead.contactName}</span>}
                      {lead.contactEmail && (
                        <a href={`mailto:${lead.contactEmail}`} className="flex items-center gap-1 hover:text-purple-600">
                          <Mail className="w-3 h-3" />{lead.contactEmail}
                        </a>
                      )}
                      {lead.contactPhone && (
                        <a href={`tel:${lead.contactPhone}`} className="flex items-center gap-1 hover:text-purple-600">
                          <Phone className="w-3 h-3" />{lead.contactPhone}
                        </a>
                      )}
                      {(lead as any).venueUrl && (
                        <a href={(lead as any).venueUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium">
                          <ExternalLink className="w-3 h-3" />View Original Listing
                        </a>
                      )}
                    </div>

                    {/* Admin controls row */}
                    <div className="flex flex-wrap items-center gap-2 mt-2">

                      {lead.eventDate && <span className="text-xs text-slate-400">Date: {new Date(lead.eventDate).toLocaleDateString()}</span>}
                      <div className="flex-1" />

                      {/* Reserve for owner */}
                      <button
                        onClick={() => reserveLead({ leadId: lead.id, isReserved: !(lead as any).isReserved })}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                          (lead as any).isReserved ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                        title={(lead as any).isReserved ? "Reserved for you — click to release" : "Reserve this lead for yourself"}
                      >
                        {(lead as any).isReserved ? <BookmarkCheck className="w-3 h-3" /> : <Bookmark className="w-3 h-3" />}
                        {(lead as any).isReserved ? "Reserved" : "Reserve"}
                      </button>

                      {/* Toggle live/hidden */}
                      {lead.isApproved && (
                        <button
                          onClick={() => toggleHide({ leadId: lead.id, isHidden: !(lead as any).isHidden })}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                            (lead as any).isHidden ? "bg-red-100 text-red-600 hover:bg-red-200" : "bg-green-100 text-green-700 hover:bg-green-200"
                          }`}
                          title={(lead as any).isHidden ? "Hidden from artists — click to show" : "Visible to artists — click to hide"}
                        >
                          {(lead as any).isHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          {(lead as any).isHidden ? "Hidden" : "Live"}
                        </button>
                      )}

                      {/* Edit lead */}
                      <button
                        onClick={() => openEditModal(lead)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200"
                        title="Edit lead details"
                      >
                        ✏️ Edit
                      </button>

                      {/* Custom price */}
                      {editingPriceId === lead.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-500">$</span>
                          <input
                            type="number"
                            value={priceInput}
                            onChange={(e) => setPriceInput(e.target.value)}
                            className="w-16 h-6 text-xs border border-slate-300 rounded px-1"
                            placeholder="7"
                            min="1" max="999"
                          />
                          <button
                            onClick={() => { setLeadPrice({ leadId: lead.id, priceDollars: Number(priceInput) || 7 }); setEditingPriceId(null); }}
                            className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded hover:bg-purple-700"
                          >Set</button>
                          <button onClick={() => setEditingPriceId(null)} className="text-xs text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                      ) : (
                        <span className="flex items-center gap-1">
                          <button
                            onClick={() => { setEditingPriceId(lead.id); setPriceInput(String(((lead as any).unlockPriceCents ?? 700) / 100)); }}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200"
                            title="Set custom unlock price"
                          >
                            <DollarSign className="w-3 h-3" />
                            {(lead as any).unlockPriceCents ? `$${((lead as any).unlockPriceCents / 100).toFixed(0)}` : "$7"}
                          </button>
                          {(lead as any).unlockPriceCents != null && (
                            <button
                              onClick={() => setLeadPrice({ leadId: lead.id, clearOverride: true })}
                              className="text-xs text-slate-400 hover:text-slate-600"
                              title="Revert to auto price ($7 / $15 by budget)"
                            >
                              Use auto
                            </button>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">No {leadFilter} leads</p>
              </div>
            )}
          </div>

          {/* Right Panel: Add Lead */}
          <div>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900">Add Manual Lead</h2>
                <p className="text-xs text-slate-500 mt-0.5">Manually add high-quality gigs</p>
              </div>
              <div className="p-4">
                {!showAddForm ? (
                  <Button
                    onClick={() => setShowAddForm(true)}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add New Gig
                  </Button>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      addManualLead(formData);
                    }}
                    className="space-y-3"
                  >
                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">Title *</label>
                      <Input
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Wedding DJ Needed"
                        required
                        className="h-8 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">Description</label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Event details..."
                        rows={2}
                        className="text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-medium text-slate-600 block mb-1">Event Type</label>
                        <select
                          value={formData.eventType}
                          onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm h-8"
                        >
                          <option>Wedding</option>
                          <option>Corporate Event</option>
                          <option>Nightclub</option>
                          <option>Pool Party</option>
                          <option>Private Party</option>
                          <option>Festival</option>
                          <option>After Party</option>
                          <option>Bar Gig</option>
                          <option>Yacht Party</option>
                          <option>Art Opening</option>
                          <option>Charity Gala</option>
                          <option>Birthday Party</option>
                          <option>Quinceañera</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600 block mb-1">Performer Type</label>
                        <select
                          value={formData.performerType}
                          onChange={(e) => setFormData({ ...formData, performerType: e.target.value })}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm h-8"
                        >
                          <option value="dj">DJ</option>
                          <option value="singer">Singer</option>
                          <option value="solo_act">Solo Act</option>
                          <option value="small_band">Small Band</option>
                          <option value="large_band">Large Band</option>
                          <option value="instrumentalist">Instrumentalist</option>
                          <option value="immersive_experience">Immersive Experience</option>
                          <option value="hybrid_electronic">Hybrid Electronic</option>
                          <option value="photo_video">Photo/Video</option>
                          <option value="photo_booth">Photo Booth</option>
                          <option value="makeup_artist">Makeup Artist</option>
                          <option value="emcee">Emcee/Host</option>
                          <option value="princess_character">Princess/Character</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600 block mb-1">Budget ($)</label>
                        <Input
                          type="number"
                          value={formData.budget}
                          onChange={(e) => setFormData({ ...formData, budget: parseInt(e.target.value) || 0 })}
                          required
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">Location</label>
                      <Input
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        required
                        className="h-8 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">Event Date</label>
                      <Input
                        type="date"
                        value={formData.eventDate}
                        onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">Contact Name *</label>
                      <Input
                        value={formData.contactName}
                        onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                        required
                        className="h-8 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">Email *</label>
                      <Input
                        type="email"
                        value={formData.contactEmail}
                        onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                        required
                        className="h-8 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">Phone</label>
                      <Input
                        value={formData.contactPhone}
                        onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        type="submit"
                        disabled={isAdding}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 h-9"
                      >
                        {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Gig"}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setShowAddForm(false)}
                        variant="outline"
                        className="h-9"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
        </>
        )}

        {/* Edit Lead Modal */}
        {editingLeadId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader className="border-b">
                <CardTitle>Edit Lead</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Title</label>
                  <Input
                    value={editFormData.title}
                    onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                    className="h-9"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Location</label>
                  <Input
                    value={editFormData.location}
                    onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                    className="h-9"
                    placeholder="e.g., Miami, FL"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Event Type</label>
                    <Input
                      value={editFormData.eventType}
                      onChange={(e) => setEditFormData({ ...editFormData, eventType: e.target.value })}
                      className="h-9"
                      placeholder="e.g., Wedding"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Budget ($)</label>
                    <Input
                      type="number"
                      value={editFormData.budget}
                      onChange={(e) => setEditFormData({ ...editFormData, budget: e.target.value })}
                      className="h-9"
                      placeholder="e.g., 1000"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Description</label>
                  <Textarea
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    className="resize-none"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Lead type</label>
                    <select
                      value={editFormData.leadType}
                      onChange={(e) => setEditFormData({ ...editFormData, leadType: e.target.value })}
                      className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-400"
                    >
                      <option value="">—</option>
                      <option value="event_demand">Event demand</option>
                      <option value="venue_intelligence">Venue intelligence</option>
                      <option value="artist_signup">Artist signup</option>
                      <option value="outreach">Outreach</option>
                      <option value="trash">Trash</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Lead category</label>
                    <select
                      value={editFormData.leadCategory}
                      onChange={(e) => setEditFormData({ ...editFormData, leadCategory: e.target.value })}
                      className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-400"
                    >
                      <option value="">—</option>
                      <option value="wedding">Wedding</option>
                      <option value="corporate">Corporate</option>
                      <option value="yacht">Yacht</option>
                      <option value="club">Club</option>
                      <option value="private_party">Private party</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Lead tier</label>
                    <select
                      value={editFormData.leadTier ?? ""}
                      onChange={(e) => setEditFormData({ ...editFormData, leadTier: e.target.value || null })}
                      className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-400"
                    >
                      <option value="">—</option>
                      <option value="starter_friendly">Starter friendly</option>
                      <option value="standard">Standard</option>
                      <option value="premium">Premium</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Status</label>
                    <select
                      value={editFormData.status}
                      onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                      className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-400"
                    >
                      <option value="">—</option>
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="interested">Interested</option>
                      <option value="partner">Partner</option>
                      <option value="declined">Declined</option>
                      <option value="dead">Dead</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Follow-up date</label>
                    <Input
                      type="datetime-local"
                      value={editFormData.followUpAt}
                      onChange={(e) => setEditFormData({ ...editFormData, followUpAt: e.target.value })}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="text-sm font-medium text-slate-700 block mb-1">Unlock Price ($)</label>
                  <Input
                    type="number"
                    min={1}
                    max={999}
                    step={0.5}
                    placeholder="e.g. 3.00"
                    value={editFormData.unlockPriceDollars}
                    onChange={(e) => setEditFormData({ ...editFormData, unlockPriceDollars: e.target.value })}
                    className="h-9"
                  />
                    <p className="mt-1 text-xs text-slate-500">
                      Leave blank to use tier pricing ($3/$7/$15). Set a custom price to override.
                    </p>
                </div>

                <div className="mt-4">
                  <label className="text-sm font-medium text-slate-700 block mb-1">Notes</label>
                  <Textarea
                    value={editFormData.notes}
                    onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                    className="resize-none"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Contact Name</label>
                    <Input
                      value={editFormData.contactName}
                      onChange={(e) => setEditFormData({ ...editFormData, contactName: e.target.value })}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Contact Email</label>
                    <Input
                      type="email"
                      value={editFormData.contactEmail}
                      onChange={(e) => setEditFormData({ ...editFormData, contactEmail: e.target.value })}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setEditingLeadId(null)}
                    disabled={isUpdating}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveEdit}
                    disabled={isUpdating}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
