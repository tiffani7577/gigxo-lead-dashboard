import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Zap, Calendar, MapPin, Tag } from "lucide-react";

type EventWindow = {
  id: number;
  city: string;
  region: string;
  marketId: string;
  eventName: string;
  filterLabel: string;
  startDate: Date;
  endDate: Date;
  leadDays: number;
  leadBoostMultiplier: string;
  searchKeywordPack: unknown;
  relevantPerformerTypes: unknown;
  activeStatus: boolean;
  eventYear: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type FormState = {
  city: string;
  region: string;
  marketId: string;
  eventName: string;
  filterLabel: string;
  startDate: string;
  endDate: string;
  leadDays: number;
  leadBoostMultiplier: string;
  searchKeywordPack: string; // comma-separated for the form
  relevantPerformerTypes: string; // comma-separated for the form
  eventYear: number;
  notes: string;
};

const emptyForm: FormState = {
  city: "",
  region: "",
  marketId: "",
  eventName: "",
  filterLabel: "",
  startDate: "",
  endDate: "",
  leadDays: 90,
  leadBoostMultiplier: "1.20",
  searchKeywordPack: "",
  relevantPerformerTypes: "dj",
  eventYear: new Date().getFullYear(),
  notes: "",
};

function isWindowActive(w: EventWindow): boolean {
  const now = new Date();
  const visibleFrom = new Date(w.startDate);
  visibleFrom.setDate(visibleFrom.getDate() - w.leadDays);
  return w.activeStatus && now >= visibleFrom && now <= new Date(w.endDate);
}

function boostColor(multiplier: string): string {
  const v = parseFloat(multiplier);
  if (v >= 1.4) return "bg-red-500/20 text-red-400 border-red-500/30";
  if (v >= 1.25) return "bg-orange-500/20 text-orange-400 border-orange-500/30";
  if (v >= 1.1) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  return "bg-slate-500/20 text-slate-400 border-slate-500/30";
}

export default function AdminEventWindows() {
  const utils = trpc.useUtils();
  const { data: windows = [], isLoading } = trpc.events.getAllEvents.useQuery();
  const toggleMutation = trpc.events.toggleEvent.useMutation({
    onSuccess: () => utils.events.getAllEvents.invalidate(),
  });
  const addMutation = trpc.events.addEvent.useMutation({
    onSuccess: () => {
      utils.events.getAllEvents.invalidate();
      setShowAdd(false);
      setForm(emptyForm);
      toast.success("Event window added");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.events.updateEvent.useMutation({
    onSuccess: () => {
      utils.events.getAllEvents.invalidate();
      setEditTarget(null);
      toast.success("Event window updated");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.events.deleteEvent.useMutation({
    onSuccess: () => {
      utils.events.getAllEvents.invalidate();
      toast.success("Event window deleted");
    },
    onError: (e) => toast.error(e.message),
  });;

  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<EventWindow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [filterMarket, setFilterMarket] = useState("all");

  const markets = useMemo(() => {
    const ids = Array.from(new Set((windows as EventWindow[]).map((w) => w.marketId))).sort();
    return ids;
  }, [windows]);

  const filtered = useMemo(() => {
    const list = windows as EventWindow[];
    if (filterMarket === "all") return list;
    return list.filter((w) => w.marketId === filterMarket);
  }, [windows, filterMarket]);

  const activeCount = (windows as EventWindow[]).filter(isWindowActive).length;

  function openEdit(w: EventWindow) {
    setEditTarget(w);
    setForm({
      city: w.city,
      region: w.region,
      marketId: w.marketId,
      eventName: w.eventName,
      filterLabel: w.filterLabel,
      startDate: new Date(w.startDate).toISOString().split("T")[0],
      endDate: new Date(w.endDate).toISOString().split("T")[0],
      leadDays: w.leadDays,
      leadBoostMultiplier: w.leadBoostMultiplier,
      searchKeywordPack: ((w.searchKeywordPack as string[]) ?? []).join(", "),
      relevantPerformerTypes: ((w.relevantPerformerTypes as string[]) ?? []).join(", "),
      eventYear: w.eventYear,
      notes: w.notes ?? "",
    });
  }

  function handleSubmit(isEdit: boolean) {
    const payload = {
      city: form.city,
      region: form.region,
      marketId: form.marketId,
      eventName: form.eventName,
      filterLabel: form.filterLabel,
      startDate: form.startDate,
      endDate: form.endDate,
      leadDays: form.leadDays,
      leadBoostMultiplier: form.leadBoostMultiplier,
      searchKeywordPack: form.searchKeywordPack.split(",").map((s) => s.trim()).filter(Boolean),
      relevantPerformerTypes: form.relevantPerformerTypes.split(",").map((s) => s.trim()).filter(Boolean),
      eventYear: form.eventYear,
      notes: form.notes || undefined,
    };
    if (isEdit && editTarget) {
      updateMutation.mutate({ id: editTarget.id, ...payload });
    } else {
      addMutation.mutate(payload);
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Zap className="w-6 h-6 text-yellow-400" />
              Event Windows
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Time-limited lead boost engine. Active windows inject keyword packs into the scraper
              and multiply lead scores automatically.
            </p>
          </div>
          <Button onClick={() => { setForm(emptyForm); setShowAdd(true); }} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Window
          </Button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Windows" value={(windows as EventWindow[]).length} />
          <StatCard label="Currently Active" value={activeCount} highlight />
          <StatCard label="Markets Covered" value={markets.length} />
          <StatCard
            label="Avg Boost"
            value={
              (windows as EventWindow[]).length > 0
                ? (
                    (windows as EventWindow[]).reduce(
                      (s, w) => s + parseFloat(w.leadBoostMultiplier),
                      0
                    ) / (windows as EventWindow[]).length
                  ).toFixed(2) + "x"
                : "—"
            }
          />
        </div>

        {/* Market filter */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={filterMarket === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterMarket("all")}
          >
            All Markets
          </Button>
          {markets.map((m) => (
            <Button
              key={m}
              variant={filterMarket === m ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterMarket(m)}
            >
              {m}
            </Button>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Event</TableHead>
                <TableHead>City / Region</TableHead>
                <TableHead>Window</TableHead>
                <TableHead>Boost</TableHead>
                <TableHead>Keywords</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    Loading event windows…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    No event windows found.
                  </TableCell>
                </TableRow>
              ) : (
                (filtered as EventWindow[]).map((w) => {
                  const active = isWindowActive(w);
                  const keywords = (w.searchKeywordPack as string[]) ?? [];
                  return (
                    <TableRow key={w.id} className={active ? "bg-yellow-500/5" : ""}>
                      <TableCell>
                        <div className="font-medium text-foreground">{w.eventName}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Tag className="w-3 h-3" />
                          {w.filterLabel}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-muted-foreground" />
                          {w.city}
                        </div>
                        <div className="text-xs text-muted-foreground">{w.region}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-muted-foreground" />
                          {new Date(w.startDate).toLocaleDateString()} –{" "}
                          {new Date(w.endDate).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Visible {w.leadDays}d before start
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`font-mono text-xs ${boostColor(w.leadBoostMultiplier)}`}
                        >
                          {w.leadBoostMultiplier}x
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground max-w-[180px] truncate">
                          {keywords.slice(0, 3).join(", ")}
                          {keywords.length > 3 && (
                            <span className="text-muted-foreground/60"> +{keywords.length - 3} more</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={w.activeStatus}
                            onCheckedChange={(v) =>
                              toggleMutation.mutate({ id: w.id, activeStatus: v })
                            }
                          />
                          {active ? (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                              LIVE
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              {w.activeStatus ? "Scheduled" : "Off"}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEdit(w)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm(`Delete "${w.eventName}"?`)) {
                                deleteMutation.mutate({ id: w.id });
                              }
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog
        open={showAdd || editTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setShowAdd(false);
            setEditTarget(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Event Window" : "Add Event Window"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1">
              <Label>Event Name</Label>
              <Input
                value={form.eventName}
                onChange={(e) => setForm({ ...form, eventName: e.target.value })}
                placeholder="Miami Music Week"
              />
            </div>
            <div className="space-y-1">
              <Label>Filter Label (chip text)</Label>
              <Input
                value={form.filterLabel}
                onChange={(e) => setForm({ ...form, filterLabel: e.target.value })}
                placeholder="Miami Music Week"
              />
            </div>
            <div className="space-y-1">
              <Label>City</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Miami, FL"
              />
            </div>
            <div className="space-y-1">
              <Label>Region</Label>
              <Input
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                placeholder="South Florida"
              />
            </div>
            <div className="space-y-1">
              <Label>Market ID</Label>
              <Input
                value={form.marketId}
                onChange={(e) => setForm({ ...form, marketId: e.target.value })}
                placeholder="miami"
              />
            </div>
            <div className="space-y-1">
              <Label>Event Year</Label>
              <Input
                type="number"
                value={form.eventYear}
                onChange={(e) => setForm({ ...form, eventYear: parseInt(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>End Date</Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Lead Days (visible before start)</Label>
              <Input
                type="number"
                value={form.leadDays}
                onChange={(e) => setForm({ ...form, leadDays: parseInt(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label>Boost Multiplier (e.g. 1.40)</Label>
              <Input
                value={form.leadBoostMultiplier}
                onChange={(e) => setForm({ ...form, leadBoostMultiplier: e.target.value })}
                placeholder="1.40"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Search Keyword Pack (comma-separated)</Label>
              <Textarea
                value={form.searchKeywordPack}
                onChange={(e) => setForm({ ...form, searchKeywordPack: e.target.value })}
                placeholder="Miami Music Week DJ, MMW afterparty DJ, MMW private event, rooftop DJ Miami..."
                rows={3}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Relevant Performer Types (comma-separated)</Label>
              <Input
                value={form.relevantPerformerTypes}
                onChange={(e) => setForm({ ...form, relevantPerformerTypes: e.target.value })}
                placeholder="dj, hybrid_electronic, solo_act"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Admin Notes (optional)</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Internal notes about this event window..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAdd(false);
                setEditTarget(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleSubmit(editTarget !== null)}
              disabled={addMutation.isPending || updateMutation.isPending}
            >
              {editTarget ? "Save Changes" : "Add Window"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight
          ? "border-yellow-500/30 bg-yellow-500/10"
          : "border-border bg-card"
      }`}
    >
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
