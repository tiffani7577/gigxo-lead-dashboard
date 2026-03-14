import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Search, RefreshCw, ExternalLink, Copy, Check, UserPlus, Users, DollarSign, MessageCircle } from "lucide-react";
import { toast } from "sonner";

const OUTREACH_SCRIPT = `Hey — I run Gigxo.

We send DJs real event leads.

Right now we have new South Florida party leads.

Leads unlock for $7.

Want the link?`;

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "replied", label: "Replied" },
  { value: "joined", label: "Joined" },
  { value: "active_buyer", label: "Active buyer" },
  { value: "inactive", label: "Inactive" },
] as const;

function formatDate(d: Date | string | null) {
  if (!d) return "—";
  const x = typeof d === "string" ? new Date(d) : d;
  return x.toLocaleDateString(undefined, { dateStyle: "short" });
}

function statusLabel(s: string) {
  const labels: Record<string, string> = {
    new: "New",
    contacted: "Contacted",
    replied: "Replied",
    joined: "Joined",
    active_buyer: "Active buyer",
    inactive: "Inactive",
  };
  return labels[s] ?? s;
}

export default function AdminArtistLeads() {
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [genre, setGenre] = useState("");
  const [status, setStatus] = useState("");
  const [contactMethod, setContactMethod] = useState("");
  const [activeBuyerOnly, setActiveBuyerOnly] = useState(false);
  const [hasInstagram, setHasInstagram] = useState(false);
  const [followerRange, setFollowerRange] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const filters = {
    search: search.trim() || undefined,
    city: city.trim() || undefined,
    genre: genre.trim() || undefined,
    status: (status as "" | "new" | "contacted" | "replied" | "joined" | "active_buyer" | "inactive") || undefined,
    contactMethod: contactMethod.trim() || undefined,
    activeBuyerOnly: activeBuyerOnly || undefined,
    hasInstagram: hasInstagram || undefined,
    followerRange: followerRange.trim() || undefined,
    limit: 200,
  };

  const { data: list = [], isLoading, refetch } = trpc.admin.getArtistOutreachList.useQuery(filters);
  const { data: stats } = trpc.admin.getArtistOutreachStats.useQuery();
  const createMutation = trpc.admin.createArtistOutreach.useMutation({
    onSuccess: () => {
      toast.success("Artist added");
      refetch();
      setAddOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const updateStatusMutation = trpc.admin.updateArtistOutreachStatus.useMutation({
    onSuccess: () => {
      toast.success("Status updated");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const copyScript = () => {
    navigator.clipboard.writeText(OUTREACH_SCRIPT);
    setCopied(true);
    toast.success("Outreach script copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Artist Growth</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track DJs / performers we contact to join Gigxo and buy leads. Manual outreach only.
          </p>
        </div>

        {/* Dashboard metrics */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Contacted today</CardTitle>
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.artistsContactedToday ?? "—"}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New signups</CardTitle>
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.newSignups ?? "—"}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active buyers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.activeBuyers ?? "—"}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revenue generated</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats != null ? `$${Number(stats.revenueGenerated).toFixed(2)}` : "—"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Outreach script */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Outreach script</CardTitle>
            <CardDescription>Copy and paste when reaching out on Instagram (manual only).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <pre className="text-sm bg-muted/50 p-4 rounded-md whitespace-pre-wrap font-sans">
              {OUTREACH_SCRIPT}
            </pre>
            <Button variant="outline" size="sm" onClick={copyScript}>
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? "Copied" : "Copy script"}
            </Button>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Filters</CardTitle>
            <CardDescription>Search and filter artist outreach list (separate from lead discovery).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search name / handle"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Input
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-32"
              />
              <Input
                placeholder="Genre"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-32"
              />
              <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Contact method"
                value={contactMethod}
                onChange={(e) => setContactMethod(e.target.value)}
                className="w-36"
              />
              <Input
                placeholder="Follower range"
                value={followerRange}
                onChange={(e) => setFollowerRange(e.target.value)}
                className="w-32"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={activeBuyerOnly}
                  onChange={(e) => setActiveBuyerOnly(e.target.checked)}
                />
                Active buyer only
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hasInstagram}
                  onChange={(e) => setHasInstagram(e.target.checked)}
                />
                Has Instagram
              </label>
              <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table + Add */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Artists</CardTitle>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add artist
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground">Loading…</div>
            ) : list.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No artists match filters.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Artist</TableHead>
                      <TableHead>Instagram</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Genre</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Leads unlocked</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Last contacted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((row: any) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.artistName}</TableCell>
                        <TableCell>
                          {row.instagramHandle ? (
                            <a
                              href={`https://instagram.com/${row.instagramHandle.replace(/^@/, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              @{row.instagramHandle.replace(/^@/, "")}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>{row.city ?? "—"}</TableCell>
                        <TableCell>{row.genre ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{statusLabel(row.status)}</Badge>
                        </TableCell>
                        <TableCell>{row.leadsUnlocked ?? 0}</TableCell>
                        <TableCell>${Number(row.revenueGenerated ?? 0).toFixed(2)}</TableCell>
                        <TableCell>{formatDate(row.lastContactedAt ?? row.contactedAt)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            {row.instagramHandle && (
                              <Button
                                variant="ghost"
                                size="sm"
                                asChild
                              >
                                <a
                                  href={`https://instagram.com/${row.instagramHandle.replace(/^@/, "")}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Open Instagram
                                </a>
                              </Button>
                            )}
                            {row.status !== "contacted" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateStatusMutation.mutate({ id: row.id, status: "contacted" })}
                                disabled={updateStatusMutation.isPending}
                              >
                                Mark Contacted
                              </Button>
                            )}
                            {row.status !== "replied" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateStatusMutation.mutate({ id: row.id, status: "replied" })}
                                disabled={updateStatusMutation.isPending}
                              >
                                Mark Replied
                              </Button>
                            )}
                            {row.status !== "joined" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateStatusMutation.mutate({ id: row.id, status: "joined" })}
                                disabled={updateStatusMutation.isPending}
                              >
                                Mark Joined
                              </Button>
                            )}
                            {row.status !== "active_buyer" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateStatusMutation.mutate({ id: row.id, status: "active_buyer" })}
                                disabled={updateStatusMutation.isPending}
                              >
                                Mark Active Buyer
                              </Button>
                            )}
                            {row.status !== "inactive" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateStatusMutation.mutate({ id: row.id, status: "inactive" })}
                                disabled={updateStatusMutation.isPending}
                              >
                                Mark Inactive
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add artist dialog */}
      <AddArtistDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={(v) => createMutation.mutate(v)}
        isSubmitting={createMutation.isPending}
      />
    </DashboardLayout>
  );
}

function AddArtistDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (v: {
    artistName: string;
    instagramHandle?: string;
    city?: string;
    genre?: string;
    contactMethod?: string;
    source?: string;
    followerRange?: string;
    notes?: string;
  }) => void;
  isSubmitting: boolean;
}) {
  const [artistName, setArtistName] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [city, setCity] = useState("");
  const [genre, setGenre] = useState("");
  const [contactMethod, setContactMethod] = useState("");
  const [source, setSource] = useState("");
  const [followerRange, setFollowerRange] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!artistName.trim()) return;
    onSubmit({
      artistName: artistName.trim(),
      instagramHandle: instagramHandle.trim() || undefined,
      city: city.trim() || undefined,
      genre: genre.trim() || undefined,
      contactMethod: contactMethod.trim() || undefined,
      source: source.trim() || undefined,
      followerRange: followerRange.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    setArtistName("");
    setInstagramHandle("");
    setCity("");
    setGenre("");
    setContactMethod("");
    setSource("");
    setFollowerRange("");
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add artist</DialogTitle>
          <DialogDescription>Track a new artist for outreach.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Artist name *</label>
            <Input
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              placeholder="Name or stage name"
              required
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Instagram handle</label>
            <Input
              value={instagramHandle}
              onChange={(e) => setInstagramHandle(e.target.value)}
              placeholder="@handle"
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">City</label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Genre</label>
              <Input value={genre} onChange={(e) => setGenre(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Contact method</label>
              <Input value={contactMethod} onChange={(e) => setContactMethod(e.target.value)} placeholder="e.g. DM" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Source</label>
              <Input value={source} onChange={(e) => setSource(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Follower range</label>
            <Input value={followerRange} onChange={(e) => setFollowerRange(e.target.value)} placeholder="e.g. 1k-5k" className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Notes</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!artistName.trim() || isSubmitting}>
              {isSubmitting ? "Adding…" : "Add artist"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
