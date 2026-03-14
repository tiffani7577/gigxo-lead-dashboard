import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Mail, Send, Eye, UserPlus } from "lucide-react";
import { toast } from "sonner";

function formatDate(d: Date | string | null) {
  if (!d) return "—";
  const x = typeof d === "string" ? new Date(d) : d;
  return x.toLocaleDateString(undefined, { dateStyle: "short" });
}

function leadTypeLabel(s: string) {
  const m: Record<string, string> = { venue_new: "Venue (new)", venue_existing: "Venue (existing)", performer: "Performer" };
  return m[s] ?? s;
}

function statusLabel(s: string) {
  const m: Record<string, string> = { new: "New", contacted: "Contacted", replied: "Replied", booked: "Booked" };
  return m[s] ?? s;
}

export default function AdminOutreachLeads() {
  const [previewLeadId, setPreviewLeadId] = useState<number | null>(null);
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const { data: leadsList = [], isLoading, refetch } = trpc.admin.getOutreachLeads.useQuery({ limit: 200 });
  const { data: templates = [] } = trpc.admin.getLeadOutreachTemplates.useQuery();
  const previewQuery = trpc.admin.previewOutreachEmail.useQuery(
    { leadId: previewLeadId!, templateId: templateId! },
    { enabled: !!previewLeadId && !!templateId }
  );

  const openPreview = (leadId: number) => {
    setPreviewLeadId(leadId);
    setTemplateId(templates[0]?.id ?? null);
    setSubject("");
    setBody("");
  };

  const previewData = previewQuery.data;
  useEffect(() => {
    if (previewData?.subject != null && subject === "") setSubject(previewData.subject);
    if (previewData?.body != null && body === "") setBody(previewData.body);
  }, [previewData?.subject, previewData?.body]);

  const displaySubject = (subject || previewData?.subject) ?? "";
  const displayBody = (body || previewData?.body) ?? "";

  const handleSend = async () => {
    if (previewLeadId == null || !displaySubject.trim() || !displayBody.trim()) {
      toast.error("Subject and body are required");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          leadId: previewLeadId,
          subject: displaySubject.trim(),
          body: displayBody.trim(),
          templateId: templateId ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Send failed");
      toast.success("Email sent");
      setPreviewLeadId(null);
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Outreach Leads</h1>
            <p className="text-muted-foreground text-sm mt-1">Sorted by score. Preview and send emails manually only.</p>
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add lead
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading…</div>
            ) : leadsList.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No leads. Add a lead to get started.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead Name</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Lead Type</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Contacted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leadsList.map((lead: any) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.name ?? "—"}</TableCell>
                      <TableCell>{lead.businessName ?? "—"}</TableCell>
                      <TableCell>{lead.email ?? "—"}</TableCell>
                      <TableCell>{lead.city ?? "—"}</TableCell>
                      <TableCell>{leadTypeLabel(lead.leadType)}</TableCell>
                      <TableCell>{lead.score ?? 0}</TableCell>
                      <TableCell><Badge variant="secondary">{statusLabel(lead.status)}</Badge></TableCell>
                      <TableCell>{formatDate(lead.lastContacted)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" className="mr-1" onClick={() => openPreview(lead.id)}>
                          <Eye className="h-4 w-4 mr-1" />
                          Preview Email
                        </Button>
                        <Button variant="default" size="sm" onClick={() => openPreview(lead.id)}>
                          <Send className="h-4 w-4 mr-1" />
                          Send Email
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!previewLeadId} onOpenChange={(open) => !open && setPreviewLeadId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview & send email</DialogTitle>
            <DialogDescription>Edit subject and body if needed, then click Send Email. Emails only send when you click Send.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Template</label>
              <Select value={templateId?.toString() ?? ""} onValueChange={(v) => { setTemplateId(Number(v)); setSubject(""); setBody(""); }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name} ({leadTypeLabel(t.targetType)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {previewQuery.isLoading && templateId && <p className="text-sm text-muted-foreground">Rendering…</p>}
            <div>
              <label className="text-sm font-medium">Subject</label>
              <Input
                value={displaySubject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Body</label>
              <Textarea
                value={displayBody}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                className="mt-1 font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewLeadId(null)}>Cancel</Button>
            <Button onClick={handleSend} disabled={sending || !displaySubject.trim() || !displayBody.trim()}>
              {sending ? "Sending…" : "Send Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {addOpen && (
        <AddLeadDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          onSuccess={() => { setAddOpen(false); refetch(); }}
        />
      )}
    </DashboardLayout>
  );
}

function AddLeadDialog({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (v: boolean) => void; onSuccess: () => void }) {
  const [leadType, setLeadType] = useState<"venue_new" | "venue_existing" | "performer">("venue_new");
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [source, setSource] = useState("");
  const create = trpc.admin.createOutreachLead.useMutation({
    onSuccess: () => { toast.success("Lead added"); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate({
      leadType,
      name: name.trim() || undefined,
      businessName: businessName.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      instagram: instagram.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      source: source.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add lead</DialogTitle>
          <DialogDescription>New outreach lead. Score is computed from South Florida, Instagram, etc.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Lead type</label>
            <Select value={leadType} onValueChange={(v: any) => setLeadType(v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="venue_new">Venue (new)</SelectItem>
                <SelectItem value="venue_existing">Venue (existing)</SelectItem>
                <SelectItem value="performer">Performer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Business / Venue</label>
              <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Phone</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Instagram</label>
              <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">City</label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">State</label>
              <Input value={state} onChange={(e) => setState(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Source</label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} className="mt-1" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "Adding…" : "Add lead"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
