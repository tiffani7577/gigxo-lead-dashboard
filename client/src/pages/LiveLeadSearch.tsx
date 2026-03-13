import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, ExternalLink, Loader2, Save, Bookmark } from "lucide-react";
import { toast } from "sonner";

const SOURCE_OPTIONS = [
  { value: "reddit" as const, label: "Reddit" },
  { value: "craigslist" as const, label: "Craigslist" },
  { value: "eventbrite" as const, label: "Eventbrite" },
];

const PERFORMER_TYPES = ["dj", "solo_act", "small_band", "large_band", "singer", "instrumentalist", "other"];

export default function LiveLeadSearch() {
  const [customPhrase, setCustomPhrase] = useState("wedding dj");
  const [sources, setSources] = useState<("reddit" | "craigslist" | "eventbrite")[]>(["reddit"]);
  const [city, setCity] = useState("");
  const [performerType, setPerformerType] = useState("");
  const [includeKeywords, setIncludeKeywords] = useState("");
  const [excludeKeywords, setExcludeKeywords] = useState("");
  const [maxResults, setMaxResults] = useState(50);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [presetName, setPresetName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const runSearch = trpc.admin.runLiveLeadSearch.useMutation({
    onError: (e) => toast.error(e.message),
  });
  const saveLeads = trpc.admin.saveLeadsToGigLeads.useMutation({
    onSuccess: (r) => {
      toast.success(`Saved ${r.inserted} leads, ${r.skipped} duplicates skipped`);
    },
    onError: (e) => toast.error(e.message),
  });
  const savePreset = trpc.admin.saveLiveSearchPreset.useMutation({
    onSuccess: () => {
      toast.success("Preset saved");
      presetRefetch();
      setPresetName("");
    },
    onError: (e) => toast.error(e.message),
  });
  const deletePreset = trpc.admin.deleteLiveSearchPreset.useMutation({
    onSuccess: () => presetRefetch(),
    onError: (e) => toast.error(e.message),
  });
  const { data: presets, refetch: presetRefetch } = trpc.admin.getLiveSearchPresets.useQuery();

  const results = runSearch.data?.results ?? [];
  const stats = runSearch.data?.stats;
  const acceptedResults = results.filter((r) => r.status === "accepted" && r.lead);
  const selectedLeads = acceptedResults.filter((r) => r.lead && selectedIds.has(r.doc.externalId));

  const toggleSource = (src: "reddit" | "craigslist" | "eventbrite") => {
    setSources((prev) => (prev.includes(src) ? prev.filter((s) => s !== src) : [...prev, src]));
  };

  const run = () => {
    if (sources.length === 0) {
      toast.error("Select at least one source");
      return;
    }
    setSelectedIds(new Set());
    runSearch.mutate({
      customPhrase: customPhrase.trim() || "dj",
      sources,
      city: city.trim() || undefined,
      performerType: performerType || undefined,
      includeKeywords: includeKeywords.split(/[\n,]+/).map((k) => k.trim()).filter(Boolean),
      excludeKeywords: excludeKeywords.split(/[\n,]+/).map((k) => k.trim()).filter(Boolean),
      maxResults,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
  };

  const saveSelected = () => {
    const toSave = selectedLeads.map((r) => r.lead!);
    if (toSave.length === 0) {
      toast.error("Select one or more accepted results");
      return;
    }
    saveLeads.mutate({ leads: toSave });
  };

  const saveAllPassing = () => {
    const toSave = acceptedResults.map((r) => r.lead!);
    if (toSave.length === 0) {
      toast.error("No accepted results to save");
      return;
    }
    saveLeads.mutate({ leads: toSave });
  };

  const savePresetClick = () => {
    if (!presetName.trim()) {
      toast.error("Enter a preset name");
      return;
    }
    savePreset.mutate({
      name: presetName.trim(),
      customPhrase: customPhrase.trim() || "dj",
      sources,
      city: city.trim() || undefined,
      performerType: performerType || undefined,
      includeKeywords: includeKeywords.split(/[\n,]+/).map((k) => k.trim()).filter(Boolean),
      excludeKeywords: excludeKeywords.split(/[\n,]+/).map((k) => k.trim()).filter(Boolean),
      maxResults,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
  };

  const applyPreset = (filterJson: Record<string, unknown>) => {
    if (typeof filterJson.customPhrase === "string") setCustomPhrase(filterJson.customPhrase);
    if (Array.isArray(filterJson.sources)) setSources(filterJson.sources as ("reddit" | "craigslist" | "eventbrite")[]);
    if (typeof filterJson.city === "string") setCity(filterJson.city);
    if (typeof filterJson.performerType === "string") setPerformerType(filterJson.performerType);
    if (Array.isArray(filterJson.includeKeywords)) setIncludeKeywords((filterJson.includeKeywords as string[]).join(", "));
    if (Array.isArray(filterJson.excludeKeywords)) setExcludeKeywords((filterJson.excludeKeywords as string[]).join(", "));
    if (typeof filterJson.maxResults === "number") setMaxResults(filterJson.maxResults);
    if (typeof filterJson.dateFrom === "string") setDateFrom(filterJson.dateFrom.slice(0, 16));
    if (typeof filterJson.dateTo === "string") setDateTo(filterJson.dateTo.slice(0, 16));
  };

  const toggleSelect = (externalId: string, accepted: boolean) => {
    if (!accepted) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(externalId)) next.delete(externalId);
      else next.add(externalId);
      return next;
    });
  };

  const toggleSelectAllAccepted = () => {
    if (selectedIds.size === acceptedResults.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(acceptedResults.map((r) => r.doc.externalId)));
  };

  return (
    <DashboardLayout>
      <div className="w-full max-w-[1600px] mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Live Lead Search</h1>
          <p className="text-muted-foreground mt-1">
            Query Reddit, Craigslist, and Eventbrite with your own phrase. Same pipeline and filters as the scheduled scraper.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              Search
            </CardTitle>
            <CardDescription>Run a live search across selected sources. Results are normalized and run through the same negative/intent pipeline.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Custom search phrase</Label>
                <Input
                  placeholder="e.g. wedding dj, need a dj"
                  value={customPhrase}
                  onChange={(e) => setCustomPhrase(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Sources</Label>
                <div className="flex flex-wrap gap-2">
                  {SOURCE_OPTIONS.map((opt) => (
                    <Badge
                      key={opt.value}
                      variant={sources.includes(opt.value) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleSource(opt.value)}
                    >
                      {opt.label}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>City / location (optional)</Label>
                <Input placeholder="e.g. Miami, Fort Lauderdale" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Performer type (optional)</Label>
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
              <div className="space-y-2">
                <Label>Include keywords (comma or newline)</Label>
                <Input
                  placeholder="e.g. need a dj, wedding"
                  value={includeKeywords}
                  onChange={(e) => setIncludeKeywords(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Exclude keywords (comma or newline)</Label>
                <Input
                  placeholder="e.g. gear, software"
                  value={excludeKeywords}
                  onChange={(e) => setExcludeKeywords(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Max results</Label>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={maxResults}
                  onChange={(e) => setMaxResults(parseInt(e.target.value, 10) || 50)}
                />
              </div>
              <div className="space-y-2">
                <Label>Date window (optional)</Label>
                <div className="flex gap-2">
                  <Input type="datetime-local" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} placeholder="From" />
                  <Input type="datetime-local" value={dateTo} onChange={(e) => setDateTo(e.target.value)} placeholder="To" />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <Button onClick={run} disabled={runSearch.isPending || sources.length === 0}>
                {runSearch.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                Run live search
              </Button>
              {presets && presets.length > 0 && (
                <Select
                  onValueChange={(id) => {
                    const p = presets.find((x) => String(x.id) === id);
                    if (p) applyPreset(p.filterJson as Record<string, unknown>);
                  }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Load preset…" />
                  </SelectTrigger>
                  <SelectContent>
                    {presets.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="flex gap-2 items-center">
                <Input placeholder="Preset name" className="w-36" value={presetName} onChange={(e) => setPresetName(e.target.value)} />
                <Button variant="secondary" onClick={savePresetClick} disabled={!presetName.trim() || savePreset.isPending}>
                  <Bookmark className="w-4 h-4 mr-2" />
                  Save preset
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {stats && (
          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
              <CardDescription>
                Collected {stats.collected} → negative rejected: {stats.negativeRejected}, intent rejected: {stats.intentRejected}, accepted: {stats.accepted}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={saveSelected} disabled={selectedLeads.length === 0 || saveLeads.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  Save selected ({selectedLeads.length}) to gigLeads
                </Button>
                <Button variant="secondary" size="sm" onClick={saveAllPassing} disabled={acceptedResults.length === 0 || saveLeads.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  Save all passing ({acceptedResults.length}) to gigLeads
                </Button>
                {acceptedResults.length > 0 && (
                  <Button variant="outline" size="sm" onClick={toggleSelectAllAccepted}>
                    {selectedIds.size === acceptedResults.length ? "Deselect all" : "Select all accepted"}
                  </Button>
                )}
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">Save</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Snippet</TableHead>
                      <TableHead>Intent</TableHead>
                      <TableHead>Status / reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          No results. Run a search above.
                        </TableCell>
                      </TableRow>
                    ) : (
                      results.map((row) => (
                        <TableRow key={row.doc.externalId}>
                          <TableCell>
                            {row.status === "accepted" && row.lead && (
                              <Checkbox
                                checked={selectedIds.has(row.doc.externalId)}
                                onCheckedChange={() => toggleSelect(row.doc.externalId, true)}
                              />
                            )}
                          </TableCell>
                          <TableCell className="max-w-[180px]">
                            <span className="font-medium truncate block" title={row.doc.rawText.split("\n")[0]}>
                              {row.doc.rawText.split("\n")[0] || "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            {row.doc.source}
                            {row.doc.sourceLabel && <span className="text-muted-foreground block text-xs">{row.doc.sourceLabel}</span>}
                          </TableCell>
                          <TableCell>{row.doc.city ?? "—"}</TableCell>
                          <TableCell>
                            <a
                              href={row.doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline inline-flex items-center gap-1"
                            >
                              <ExternalLink className="w-4 h-4" />
                              Link
                            </a>
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            <span className="text-xs text-muted-foreground line-clamp-2" title={row.doc.rawText}>
                              {row.doc.rawText.slice(0, 120)}…
                            </span>
                          </TableCell>
                          <TableCell>{row.intentScore ?? "—"}</TableCell>
                          <TableCell>
                            {row.status === "accepted" ? (
                              <Badge variant="default">Pass</Badge>
                            ) : (
                              <span className="text-xs text-destructive" title={row.reason}>
                                {row.reason ?? row.status}
                              </span>
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
        )}
      </div>
    </DashboardLayout>
  );
}
