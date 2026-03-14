import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  ExternalLink,
  RefreshCw,
  Save,
  Trash2,
  Plus,
  History,
  Filter,
  ToggleLeft,
  MessageSquare,
  Target,
  Mail,
  Send,
  Users,
  CreditCard,
  Building2,
} from "lucide-react";
import { toast } from "sonner";

const OUTREACH_DEFAULT_SUBJECT = "Gigxo DJ partnership";
const OUTREACH_DEFAULT_BODY = `Hi,

I help run Gigxo, a platform connecting venues with DJs and live performers.

We noticed your venue and wanted to see if you'd like to be included on our recommended vendor list.

Best,
Tiffani
Gigxo`;

// ─── Search Goal presets: apply multiple filters at once ─────────────────────
const SEARCH_GOAL_PRESETS = [
  { id: "", label: "None (manual filters)" },
  { id: "new_opportunities", label: "New opportunities (last 3 days)", dateFromRelativeDays: 3, minIntentScore: 60, status: "pending" },
  { id: "new_24h", label: "New in last 24 hours", dateFromRelativeDays: 1, status: "all" },
  { id: "new_3d", label: "New in last 3 days", dateFromRelativeDays: 3, status: "all" },
  { id: "new_7d", label: "New in last 7 days", dateFromRelativeDays: 7, status: "all" },
  { id: "wedding_dj", label: "Wedding DJ leads", performerType: "dj", includePhraseSetId: "wedding_dj" },
  { id: "birthday_party", label: "Birthday / private party leads", performerType: "dj", includePhraseSetId: "party_dj" },
  { id: "corporate", label: "Corporate event leads", performerType: "dj", includePhraseSetId: "corporate_entertainment" },
  { id: "south_florida", label: "South Florida local only", location: "Miami, FL", includePhraseSetId: "dj_miami" },
  { id: "high_intent", label: "High-intent only", minIntentScore: 70 },
  { id: "recommendations", label: "Recommendation-style posts", includePhraseSetId: "recommend_dj" },
  { id: "last_7_days", label: "Last 7 days only", dateFromRelativeDays: 7 },
  { id: "budget_mentioned", label: "Budget-mentioned leads", searchText: "budget" },
  { id: "venue_organizer", label: "Venue / organizer leads", includePhraseSetId: "venue_organizer" },
  { id: "broad", label: "Broad discovery mode" },
  { id: "dbpr_venue_intel", label: "DBPR venue intelligence", sources: ["dbpr"], leadType: "venue_intelligence" },
  { id: "venue_with_phone", label: "Venue leads with phone", leadType: "venue_intelligence", hasPhone: true },
  { id: "venue_with_email", label: "Venue leads with email", leadType: "venue_intelligence", hasEmail: true },
  { id: "missing_contact", label: "Leads missing contact info", missingContact: true },
  { id: "reddit_craigslist_active", label: "Reddit/Craigslist active opportunities", sources: ["reddit", "craigslist"], status: "pending" },
  { id: "manual_outreach_candidates", label: "Manual outreach candidates", leadType: "venue_intelligence", hasVenueUrl: true },
  { id: "yacht_boat_opportunities", label: "Yacht / boat opportunities", leadCategory: "yacht_boat", hasVenueUrl: true },
  { id: "high_intent_active", label: "High-intent active opportunities", minIntentScore: 75, status: "pending" },
  { id: "venue_intel_all", label: "All venue intelligence leads", leadType: "venue_intelligence" },
  { id: "with_contact_info", label: "Leads with contact info", hasEmail: true, hasPhone: true },
  { id: "venue_pipeline", label: "Venue Pipeline", leadType: "venue_intelligence" },
];

// ─── Include phrase set presets (title/description must match any phrase) ──────
const INCLUDE_PHRASE_SETS: { id: string; label: string; phrases: string[] }[] = [
  { id: "looking_for_dj", label: "Looking for a DJ", phrases: ["looking for a dj", "looking for dj"] },
  { id: "need_a_dj", label: "Need a DJ", phrases: ["need a dj", "need a dj for"] },
  { id: "hire_dj", label: "Hire a DJ", phrases: ["hire a dj", "hiring a dj"] },
  { id: "book_dj", label: "Book a DJ", phrases: ["book a dj", "booking a dj"] },
  { id: "recommend_dj", label: "Recommend a DJ", phrases: ["recommend a dj", "recommendation for a dj", "can anyone recommend a dj"] },
  { id: "wedding_dj", label: "Wedding DJ", phrases: ["wedding dj", "dj for wedding", "dj for my wedding"] },
  { id: "party_dj", label: "Party DJ", phrases: ["party dj", "dj for party", "dj for my party"] },
  { id: "entertainment_wedding", label: "Entertainment for wedding", phrases: ["entertainment for wedding", "wedding entertainment"] },
  { id: "dj_reception", label: "DJ for reception", phrases: ["dj for reception", "reception dj"] },
  { id: "dj_birthday", label: "DJ for birthday", phrases: ["dj for birthday", "birthday party dj"] },
  { id: "dj_miami", label: "DJ in Miami", phrases: ["dj in miami", "miami dj", "dj miami"] },
  { id: "dj_fort_lauderdale", label: "DJ in Fort Lauderdale", phrases: ["dj in fort lauderdale", "fort lauderdale dj"] },
  { id: "live_music_event", label: "Live music for event", phrases: ["live music for event", "live music for our", "live band for event"] },
  { id: "band_or_dj", label: "Band or DJ", phrases: ["band or dj", "dj or band"] },
  { id: "vendor_recommendations", label: "Vendor recommendations", phrases: ["vendor recommendations", "vendor recs", "looking for vendors"] },
  { id: "corporate_entertainment", label: "Corporate entertainment", phrases: ["corporate entertainment", "corporate event dj", "company party"] },
  { id: "venue_organizer", label: "Venue / organizer", phrases: ["venue looking", "we are a venue", "event space", "looking for entertainment for our"] },
];

