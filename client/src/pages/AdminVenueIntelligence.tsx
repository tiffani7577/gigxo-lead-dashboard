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
import { Search, RefreshCw, Phone, Mail, ExternalLink, MessageSquare } from "lucide-react";
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
};

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

  const filters = {
    limit,
    offset,
    venueStatus: venueStatus || undefined,
    city: city.trim() || undefined,
    licenseType: licenseType.trim() || undefined,
    searchText: searchText.trim() || undefined,
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

  const openNotes = (lead: VenueLead) => {
    setNotesLead(lead);
    setNotesDraft(lead.notes ?? "");
  };

  const saveNotes = () => {
    if (!notesLead) return;
    updateNotesMutation.mutate({ leadId: notesLead.id, notes: notesDraft });
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
            CRM for venue leads (leadType = venue_intelligence). Admin-only.
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
              <Input
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-40"
              />
              <Input
                placeholder="License type (e.g. 400)"
                value={licenseType}
                onChange={(e) => setLicenseType(e.target.value)}
                className="w-36"
              />
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
                        <TableHead>License type</TableHead>
                        <TableHead className="text-right">Intent</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium">{lead.title ?? "—"}</TableCell>
                          <TableCell>{lead.location ?? "—"}</TableCell>
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
                          <TableCell className="max-w-[200px]">
                            <ContactInfo lead={lead} />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-1">
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
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openNotes(lead)}
                                title="Add notes"
                              >
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
    </DashboardLayout>
  );
}
