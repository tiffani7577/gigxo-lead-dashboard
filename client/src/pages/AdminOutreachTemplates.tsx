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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Pencil } from "lucide-react";
import { toast } from "sonner";

function targetTypeLabel(s: string) {
  const m: Record<string, string> = { venue_new: "Venue (new)", venue_existing: "Venue (existing)", performer: "Performer" };
  return m[s] ?? s;
}

export default function AdminOutreachTemplates() {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: templates = [], refetch } = trpc.admin.getLeadOutreachTemplates.useQuery();
  const updateMutation = trpc.admin.updateLeadOutreachTemplate.useMutation({
    onSuccess: () => { toast.success("Template updated"); setEditingId(null); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Outreach Templates</h1>
            <p className="text-muted-foreground text-sm mt-1">Variables: {"{{name}}"}, {"{{venue}}"}, {"{{city}}"}</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <FileText className="h-4 w-4 mr-2" />
            New template
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {templates.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No templates. Create one to get started.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Target type</TableHead>
                    <TableHead>Subject preview</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>{targetTypeLabel(t.targetType)}</TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">{t.subjectTemplate}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(t.id)}>
                          <Pencil className="h-4 w-4" />
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

      {editingId != null && (
        <EditTemplateDialog
          templateId={editingId}
          template={templates.find((t: any) => t.id === editingId)}
          onClose={() => setEditingId(null)}
          onSave={(payload) => updateMutation.mutate({ id: editingId, ...payload })}
          isSaving={updateMutation.isPending}
        />
      )}

      {createOpen && (
        <CreateTemplateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSuccess={() => { setCreateOpen(false); refetch(); }}
        />
      )}
    </DashboardLayout>
  );
}

function EditTemplateDialog({
  templateId,
  template,
  onClose,
  onSave,
  isSaving,
}: {
  templateId: number;
  template: any;
  onClose: () => void;
  onSave: (p: { name?: string; targetType?: string; subjectTemplate?: string; bodyTemplate?: string }) => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [targetType, setTargetType] = useState(template?.targetType ?? "venue_new");
  const [subjectTemplate, setSubjectTemplate] = useState(template?.subjectTemplate ?? "");
  const [bodyTemplate, setBodyTemplate] = useState(template?.bodyTemplate ?? "");
  useEffect(() => {
    if (template) {
      setName(template.name ?? "");
      setTargetType(template.targetType ?? "venue_new");
      setSubjectTemplate(template.subjectTemplate ?? "");
      setBodyTemplate(template.bodyTemplate ?? "");
    }
  }, [template]);

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit template</DialogTitle>
          <DialogDescription>Variables: {"{{name}}"}, {"{{venue}}"}, {"{{city}}"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Target type</label>
            <Select value={targetType} onValueChange={setTargetType}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="venue_new">Venue (new)</SelectItem>
                <SelectItem value="venue_existing">Venue (existing)</SelectItem>
                <SelectItem value="performer">Performer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Subject template</label>
            <Input value={subjectTemplate} onChange={(e) => setSubjectTemplate(e.target.value)} className="mt-1" placeholder="e.g. Congrats on opening {{venue}} 🎉" />
          </div>
          <div>
            <label className="text-sm font-medium">Body template</label>
            <Textarea value={bodyTemplate} onChange={(e) => setBodyTemplate(e.target.value)} rows={10} className="mt-1 font-mono text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({ name, targetType, subjectTemplate, bodyTemplate })} disabled={isSaving || !name.trim() || !subjectTemplate.trim() || !bodyTemplate.trim()}>
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateTemplateDialog({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (v: boolean) => void; onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [targetType, setTargetType] = useState<"venue_new" | "venue_existing" | "performer">("venue_new");
  const [subjectTemplate, setSubjectTemplate] = useState("");
  const [bodyTemplate, setBodyTemplate] = useState("");
  const create = trpc.admin.createLeadOutreachTemplate.useMutation({
    onSuccess: () => { toast.success("Template created"); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate({ name: name.trim(), targetType, subjectTemplate: subjectTemplate.trim(), bodyTemplate: bodyTemplate.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New template</DialogTitle>
          <DialogDescription>Variables: {"{{name}}"}, {"{{venue}}"}, {"{{city}}"}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" required />
          </div>
          <div>
            <label className="text-sm font-medium">Target type</label>
            <Select value={targetType} onValueChange={(v: any) => setTargetType(v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="venue_new">Venue (new)</SelectItem>
                <SelectItem value="venue_existing">Venue (existing)</SelectItem>
                <SelectItem value="performer">Performer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Subject template</label>
            <Input value={subjectTemplate} onChange={(e) => setSubjectTemplate(e.target.value)} className="mt-1" placeholder="e.g. Congrats on opening {{venue}} 🎉" required />
          </div>
          <div>
            <label className="text-sm font-medium">Body template</label>
            <Textarea value={bodyTemplate} onChange={(e) => setBodyTemplate(e.target.value)} rows={10} className="mt-1 font-mono text-sm" required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={create.isPending || !name.trim() || !subjectTemplate.trim() || !bodyTemplate.trim()}>
              {create.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