// ─── Exclude noise set presets (title/description must not match any phrase) ──
const EXCLUDE_NOISE_SETS: { id: string; label: string; phrases: string[] }[] = [
  { id: "celebrity_news", label: "Celebrity / news", phrases: ["khaled", "akademiks", "net worth", "album", "sneakers", "celebrity"] },
  { id: "sports", label: "Sports", phrases: ["nfl", "dolphins", "coach", "linebacker", "gm", "general manager", "assistant coach", "bills", "ucla"] },
  { id: "dj_gear_software", label: "DJ gear / software", phrases: ["controller", "cdj", "mixer", "serato", "rekordbox", "traktor", "software", "plugin", "headphones", "speaker", "monitors", "audio interface", "turntable", "equipment", "gear", "pcdj", "compatible", "laptop", "soundcard"] },
  { id: "producer_audio", label: "Producer / audio-engineering", phrases: ["producer", "audio engineering", "mixing", "mastering", "beat", "production"] },
  { id: "nightlife_chatter", label: "Nightlife chatter", phrases: ["nightclub", "club night", "dj set", "dj sets", "playing at"] },
  { id: "festival_concert", label: "Festival / concert announcements", phrases: ["festival lineup", "concert", "tour dates", "announcing"] },
  { id: "job_listings", label: "Job listings", phrases: ["now hiring", "job opening", "apply now", "salary", "full-time", "part-time"] },
];

const SOURCE_OPTIONS = [
  { value: "reddit", label: "Reddit" },
  { value: "eventbrite", label: "Eventbrite" },
  { value: "craigslist", label: "Craigslist" },
  { value: "facebook", label: "Facebook" },
  { value: "manual", label: "Manual" },
  { value: "inbound", label: "Inbound" },
  { value: "dbpr", label: "DBPR" },
  { value: "sunbiz", label: "Sunbiz" },
];

const PERFORMER_TYPES = [
  "dj",
  "solo_act",
  "small_band",
  "large_band",
  "singer",
  "instrumentalist",
  "other",
];

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

function formatDate(d: Date | string | null) {
  if (!d) return "—";
  const x = typeof d === "string" ? new Date(d) : d;
  return x.toLocaleString();
}

function monetizationLabel(type: string | null | undefined): string {
  if (!type) return "—";
  const m: Record<string, string> = {
    artist_unlock: "Artist lead",
    venue_outreach: "Outreach",
    venue_subscription: "Subscription",
    direct_client_pipeline: "Client pipeline",
  };
  return m[type] ?? type;
}

function approvalStatus(lead: { isApproved: boolean; isRejected: boolean }) {
  if (lead.isApproved) return "approved";
  if (lead.isRejected) return "rejected";
  return "pending";
}

function getDateFromRelativeDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 16);
}

