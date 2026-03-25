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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Search, RefreshCw, Phone, Mail, ExternalLink, MessageSquare, Send, Users, CreditCard, Building2, Download } from "lucide-react";
import { toast } from "sonner";

const VENUE_STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "FOLLOW_UP", label: "Follow up" },
  { value: "MEETING", label: "Meeting" },
  { value: "CLIENT", label: "Client" },
  { value: "IGNORED", label: "Ignored" },
] as const;

function formatDate(d: Date | string | null) {
  if (!d) return "—";
  const x = typeof d === "string" ? new Date(d) : d;
  return x.toLocaleDateString(undefined, { dateStyle: "short" });
}

/** Derive license type from externalId e.g. dbpr-400-12345 -> 400 */
function getLicenseType(externalId: string | null): string {
  if (!externalId || !externalId.startsWith("dbpr-")) return "—";
  const parts = externalId.split("-");
  return parts[1] ?? "—";
}

/** Parse license/approval date from DBPR description (e.g. "Date: 2025-03-10" or "Application Approval Date: 2025-03-10"). Returns "Mar 10, 2025" or "—". */
function getLicenseDateFromDescription(description: string | null | undefined, source: string | null | undefined): string {
  if (source !== "dbpr" || !description?.trim()) return "—";
  const match = description.match(/(?:Application Approval Date|Date):\s*(\d{4}-\d{2}-\d{2})/i);
  if (!match) return "—";
  const d = new Date(match[1]);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type VenueLead = {
  id: number;
  externalId: string | null;
  title: string | null;
  location: string | null;
  intentScore: number | null;
  venueStatus: string | null;
  lastContactedAt: Date | string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  venueEmail: string | null;
  venuePhone: string | null;
  venueUrl: string | null;
  notes: string | null;
  sourceLabel: string | null;
  description?: string | null;
  source?: string | null;
  leadMonetizationType?: string | null;
  outreachStatus?: string | null;
  outreachAttemptCount?: number | null;
  outreachLastSentAt?: Date | string | null;
  outreachNextFollowUpAt?: Date | string | null;
  venueClientStatus?: string | null;
  subscriptionVisibility?: boolean | null;
  regionTag?: string | null;
  artistUnlockEnabled?: boolean | null;
  premiumOnly?: boolean | null;
};

const MONETIZATION_OPTIONS = [
  { value: "", label: "Any path" },
  { value: "artist_unlock", label: "Sell to Artists" },
  { value: "venue_outreach", label: "Venue Outreach" },
  { value: "venue_subscription", label: "Subscription Pool" },
  { value: "direct_client_pipeline", label: "Client Pipeline" },
] as const;

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
const OUTREACH_STATUS_OPTIONS = [
  { value: "", label: "Any" },
  { value: "not_sent", label: "Not sent" },
  { value: "queued", label: "Queued" },
  { value: "sent", label: "Sent" },
  { value: "replied", label: "Replied" },
  { value: "interested", label: "Interested" },
  { value: "not_interested", label: "Not interested" },
  { value: "bounced", label: "Bounced" },
] as const;
const CLIENT_STATUS_OPTIONS = [
  { value: "", label: "Any" },
  { value: "prospect", label: "Prospect" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "active_client", label: "Active client" },
  { value: "archived", label: "Archived" },
] as const;
const REGION_OPTIONS = [
  { value: "", label: "Any region" },
  { value: "miami", label: "Miami" },
  { value: "fort_lauderdale", label: "Fort Lauderdale" },
  { value: "boca", label: "Boca" },
  { value: "west_palm", label: "West Palm" },
  { value: "south_florida", label: "South Florida" },
] as const;

function ContactInfo({ lead }: { lead: VenueLead }) {
  const email = lead.venueEmail || lead.contactEmail;
  const phone = lead.venuePhone || lead.contactPhone;
  const parts: string[] = [];
  if (email) parts.push(email);
  if (phone) parts.push(phone);
  if (lead.venueUrl) parts.push(lead.venueUrl);
  if (parts.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-col gap-0.5 text-sm">
      {email && (
        <a href={`mailto:${email}`} className="flex items-center gap-1 text-primary hover:underline">
          <Mail className="h-3 w-3 shrink-0" /> {email}
        </a>
      )}
      {phone && (
        <a href={`tel:${phone}`} className="flex items-center gap-1 text-primary hover:underline">
          <Phone className="h-3 w-3 shrink-0" /> {phone}
        </a>
      )}
      {lead.venueUrl && (
        <a href={lead.venueUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
          <ExternalLink className="h-3 w-3 shrink-0" /> Website
        </a>
      )}
    </div>
  );
}

export default function AdminVenueIntelligence() {
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [venueStatus, setVenueStatus] = useState("");
  const [city, setCity] = useState("");
  const [licenseType, setLicenseType] = useState("");
  const [searchText, setSearchText] = useState("");
  const [notesLead, setNotesLead] = useState<VenueLead | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [leadMonetizationType, setLeadMonetizationType] = useState("");
  const [outreachStatusFilter, setOutreachStatusFilter] = useState("");
  const [venueClientStatusFilter, setVenueClientStatusFilter] = useState("");
  const [subscriptionVisibilityFilter, setSubscriptionVisibilityFilter] = useState<"" | "yes" | "no">("");
  const [regionTag, setRegionTag] = useState("");
  const [outreachLead, setOutreachLead] = useState<VenueLead | null>(null);
  const [outreachTemplateId, setOutreachTemplateId] = useState<"venue_intro" | "follow_up" | "performer_supply">("venue_intro");

  const filters = {
    limit,
    offset,
    venueStatus: venueStatus || undefined,
    city: city.trim() || undefined,
    licenseType: licenseType.trim() || undefined,
    searchText: searchText.trim() || undefined,
    leadMonetizationType: leadMonetizationType || undefined,
    outreachStatus: outreachStatusFilter || undefined,
    venueClientStatus: venueClientStatusFilter || undefined,
    subscriptionVisibility: subscriptionVisibilityFilter === "yes" ? true : subscriptionVisibilityFilter === "no" ? false : undefined,
    regionTag: regionTag || undefined,
  };

  const { data, isLoading, refetch } = trpc.admin.getVenueIntelligenceLeads.useQuery(filters);
  const updateStatusMutation = trpc.admin.updateVenueStatus.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Status updated");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateNotesMutation = trpc.admin.updateVenueNotes.useMutation({
    onSuccess: () => {
      refetch();
      setNotesLead(null);
      toast.success("Notes saved");
    },
    onError: (e) => toast.error(e.message),
  });
  const setMonetizationMutation = trpc.admin.setLeadMonetization.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Monetization updated");
    },
    onError: (e) => toast.error(e.message),
  });
  const sendOutreachMutation = trpc.admin.sendOutreach.useMutation({
    onSuccess: (result) => {
      refetch();
      setOutreachLead(null);
      if (result.noOutreachableEmail) toast.error("No outreachable email");
      else if (result.success) toast.success("Outreach sent");
      else toast.error(result.message ?? "Send failed");
    },
    onError: (e) => toast.error(e.message),
  });
  const { data: outreachTemplates } = trpc.admin.getOutreachTemplates.useQuery(undefined, { enabled: !!outreachLead });
  const runDbprMutation = trpc.admin.runDbprPipeline.useMutation({
    onSuccess: (result) => {
      refetch();
      const r = result as { inserted: number; updated?: number; collected?: number };
      const parts = [
        `${r.inserted} new`,
        r.updated != null && r.updated > 0 ? `${r.updated} updated` : null,
        r.collected != null ? `${r.collected} from CSV` : null,
      ].filter(Boolean);
      toast.success(parts.join(" · "));
    },
    onError: (e) => toast.error(e.message),
  });

  const openNotes = (lead: VenueLead) => {
    setNotesLead(lead);
    setNotesDraft(lead.notes ?? "");
  };

  const saveNotes = () => {
    if (!notesLead) return;
    updateNotesMutation.mutate({ leadId: notesLead.id, notes: notesDraft });
  };

  const hasOutreachableEmail = (lead: VenueLead) => !!(lead.venueEmail?.trim() || lead.contactEmail?.trim());
  const sendOutreach = () => {
    if (!outreachLead) return;
    if (!hasOutreachableEmail(outreachLead)) {
      toast.error("No outreachable email");
      return;
    }
    sendOutreachMutation.mutate({ leadId: outreachLead.id, templateId: outreachTemplateId });
  };

  const items = (data?.items ?? []) as VenueLead[];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Venue Intelligence</h1>
          <p className="text-muted-foreground text-sm mt-1">
            South Florida venue leads. Assign each lead a money path: Artist lead (sell to artists), Outreach (email venue), Subscription (visible to Premium), or Client pipeline (direct sales).
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter by status, city, license type; search by name or city.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search name or city..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-48"
                />
              </div>
              <Select value={venueStatus || "all"} onValueChange={(v) => setVenueStatus(v === "all" ? "" : v)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {VENUE_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={leadMonetizationType || "any"} onValueChange={(v) => setLeadMonetizationType(v === "any" ? "" : v)}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Monetization" />
                </SelectTrigger>
                <SelectContent>
                  {MONETIZATION_OPTIONS.map((o) => (
                    <SelectItem key={o.value || "any"} value={o.value || "any"}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={outreachStatusFilter || "any"} onValueChange={(v) => setOutreachStatusFilter(v === "any" ? "" : v)}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Outreach" />
                </SelectTrigger>
                <SelectContent>
                  {OUTREACH_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value || "any"} value={o.value || "any"}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={venueClientStatusFilter || "any"} onValueChange={(v) => setVenueClientStatusFilter(v === "any" ? "" : v)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Client status" />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value || "any"} value={o.value || "any"}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={subscriptionVisibilityFilter || "any"} onValueChange={(v) => setSubscriptionVisibilityFilter((v === "any" ? "" : v) as "" | "yes" | "no")}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Sub visible" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
              <Select value={regionTag || "any"} onValueChange={(v) => setRegionTag(v === "any" ? "" : v)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Region" />
                </SelectTrigger>
                <SelectContent>
                  {REGION_OPTIONS.map((o) => (
                    <SelectItem key={o.value || "any"} value={o.value || "any"}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} className="w-40" />
              <Input placeholder="License type (e.g. 400)" value={licenseType} onChange={(e) => setLicenseType(e.target.value)} className="w-36" />
              <Button
                variant="outline"
                size="default"
                onClick={() => runDbprMutation.mutate()}
                disabled={runDbprMutation.isPending || isLoading}
              >
                {runDbprMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
                ) : (
                  <Download className="h-4 w-4 shrink-0" />
                )}
                <span className="ml-2">Fetch New Licenses</span>
              </Button>
              <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Leads</CardTitle>
              <CardDescription>
                {total} venue intelligence lead{total !== 1 ? "s" : ""}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground">Loading…</div>
            ) : items.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No leads match the filters.</div>
            ) : (
              <>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead>Licensed</TableHead>
                        <TableHead>License</TableHead>
                        <TableHead className="text-right">Intent</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Monetization</TableHead>
                        <TableHead>Outreach</TableHead>
                        <TableHead>Artist / Sub</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium">{lead.title ?? "—"}</TableCell>
                          <TableCell>{lead.location ?? "—"}</TableCell>
                          <TableCell>{getLicenseDateFromDescription(lead.description, lead.source)}</TableCell>
                          <TableCell>{getLicenseType(lead.externalId)}</TableCell>
                          <TableCell className="text-right">
                            {lead.intentScore != null ? (
                              <Badge variant="secondary">{lead.intentScore}</Badge>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{lead.venueStatus ?? "NEW"}</Badge>
                            {lead.lastContactedAt && (
                              <span className="ml-1 text-xs text-muted-foreground" title="Last contacted">
                                {formatDate(lead.lastContactedAt)}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs" title="Money path">
                              {monetizationLabel(lead.leadMonetizationType)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{lead.outreachStatus ?? "not_sent"}</Badge>
                            {lead.outreachAttemptCount != null && lead.outreachAttemptCount > 0 && (
                              <span className="ml-1 text-xs text-muted-foreground">×{lead.outreachAttemptCount}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {lead.artistUnlockEnabled === false ? "Artist off" : "Artist on"}
                            {lead.subscriptionVisibility ? " · In subscription pool" : " · Not in pool"}
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            <ContactInfo lead={lead} />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setMonetizationMutation.mutate({ leadId: lead.id, leadMonetizationType: "artist_unlock" })}
                                disabled={setMonetizationMutation.isPending}
                                title="Mark as Sell to Artists"
                              >
                                <CreditCard className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setOutreachLead(lead)}
                                disabled={sendOutreachMutation.isPending}
                                title="Send Outreach"
                              >
                                <Send className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant={lead.subscriptionVisibility ? "secondary" : "outline"}
                                onClick={() => setMonetizationMutation.mutate({
                                  leadId: lead.id,
                                  subscriptionVisibility: !lead.subscriptionVisibility,
                                  ...(lead.subscriptionVisibility ? {} : { leadMonetizationType: "venue_subscription" }),
                                })}
                                disabled={setMonetizationMutation.isPending}
                                title={lead.subscriptionVisibility ? "Remove from subscription pool" : "Add to subscription pool (visible to Premium)"}
                              >
                                <Users className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setMonetizationMutation.mutate({ leadId: lead.id, leadMonetizationType: "direct_client_pipeline", venueClientStatus: "prospect" })}
                                disabled={setMonetizationMutation.isPending}
                                title="Convert to Client Pipeline"
                              >
                                <Building2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateStatusMutation.mutate({ leadId: lead.id, venueStatus: "CONTACTED" })}
                                disabled={updateStatusMutation.isPending}
                              >
                                Contacted
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateStatusMutation.mutate({ leadId: lead.id, venueStatus: "FOLLOW_UP" })}
                                disabled={updateStatusMutation.isPending}
                              >
                                Follow up
                              </Button>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => updateStatusMutation.mutate({ leadId: lead.id, venueStatus: "CLIENT" })}
                                disabled={updateStatusMutation.isPending}
                              >
                                Client
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => openNotes(lead)} title="Add notes">
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={offset === 0}
                        onClick={() => setOffset(Math.max(0, offset - limit))}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={offset + limit >= total}
                        onClick={() => setOffset(offset + limit)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!notesLead} onOpenChange={(open) => !open && setNotesLead(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notes — {notesLead?.title ?? "Lead"}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder="Add or edit notes..."
            rows={6}
            className="resize-none"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesLead(null)}>
              Cancel
            </Button>
            <Button onClick={saveNotes} disabled={updateNotesMutation.isPending}>
              Save notes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!outreachLead} onOpenChange={(open) => !open && setOutreachLead(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send outreach — {outreachLead?.title ?? "Lead"}</DialogTitle>
            <CardDescription>
              {outreachLead && (hasOutreachableEmail(outreachLead)
                ? `To: ${outreachLead.venueEmail?.trim() || outreachLead.contactEmail?.trim()}`
                : "No outreachable email (add venue or contact email).")}
            </CardDescription>
          </DialogHeader>
          {outreachLead && !hasOutreachableEmail(outreachLead) ? (
            <p className="text-destructive text-sm">No outreachable email. Add venue email or contact email to this lead to send outreach.</p>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Template</label>
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
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOutreachLead(null)}>
              Cancel
            </Button>
            <Button
              onClick={sendOutreach}
              disabled={sendOutreachMutation.isPending || !outreachLead || !hasOutreachableEmail(outreachLead!)}
            >
              {sendOutreachMutation.isPending ? "Sending…" : "Send outreach"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