export default function AdminLeadsExplorer() {
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [sources, setSources] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [performerType, setPerformerType] = useState<string>("");
  const [minIntentScore, setMinIntentScore] = useState<string>("");
  const [status, setStatus] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchText, setSearchText] = useState("");
  const [searchGoalId, setSearchGoalId] = useState("broad");
  const [includePhraseSetId, setIncludePhraseSetId] = useState("");
  const [excludePhraseSetId, setExcludePhraseSetId] = useState("");
  const [customIncludePhrase, setCustomIncludePhrase] = useState("");
  const [customExcludePhrase, setCustomExcludePhrase] = useState("");
  const [savedSearchName, setSavedSearchName] = useState("");
  const [phraseSetName, setPhraseSetName] = useState("");
  const [phraseSetType, setPhraseSetType] = useState<"include" | "exclude">("include");
  const [leadType, setLeadType] = useState<string>("");
  const [leadCategory, setLeadCategory] = useState<string>("");
  const [hasEmail, setHasEmail] = useState(false);
  const [hasPhone, setHasPhone] = useState(false);
  const [hasVenueUrl, setHasVenueUrl] = useState(false);
  const [missingContact, setMissingContact] = useState(false);
  const [leadMonetizationType, setLeadMonetizationType] = useState("");
  const [outreachStatusFilter, setOutreachStatusFilter] = useState("");
  const [venueClientStatusFilter, setVenueClientStatusFilter] = useState("");
  const [subscriptionVisibilityFilter, setSubscriptionVisibilityFilter] = useState<"" | "yes" | "no">("");
  const [regionTag, setRegionTag] = useState("");
  const [outreachLead, setOutreachLead] = useState<{ id: number; title: string | null; contactEmail: string | null; venueEmail?: string | null } | null>(null);
  const [outreachTemplateId, setOutreachTemplateId] = useState<"venue_intro" | "follow_up" | "performer_supply">("venue_intro");
  const [outreachSubject, setOutreachSubject] = useState(OUTREACH_DEFAULT_SUBJECT);
  const [outreachBody, setOutreachBody] = useState(OUTREACH_DEFAULT_BODY);
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);

  const includePhrasesFromSet = useMemo(() => {
    if (!includePhraseSetId) return [];
    const set = INCLUDE_PHRASE_SETS.find((s) => s.id === includePhraseSetId);
    return set?.phrases ?? [];
  }, [includePhraseSetId]);

  const excludePhrasesFromSet = useMemo(() => {
    if (!excludePhraseSetId) return [];
    const set = EXCLUDE_NOISE_SETS.find((s) => s.id === excludePhraseSetId);
    return set?.phrases ?? [];
  }, [excludePhraseSetId]);

  const customIncludeList = useMemo(
    () => customIncludePhrase.split(/[\n,]+/).map((p) => p.trim()).filter(Boolean),
    [customIncludePhrase]
  );
  const customExcludeList = useMemo(
    () => customExcludePhrase.split(/[\n,]+/).map((p) => p.trim()).filter(Boolean),
    [customExcludePhrase]
  );

  const includePhrases = useMemo(
    () => [...includePhrasesFromSet, ...customIncludeList],
    [includePhrasesFromSet, customIncludeList]
  );
  const excludePhrases = useMemo(
    () => [...excludePhrasesFromSet, ...customExcludeList],
    [excludePhrasesFromSet, customExcludeList]
  );

  const filters = useMemo(
    () => ({
      limit,
      offset,
      sources: sources.length ? sources : undefined,
      location: location.trim() || undefined,
      performerType: performerType || undefined,
      minIntentScore: minIntentScore === "" ? undefined : parseInt(minIntentScore, 10),
      status,
      dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      dateTo: dateTo ? new Date(dateTo).toISOString() : undefined,
      searchText: searchText.trim() || undefined,
      includePhrases: includePhrases.length ? includePhrases : undefined,
      excludePhrases: excludePhrases.length ? excludePhrases : undefined,
      leadType: leadType || undefined,
      leadCategory: leadCategory || undefined,
      hasEmail: hasEmail || undefined,
      hasPhone: hasPhone || undefined,
      hasVenueUrl: hasVenueUrl || undefined,
      missingContact: missingContact || undefined,
      leadMonetizationType: leadMonetizationType || undefined,
      outreachStatus: outreachStatusFilter || undefined,
      venueClientStatus: venueClientStatusFilter || undefined,
      subscriptionVisibility: subscriptionVisibilityFilter === "yes" ? true : subscriptionVisibilityFilter === "no" ? false : undefined,
      regionTag: regionTag || undefined,
    }),
    [
      limit,
      offset,
      sources,
      location,
      performerType,
      minIntentScore,
      status,
      dateFrom,
      dateTo,
      searchText,
      leadType,
      leadCategory,
      hasEmail,
      hasPhone,
      hasVenueUrl,
      missingContact,
      leadMonetizationType,
      outreachStatusFilter,
      venueClientStatusFilter,
      subscriptionVisibilityFilter,
      regionTag,
      includePhrases,
      excludePhrases,
    ]
  );

  const { data: explorerData, isLoading: explorerLoading, refetch: refetchExplorer } = trpc.admin.getLeadsExplorer.useQuery(filters);
  const { data: runHistory, refetch: refetchRuns } = trpc.admin.getScraperRunHistory.useQuery({ limit: 50 });
  const { data: sourceToggles, refetch: refetchToggles } = trpc.admin.getSourceToggles.useQuery();
  const { data: phraseSets, refetch: refetchPhraseSets } = trpc.admin.getPhraseSets.useQuery();
  const { data: savedSearches, refetch: refetchSavedSearches } = trpc.admin.getSavedSearches.useQuery();

  const setSourceToggleMutation = trpc.admin.setSourceToggles.useMutation({
    onSuccess: () => {
      refetchToggles();
      toast.success("Source toggle updated");
    },
    onError: (e) => toast.error(e.message),
  });
  const savePhraseSetMutation = trpc.admin.savePhraseSet.useMutation({
    onSuccess: () => {
      refetchPhraseSets();
      setPhraseSetName("");
      toast.success("Phrase set saved");
    },
    onError: (e) => toast.error(e.message),
  });
  const deletePhraseSetMutation = trpc.admin.deletePhraseSet.useMutation({
    onSuccess: () => {
      refetchPhraseSets();
      toast.success("Phrase set deleted");
    },
    onError: (e) => toast.error(e.message),
  });
  const saveSearchMutation = trpc.admin.saveSearch.useMutation({
    onSuccess: () => {
      refetchSavedSearches();
      setSavedSearchName("");
      toast.success("Search saved");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteSavedSearchMutation = trpc.admin.deleteSavedSearch.useMutation({
    onSuccess: () => {
      refetchSavedSearches();
      toast.success("Saved search deleted");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateLeadMutation = trpc.admin.updateLead.useMutation({
    onSuccess: () => refetchExplorer(),
    onError: (e) => toast.error(e.message),
  });
  const setMonetizationMutation = trpc.admin.setLeadMonetization.useMutation({
    onSuccess: () => {
      refetchExplorer();
      toast.success("Monetization updated");
    },
    onError: (e) => toast.error(e.message),
  });
  const sendOutreachMutation = trpc.admin.sendOutreach.useMutation({
    onSuccess: (result) => {
      refetchExplorer();
      setOutreachLead(null);
      if (result.noOutreachableEmail) toast.error("No outreachable email");
      else if (result.success) toast.success("Outreach sent");
      else toast.error(result.message ?? "Send failed");
    },
    onError: (e) => toast.error(e.message),
  });
  const { data: outreachTemplates } = trpc.admin.getOutreachTemplates.useQuery(undefined, { enabled: !!outreachLead });

  const hasOutreachableEmail = (lead: { contactEmail?: string | null; venueEmail?: string | null }) =>
    !!(lead.venueEmail?.trim() || lead.contactEmail?.trim());

  const handleBulkLeadType = async (leadType: "trash" | "event_demand" | "venue_intelligence") => {
    const ids = [...selectedLeadIds];
    if (ids.length === 0) return;
    const labels = { trash: "trash", event_demand: "event demand", venue_intelligence: "venue intelligence" };
    try {
      for (const leadId of ids) {
        await updateLeadMutation.mutateAsync({ leadId, leadType });
      }
      setSelectedLeadIds([]);
      toast.success(`Marked ${ids.length} as ${labels[leadType]}`);
    } catch {
      // onError already toasts
    }
  };

  const applySearchGoal = (goalId: string) => {
    const preset = SEARCH_GOAL_PRESETS.find((g) => g.id === goalId);
    setSearchGoalId(goalId);
    // "None (manual filters)" or "Broad" → reset to least-restrictive state so Explorer shows all leads
    if (!preset || goalId === "broad" || goalId === "") {
      setSources([]);
      setPerformerType("");
      setLocation("");
      setDateFrom("");
      setDateTo("");
      setMinIntentScore("");
      setSearchText("");
      setIncludePhraseSetId("");
      setExcludePhraseSetId("");
      setCustomIncludePhrase("");
      setCustomExcludePhrase("");
      setLeadType("");
      setLeadCategory("");
      setHasEmail(false);
      setHasPhone(false);
      setHasVenueUrl(false);
      setMissingContact(false);
      setLeadMonetizationType("");
      setOutreachStatusFilter("");
      setVenueClientStatusFilter("");
      setSubscriptionVisibilityFilter("");
      setRegionTag("");
      setStatus("all");
      setOffset(0);
      return;
    }
    if ("performerType" in preset && preset.performerType !== undefined) setPerformerType(preset.performerType);
    if ("location" in preset && preset.location !== undefined) setLocation(preset.location);
    if ("minIntentScore" in preset && preset.minIntentScore !== undefined) setMinIntentScore(String(preset.minIntentScore));
    if ("dateFromRelativeDays" in preset && preset.dateFromRelativeDays !== undefined) setDateFrom(getDateFromRelativeDays(preset.dateFromRelativeDays));
    if ("searchText" in preset && preset.searchText !== undefined) setSearchText(preset.searchText);
    if ("includePhraseSetId" in preset && preset.includePhraseSetId !== undefined) setIncludePhraseSetId(preset.includePhraseSetId);
    if ("sources" in preset && preset.sources !== undefined) setSources(preset.sources as string[]);
    if ("leadType" in preset && preset.leadType !== undefined) setLeadType(preset.leadType);
    if ("leadCategory" in preset && preset.leadCategory !== undefined) setLeadCategory(preset.leadCategory);
    if ("hasEmail" in preset && preset.hasEmail !== undefined) setHasEmail(!!preset.hasEmail);
    if ("hasPhone" in preset && preset.hasPhone !== undefined) setHasPhone(!!preset.hasPhone);
    if ("hasVenueUrl" in preset && preset.hasVenueUrl !== undefined) setHasVenueUrl(!!preset.hasVenueUrl);
    if ("missingContact" in preset && preset.missingContact !== undefined) setMissingContact(!!preset.missingContact);
    if ("status" in preset && preset.status !== undefined) setStatus(preset.status as any);
    setOffset(0);
  };

  const applySavedSearch = (filterJson: Record<string, unknown>) => {
    if (typeof filterJson.sources !== "undefined" && Array.isArray(filterJson.sources)) setSources(filterJson.sources as string[]);
    if (typeof filterJson.location === "string") setLocation(filterJson.location);
    if (typeof filterJson.performerType === "string") setPerformerType(filterJson.performerType);
    if (typeof filterJson.minIntentScore === "number") setMinIntentScore(String(filterJson.minIntentScore));
    if (typeof filterJson.status === "string" && STATUS_OPTIONS.some((o) => o.value === filterJson.status)) setStatus(filterJson.status as "all" | "pending" | "approved" | "rejected");
    if (typeof filterJson.dateFrom === "string") setDateFrom(filterJson.dateFrom.slice(0, 16));
    if (typeof filterJson.dateTo === "string") setDateTo(filterJson.dateTo.slice(0, 16));
    if (typeof filterJson.searchText === "string") setSearchText(filterJson.searchText);
    if (typeof filterJson.searchGoalId === "string") setSearchGoalId(filterJson.searchGoalId);
    if (typeof filterJson.includePhraseSetId === "string") setIncludePhraseSetId(filterJson.includePhraseSetId);
    if (typeof filterJson.excludePhraseSetId === "string") setExcludePhraseSetId(filterJson.excludePhraseSetId);
    if (typeof filterJson.includePhrases === "object" && Array.isArray(filterJson.includePhrases)) {
      const custom = (filterJson.includePhrases as string[]).filter((p) => !INCLUDE_PHRASE_SETS.some((s) => s.phrases.includes(p)));
      setCustomIncludePhrase(custom.join(", "));
    }
    if (typeof filterJson.excludePhrases === "object" && Array.isArray(filterJson.excludePhrases)) {
      const custom = (filterJson.excludePhrases as string[]).filter((p) => !EXCLUDE_NOISE_SETS.some((s) => s.phrases.includes(p)));
      setCustomExcludePhrase(custom.join(", "));
    }
    setOffset(0);
  };

  const items = explorerData?.items ?? [];
  const total = explorerData?.total ?? 0;
  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  const summary = useMemo(() => {
    const windowCount = total;
    const highIntentCount = items.filter((l) => (l.intentScore ?? 0) >= 70).length;
    const venueIntelCount = items.filter((l) => l.leadType === "venue_intelligence" || l.leadCategory === "venue_intelligence").length;
    const withContactCount = items.filter((l) => l.contactEmail || l.contactPhone).length;
    return { windowCount, highIntentCount, venueIntelCount, withContactCount };
  }, [items, total]);

  const saveSearchPayload = useMemo(
    () => ({
      ...filters,
      offset: 0,
      searchGoalId,
      includePhraseSetId: includePhraseSetId || undefined,
      excludePhraseSetId: excludePhraseSetId || undefined,
      includePhrases: includePhrases.length ? includePhrases : undefined,
      excludePhrases: excludePhrases.length ? excludePhrases : undefined,
    }),
    [filters, searchGoalId, includePhraseSetId, excludePhraseSetId, includePhrases, excludePhrases]
  );

  return (
    <DashboardLayout>
      <div className="w-full max-w-[1600px] mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Lead Search Console</h1>
          <p className="text-muted-foreground mt-1">Browse, search, and organize leads. Each lead has a money path: Artist lead, Outreach, Subscription pool, or Client pipeline—set and filter below.</p>
        </div>

        <Tabs defaultValue="explorer" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="explorer">
              <Search className="w-4 h-4 mr-2" />
              Leads Explorer
            </TabsTrigger>
            <TabsTrigger value="toggles">
              <ToggleLeft className="w-4 h-4 mr-2" />
              Source Toggles
            </TabsTrigger>
            <TabsTrigger value="phrases">
              <MessageSquare className="w-4 h-4 mr-2" />
              Phrase Management
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="w-4 h-4 mr-2" />
              Run History
            </TabsTrigger>
          </TabsList>

          {/* ─── Leads Explorer ───────────────────────────────────────────────── */}
          <TabsContent value="explorer" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Guided search
                </CardTitle>
                <CardDescription>Start with a goal or phrase set, then refine with filters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Search Goal preset */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Search goal
                  </Label>
                  <Select value={searchGoalId || "none"} onValueChange={(v) => applySearchGoal(v === "none" ? "" : v)}>
                    <SelectTrigger className="max-w-md">
                      <SelectValue placeholder="Choose a preset…" />
                    </SelectTrigger>
                    <SelectContent>
                      {SEARCH_GOAL_PRESETS.map((g) => (
                        <SelectItem key={g.id || "none"} value={g.id || "none"}>
                          {g.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Include / Exclude phrase sets + custom */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label>Include phrase set</Label>
                    <Select value={includePhraseSetId || "none"} onValueChange={(v) => setIncludePhraseSetId(v === "none" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Optional: must match any phrase…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {INCLUDE_PHRASE_SETS.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Custom include phrases (comma or newline)</Label>
                      <Input
                        placeholder="e.g. private event, backyard party"
                        value={customIncludePhrase}
                        onChange={(e) => setCustomIncludePhrase(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label>Exclude noise set</Label>
                    <Select value={excludePhraseSetId || "none"} onValueChange={(v) => setExcludePhraseSetId(v === "none" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Optional: hide posts matching…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {EXCLUDE_NOISE_SETS.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Custom exclude phrases (comma or newline)</Label>
                      <Input
                        placeholder="e.g. giveaway, spam"
                        value={customExcludePhrase}
                        onChange={(e) => setCustomExcludePhrase(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Source, location, score, status, date */}
                <div className="border-t pt-4 space-y-4">
                  <Label className="text-muted-foreground">Filters</Label>
                  <div className="flex flex-wrap gap-2">
                    {SOURCE_OPTIONS.map((opt) => {
                      const on = sources.includes(opt.value);
                      return (
                        <Badge
                          key={opt.value}
                          variant={on ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => setSources(on ? sources.filter((s) => s !== opt.value) : [...sources, opt.value])}
                        >
                          {opt.label}
                        </Badge>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Location / city</Label>
                      <Input placeholder="e.g. Miami" value={location} onChange={(e) => setLocation(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Performer type</Label>
                      <Select value={performerType || "all"} onValueChange={(v) => setPerformerType(v === "all" ? "" : v)}>
                        <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          {PERFORMER_TYPES.map((p) => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Min intent score (0–100)</Label>
                      <Input type="number" min={0} max={100} placeholder="—" value={minIntentScore} onChange={(e) => setMinIntentScore(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Status</Label>
                      <Select value={status} onValueChange={(v: "all" | "pending" | "approved" | "rejected") => setStatus(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Date from</Label>
                      <Input type="datetime-local" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Date to</Label>
                      <Input type="datetime-local" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Text search (title + description)</Label>
                      <Input placeholder="Optional keyword…" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Lead type</Label>
                      <Select value={leadType || "all"} onValueChange={(v) => setLeadType(v === "all" ? "" : v)}>
                        <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="scraped_signal">Scraped signal</SelectItem>
                          <SelectItem value="client_submitted">Client submitted</SelectItem>
                          <SelectItem value="venue_intelligence">Venue intelligence</SelectItem>
                          <SelectItem value="referral">Referral</SelectItem>
                          <SelectItem value="manual_outreach">Manual outreach</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Lead category</Label>
                      <Select value={leadCategory || "all"} onValueChange={(v) => setLeadCategory(v === "all" ? "" : v)}>
                        <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="general">General</SelectItem>
                          <SelectItem value="wedding">Wedding</SelectItem>
                          <SelectItem value="corporate">Corporate</SelectItem>
                          <SelectItem value="private_party">Private party</SelectItem>
                          <SelectItem value="club">Club</SelectItem>
                          <SelectItem value="venue_intelligence">Venue intelligence</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch id="hasEmail" checked={hasEmail} onCheckedChange={setHasEmail} />
                      <Label htmlFor="hasEmail" className="text-xs">Has email</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch id="hasPhone" checked={hasPhone} onCheckedChange={setHasPhone} />
                      <Label htmlFor="hasPhone" className="text-xs">Has phone</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch id="hasVenueUrl" checked={hasVenueUrl} onCheckedChange={setHasVenueUrl} />
                      <Label htmlFor="hasVenueUrl" className="text-xs">Has venue URL</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch id="missingContact" checked={missingContact} onCheckedChange={setMissingContact} />
                      <Label htmlFor="missingContact" className="text-xs">Missing contact (no email/phone)</Label>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-2 border-t">
                    <div className="space-y-1">
                      <Label className="text-xs">Monetization path</Label>
                      <Select value={leadMonetizationType || "any"} onValueChange={(v) => setLeadMonetizationType(v === "any" ? "" : v)}>
                        <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any</SelectItem>
                          <SelectItem value="artist_unlock">Sell to Artists</SelectItem>
                          <SelectItem value="venue_outreach">Venue Outreach</SelectItem>
                          <SelectItem value="venue_subscription">Subscription Pool</SelectItem>
                          <SelectItem value="direct_client_pipeline">Client Pipeline</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Outreach status</Label>
                      <Select value={outreachStatusFilter || "any"} onValueChange={(v) => setOutreachStatusFilter(v === "any" ? "" : v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any</SelectItem>
                          <SelectItem value="not_sent">Not sent</SelectItem>
                          <SelectItem value="sent">Sent</SelectItem>
                          <SelectItem value="replied">Replied</SelectItem>
                          <SelectItem value="interested">Interested</SelectItem>
                          <SelectItem value="not_interested">Not interested</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Client status</Label>
                      <Select value={venueClientStatusFilter || "any"} onValueChange={(v) => setVenueClientStatusFilter(v === "any" ? "" : v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any</SelectItem>
                          <SelectItem value="prospect">Prospect</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="qualified">Qualified</SelectItem>
                          <SelectItem value="active_client">Active client</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Sub visible</Label>
                      <Select value={subscriptionVisibilityFilter || "any"} onValueChange={(v) => setSubscriptionVisibilityFilter((v === "any" ? "" : v) as "" | "yes" | "no")}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any</SelectItem>
                          <SelectItem value="yes">Yes</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Region</Label>
                      <Select value={regionTag || "any"} onValueChange={(v) => setRegionTag(v === "any" ? "" : v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any</SelectItem>
                          <SelectItem value="miami">Miami</SelectItem>
                          <SelectItem value="fort_lauderdale">Fort Lauderdale</SelectItem>
                          <SelectItem value="boca">Boca</SelectItem>
                          <SelectItem value="west_palm">West Palm</SelectItem>
                          <SelectItem value="south_florida">South Florida</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Search + Save */}
                <div className="flex flex-wrap gap-3 items-center border-t pt-4">
                  <Button onClick={() => refetchExplorer()} disabled={explorerLoading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${explorerLoading ? "animate-spin" : ""}`} />
                    Search
                  </Button>
                  <div className="flex gap-2 items-center">
                    <Input
                      placeholder="Save search as…"
                      className="w-44"
                      value={savedSearchName}
                      onChange={(e) => setSavedSearchName(e.target.value)}
                    />
                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (!savedSearchName.trim()) {
                          toast.error("Enter a name");
                          return;
                        }
                        saveSearchMutation.mutate({ name: savedSearchName.trim(), filterJson: saveSearchPayload });
                      }}
                      disabled={!savedSearchName.trim() || saveSearchMutation.isPending}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save search
                    </Button>
                  </div>
                </div>
                {savedSearches && savedSearches.length > 0 && (
                  <div className="flex flex-wrap gap-2 items-center">
                    <Label className="text-xs text-muted-foreground w-full">Saved searches</Label>
                    {savedSearches.map((s) => (
                      <div key={s.id} className="flex items-center gap-1">
                        <Button variant="outline" size="sm" onClick={() => applySavedSearch(s.filterJson as Record<string, unknown>)}>
                          {s.name}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteSavedSearchMutation.mutate({ id: s.id })}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <CardTitle>Results ({total})</CardTitle>
                    <CardDescription>Page {currentPage} of {totalPages || 1}</CardDescription>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                    <div>
                      <span className="font-semibold text-foreground block">{summary.windowCount}</span>
                      <span>Leads in current window</span>
                    </div>
                    <div>
                      <span className="font-semibold text-foreground block">{summary.highIntentCount}</span>
                      <span>High-intent (≥ 70)</span>
                    </div>
                    <div>
                      <span className="font-semibold text-foreground block">{summary.venueIntelCount}</span>
                      <span>Venue intelligence</span>
                    </div>
                    <div>
                      <span className="font-semibold text-foreground block">{summary.withContactCount}</span>
                      <span>With contact info</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {explorerLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    {selectedLeadIds.length > 0 && (
                      <div className="flex items-center gap-2 mb-3 py-2 px-3 rounded-md border bg-muted/50 text-sm">
                        <span className="font-medium">{selectedLeadIds.length} selected</span>
                        <Button variant="outline" size="sm" onClick={() => handleBulkLeadType("trash")} disabled={updateLeadMutation.isPending}>
                          Mark as trash
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleBulkLeadType("event_demand")} disabled={updateLeadMutation.isPending}>
                          Mark as event demand
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleBulkLeadType("venue_intelligence")} disabled={updateLeadMutation.isPending}>
                          Mark as venue intelligence
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedLeadIds([])}>
                          Clear
                        </Button>
                      </div>
                    )}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={items.length > 0 && items.every((l) => selectedLeadIds.includes(l.id))}
                              onCheckedChange={(checked) => {
                                if (checked) setSelectedLeadIds(items.map((l) => l.id));
                                else setSelectedLeadIds([]);
                              }}
                              aria-label="Select all"
                            />
                          </TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Intent</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-xs">Monet / Outreach</TableHead>
                          <TableHead>URL</TableHead>
                          <TableHead>Outreach</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                              No leads match the current filters.
                            </TableCell>
                          </TableRow>
                        ) : (
                          items.map((lead) => (
                            <TableRow key={lead.id}>
                              <TableCell className="w-10">
                                <Checkbox
                                  checked={selectedLeadIds.includes(lead.id)}
                                  onCheckedChange={(checked) => {
                                    setSelectedLeadIds((prev) =>
                                      checked ? [...prev, lead.id] : prev.filter((id) => id !== lead.id)
                                    );
                                  }}
                                  aria-label={`Select lead ${lead.id}`}
                                />
                              </TableCell>
                              <TableCell className="max-w-[200px]">
                                <span className="font-medium truncate block" title={lead.title}>{lead.title}</span>
                                {lead.description && (
                                  <span className="text-xs text-muted-foreground truncate block" title={lead.description ?? ""}>
                                    {String(lead.description).slice(0, 80)}…
                                  </span>
                                )}
                                {(lead.contactEmail || lead.contactPhone) && (
                                  <span className="text-xs text-muted-foreground truncate block">
                                    {lead.contactEmail && <span>{lead.contactEmail}</span>}
                                    {lead.contactEmail && lead.contactPhone && " · "}
                                    {lead.contactPhone && <span>{lead.contactPhone}</span>}
                                  </span>
                                )}
                                {lead.status && (
                                  <span className="text-xs text-slate-700 truncate block">
                                    Pipeline: {lead.status}
                                  </span>
                                )}
                                {(lead as { followUpAt?: Date | string | null }).followUpAt && (
                                  <span className="text-xs text-slate-500 truncate block">
                                    Follow-up: {formatDate((lead as any).followUpAt)}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                <span className="text-sm">{lead.source}</span>
                                {lead.sourceLabel && <span className="text-muted-foreground block text-xs">{lead.sourceLabel}</span>}
                              </TableCell>
                              <TableCell>{lead.location ?? "—"}</TableCell>
                              <TableCell>{lead.performerType ?? "—"}</TableCell>
                              <TableCell>{lead.intentScore ?? "—"}</TableCell>
                              <TableCell>{formatDate(lead.createdAt)}</TableCell>
                              <TableCell>
                                <Badge variant={approvalStatus(lead) === "approved" ? "default" : approvalStatus(lead) === "rejected" ? "destructive" : "secondary"}>
                                  {approvalStatus(lead)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs">
                                <span className="block font-medium">{monetizationLabel((lead as { leadMonetizationType?: string | null }).leadMonetizationType)}</span>
                                {(lead as { outreachStatus?: string | null }).outreachStatus && (
                                  <span className="block text-muted-foreground">{(lead as any).outreachStatus}</span>
                                )}
                                {(lead as { subscriptionVisibility?: boolean }).subscriptionVisibility && (
                                  <span className="block text-muted-foreground">In subscription pool</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {lead.venueUrl ? (
                                  <a href={lead.venueUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                                    <ExternalLink className="w-4 h-4" />
                                    Link
                                  </a>
                                ) : (
                                  "—"
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1 items-center">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    title="Mark as Sell to Artists"
                                    onClick={() => setMonetizationMutation.mutate({ leadId: lead.id, leadMonetizationType: "artist_unlock" })}
                                    disabled={setMonetizationMutation.isPending}
                                  >
                                    <CreditCard className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    title="Send Outreach"
                                    onClick={() => setOutreachLead({ id: lead.id, title: lead.title ?? null, contactEmail: lead.contactEmail ?? null, venueEmail: (lead as { venueEmail?: string | null }).venueEmail ?? null })}
                                    disabled={sendOutreachMutation.isPending}
                                  >
                                    <Send className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={(lead as { subscriptionVisibility?: boolean }).subscriptionVisibility ? "secondary" : "outline"}
                                    title={(lead as { subscriptionVisibility?: boolean }).subscriptionVisibility ? "Remove from subscription pool" : "Add to subscription pool"}
                                    onClick={() => setMonetizationMutation.mutate({
                                      leadId: lead.id,
                                      subscriptionVisibility: !(lead as { subscriptionVisibility?: boolean }).subscriptionVisibility,
                                      ...(!(lead as { subscriptionVisibility?: boolean }).subscriptionVisibility ? { leadMonetizationType: "venue_subscription" as const } : {}),
                                    })}
                                    disabled={setMonetizationMutation.isPending}
                                  >
                                    <Users className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    title="Convert to Client Pipeline"
                                    onClick={() => setMonetizationMutation.mutate({ leadId: lead.id, leadMonetizationType: "direct_client_pipeline", venueClientStatus: "prospect" })}
                                    disabled={setMonetizationMutation.isPending}
                                  >
                                    <Building2 className="h-3.5 w-3.5" />
                                  </Button>
                                  {(lead as { contactedAt?: Date | string | null }).contactedAt && (
                                    <span className="text-muted-foreground text-xs">Contacted</span>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <Button variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {offset + 1}–{Math.min(offset + limit, total)} of {total}
                    </span>
                    <Button variant="outline" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}>
                      Next
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Source Toggles ───────────────────────────────────────────────── */}
          <TabsContent value="toggles" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Source toggles</CardTitle>
                <CardDescription>Enable or disable lead sources for scraping (Facebook is placeholder)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {sourceToggles && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(["reddit", "eventbrite", "craigslist", "facebook"] as const).map((key) => (
                      <div key={key} className="flex items-center justify-between rounded-lg border p-4">
                        <Label className="capitalize">{key}</Label>
                        <Switch
                          checked={!!sourceToggles[key]}
                          onCheckedChange={(checked) => setSourceToggleMutation.mutate({ sourceKey: key, enabled: checked })}
                          disabled={setSourceToggleMutation.isPending}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Phrase Management ─────────────────────────────────────────────── */}
          <TabsContent value="phrases" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Saved phrase sets</CardTitle>
                <CardDescription>Include and negative keyword sets for filtering</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 items-end flex-wrap">
                  <Input placeholder="Set name" className="w-40" value={phraseSetName} onChange={(e) => setPhraseSetName(e.target.value)} />
                  <Select value={phraseSetType} onValueChange={(v: "include" | "exclude") => setPhraseSetType(v)}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="include">Include</SelectItem>
                      <SelectItem value="exclude">Exclude</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => {
                      if (!phraseSetName.trim()) {
                        toast.error("Enter a name");
                        return;
                      }
                      savePhraseSetMutation.mutate({
                        name: phraseSetName.trim(),
                        type: phraseSetType,
                        phrases: phraseSetType === "include" ? customIncludeList : customExcludeList,
                      });
                    }}
                    disabled={!phraseSetName.trim() || savePhraseSetMutation.isPending}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Save phrase set
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Custom include phrases (one per line or comma-separated)</Label>
                    <textarea
                      className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="need a dj, wedding dj, …"
                      value={customIncludePhrase}
                      onChange={(e) => setCustomIncludePhrase(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Custom exclude phrases (one per line or comma-separated)</Label>
                    <textarea
                      className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="gear, software, …"
                      value={customExcludePhrase}
                      onChange={(e) => setCustomExcludePhrase(e.target.value)}
                    />
                  </div>
                </div>
                {phraseSets && phraseSets.length > 0 && (
                  <div className="space-y-2">
                    <Label>Saved sets</Label>
                    <div className="space-y-2">
                      {phraseSets.map((ps) => (
                        <div key={ps.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <span className="font-medium">{ps.name}</span>
                            <Badge variant={ps.type === "include" ? "default" : "secondary"} className="ml-2">
                              {ps.type}
                            </Badge>
                            <p className="text-sm text-muted-foreground mt-1">
                              {Array.isArray(ps.phrases) ? ps.phrases.join(", ") : ""}
                            </p>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => deletePhraseSetMutation.mutate({ id: ps.id })}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Run History ───────────────────────────────────────────────────── */}
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Scraper run history</CardTitle>
                <CardDescription>Raw docs collected, negative/intent rejected, accepted, inserted, skipped duplicates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Collected</TableHead>
                        <TableHead>Negative rejected</TableHead>
                        <TableHead>Intent rejected</TableHead>
                        <TableHead>Accepted</TableHead>
                        <TableHead>Inserted</TableHead>
                        <TableHead>Skipped (dupes)</TableHead>
                        <TableHead>Source counts</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!runHistory?.length ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                            No runs yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        runHistory.map((run) => (
                          <TableRow key={run.id}>
                            <TableCell>{formatDate(run.createdAt)}</TableCell>
                            <TableCell>{run.collected}</TableCell>
                            <TableCell>{run.negativeRejected}</TableCell>
                            <TableCell>{run.intentRejected}</TableCell>
                            <TableCell>{run.accepted}</TableCell>
                            <TableCell>{run.inserted}</TableCell>
                            <TableCell>{run.skipped}</TableCell>
                            <TableCell>
                              {run.sourceCounts && typeof run.sourceCounts === "object" ? (
                                <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(run.sourceCounts)}</pre>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!outreachLead} onOpenChange={(open) => !open && setOutreachLead(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send outreach — {outreachLead?.title ?? "Lead"}</DialogTitle>
            <CardDescription>
              {outreachLead && (hasOutreachableEmail(outreachLead)
                ? `To: ${(outreachLead.venueEmail?.trim() || outreachLead.contactEmail?.trim()) ?? ""}`
                : "No outreachable email (add venue or contact email).")}
            </CardDescription>
          </DialogHeader>
          {outreachLead && !hasOutreachableEmail(outreachLead) ? (
            <p className="text-destructive text-sm">No outreachable email. Add venue email or contact email to this lead to send outreach.</p>
          ) : outreachLead ? (
            <>
              <div className="space-y-2">
                <Label>Template</Label>
                <Select value={outreachTemplateId} onValueChange={(v: "venue_intro" | "follow_up" | "performer_supply") => setOutreachTemplateId(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(outreachTemplates ?? []).map((t: { id: string; label: string }) => (
                      <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOutreachLead(null)}>Cancel</Button>
                <Button
                  onClick={() => sendOutreachMutation.mutate({ leadId: outreachLead.id, templateId: outreachTemplateId })}
                  disabled={sendOutreachMutation.isPending}
                >
                  {sendOutreachMutation.isPending ? "Sending…" : "Send outreach"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
