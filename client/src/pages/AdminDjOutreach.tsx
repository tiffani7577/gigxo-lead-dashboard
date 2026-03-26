import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { Headphones, Mail, SkipForward } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const DEFAULT_SENDER = "Gigxo <teryn@gigxo.com>";

type DjRow = {
  id: number;
  name: string;
  instagramHandle: string | null;
  email: string | null;
  status: "not_contacted" | "messaged" | "responded" | "skipped";
  notes: string | null;
  lastMessagedAt: Date | null;
  createdAt: Date;
  subject?: string;
  body?: string;
};

function statusLabel(s: DjRow["status"]): string {
  switch (s) {
    case "not_contacted":
      return "Not contacted";
    case "messaged":
      return "Messaged";
    case "responded":
      return "Responded";
    case "skipped":
      return "Skipped";
    default:
      return s;
  }
}

function NotesCell({ id, initial }: { id: number; initial: string | null }) {
  const utils = trpc.useUtils();
  const [val, setVal] = useState(initial ?? "");
  useEffect(() => {
    setVal(initial ?? "");
  }, [id, initial]);
  const save = trpc.admin.updateDjOutreachProfileNotes.useMutation({
    onSuccess: () => {
      toast.success("Notes saved");
      void utils.admin.listDjOutreachProfiles.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="flex flex-col gap-1 min-w-[180px]">
      <Textarea
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="text-xs min-h-[64px]"
        placeholder="Internal notes…"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-xs h-7"
        disabled={save.isPending}
        onClick={() => save.mutate({ id, notes: val })}
      >
        Save notes
      </Button>
    </div>
  );
}

export default function AdminDjOutreach() {
  const utils = trpc.useUtils();
  const { data: queueData, isLoading: queueLoading } = trpc.admin.getNextDjOutreachProfile.useQuery();
  const { data: list = [], isLoading: listLoading } = trpc.admin.listDjOutreachProfiles.useQuery();

  const [currentDj, setCurrentDj] = useState<DjRow | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [senderEmail, setSenderEmail] = useState(DEFAULT_SENDER);
  const [toEmail, setToEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const [addName, setAddName] = useState("");
  const [addIg, setAddIg] = useState("");
  const [addEmail, setAddEmail] = useState("");

  const sendMutation = trpc.admin.sendDjOutreachAndAdvance.useMutation();
  const skipMutation = trpc.admin.skipDjOutreachProfile.useMutation();
  const addMutation = trpc.admin.addDjOutreachProfile.useMutation({
    onSuccess: () => {
      toast.success("DJ added");
      setAddName("");
      setAddIg("");
      setAddEmail("");
      void utils.admin.listDjOutreachProfiles.invalidate();
      void utils.admin.getNextDjOutreachProfile.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const setStatusMutation = trpc.admin.setDjOutreachProfileStatus.useMutation({
    onSuccess: () => {
      void utils.admin.listDjOutreachProfiles.invalidate();
      void utils.admin.getNextDjOutreachProfile.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (!queueData) return;
    setRemaining(queueData.remainingCount ?? 0);
    const dj = queueData.dj;
    if (dj) {
      setCurrentDj(dj as DjRow);
      setToEmail((dj as DjRow).email?.trim() ?? "");
      setSubject((dj as DjRow).subject ?? "");
      setBody((dj as DjRow).body ?? "");
    } else {
      setCurrentDj(null);
      setToEmail("");
      setSubject("");
      setBody("");
    }
  }, [queueData]);

  const applyNextDj = (next: DjRow | null) => {
    if (!next) {
      setCurrentDj(null);
      setToEmail("");
      setSubject("");
      setBody("");
      return;
    }
    setCurrentDj(next);
    setToEmail(next.email?.trim() ?? "");
    setSubject(next.subject ?? "");
    setBody(next.body ?? "");
  };

  const handleSend = async () => {
    if (!currentDj) return;
    if (!toEmail.trim()) {
      toast.error("Recipient email is required.");
      return;
    }
    try {
      const result = await sendMutation.mutateAsync({
        id: currentDj.id,
        subject,
        body,
        recipientEmail: toEmail.trim(),
      });
      toast.success(`Sent to ${currentDj.name}! Loading next…`);
      setTimeout(() => {
        setRemaining(result.remainingCount);
        applyNextDj((result.nextDj as DjRow | null) ?? null);
        void utils.admin.getNextDjOutreachProfile.invalidate();
        void utils.admin.listDjOutreachProfiles.invalidate();
      }, 800);
    } catch (e: any) {
      toast.error(e?.message ?? "Send failed");
    }
  };

  const handleSkip = async () => {
    if (!currentDj) return;
    try {
      const result = await skipMutation.mutateAsync({ id: currentDj.id });
      setRemaining(result.remainingCount);
      applyNextDj((result.nextDj as DjRow | null) ?? null);
      void utils.admin.getNextDjOutreachProfile.invalidate();
      void utils.admin.listDjOutreachProfiles.invalidate();
    } catch (e: any) {
      toast.error(e?.message ?? "Skip failed");
    }
  };

  const handleBodyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSend();
    }
  };

  const isBusy = queueLoading || sendMutation.isPending || skipMutation.isPending;
  const remainingLabel =
    remaining > 0 ? `${remaining} DJ${remaining === 1 ? "" : "s"} in queue` : "Queue empty";

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Headphones className="h-6 w-6 text-purple-600" />
              DJ Outreach
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manual DJ list with one-by-one email (Microsoft Graph / Teryn). Track status and notes per profile.
            </p>
          </div>
          {!queueLoading && (
            <div className="text-xs text-slate-500 border border-slate-200 rounded-full px-3 py-1">{remainingLabel}</div>
          )}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Add DJ</CardTitle>
            <CardDescription>Add a profile to the outreach queue (starts as not contacted).</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-slate-600">Name</label>
              <Input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="DJ name" />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-slate-600">Instagram</label>
              <Input value={addIg} onChange={(e) => setAddIg(e.target.value)} placeholder="@handle or handle" />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-slate-600">Email (optional)</label>
              <Input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="email if known"
              />
            </div>
            <Button
              type="button"
              disabled={!addName.trim() || addMutation.isPending}
              onClick={() =>
                addMutation.mutate({
                  name: addName.trim(),
                  instagramHandle: addIg.trim() || undefined,
                  email: addEmail.trim() || undefined,
                })
              }
            >
              Add DJ
            </Button>
          </CardContent>
        </Card>

        {queueLoading ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">Loading queue…</CardContent>
          </Card>
        ) : !currentDj ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center space-y-2">
              <p className="text-lg font-medium">All caught up</p>
              <p className="text-sm text-muted-foreground">No DJs with status &quot;Not contacted&quot;. Add a DJ above or reset status in the table.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-purple-600" />
                  {currentDj.name}
                </CardTitle>
                <CardDescription className="space-y-1">
                  {currentDj.instagramHandle && (
                    <div className="text-sm">
                      Instagram:{" "}
                      <span className="font-medium">@{currentDj.instagramHandle.replace(/^@/, "")}</span>
                    </div>
                  )}
                  {currentDj.email && (
                    <div className="text-sm">
                      On file:{" "}
                      <a href={`mailto:${currentDj.email}`} className="text-primary hover:underline">
                        {currentDj.email}
                      </a>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Added {format(new Date(currentDj.createdAt), "MMM d, yyyy")}
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button type="button" variant="outline" size="sm" onClick={() => void handleSkip()} disabled={isBusy}>
                  <SkipForward className="h-3 w-3 mr-1" />
                  Skip this DJ
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Email composer</CardTitle>
                <CardDescription>Cmd+Enter (or Ctrl+Enter) to send via connected Microsoft inbox.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">From</label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                  >
                    <option value={DEFAULT_SENDER}>Teryn &lt;teryn@gigxo.com&gt;</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">To</label>
                  <Input type="email" value={toEmail} onChange={(e) => setToEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Subject</label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Body</label>
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    onKeyDown={handleBodyKeyDown}
                    className="min-h-[280px] text-sm"
                  />
                </div>
                <Button
                  type="button"
                  className="bg-purple-600 hover:bg-purple-700"
                  onClick={() => void handleSend()}
                  disabled={isBusy || !toEmail.trim()}
                >
                  Send email →
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">All DJ profiles</CardTitle>
            <CardDescription>Name, Instagram, email, status, and notes.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {listLoading ? (
              <p className="text-sm text-muted-foreground py-4">Loading list…</p>
            ) : list.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No profiles yet.</p>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Name</th>
                    <th className="py-2 pr-3 font-medium">Instagram</th>
                    <th className="py-2 pr-3 font-medium">Email</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((row) => (
                    <tr key={row.id} className="border-b border-border/60 align-top">
                      <td className="py-2 pr-3 font-medium">{row.name}</td>
                      <td className="py-2 pr-3">
                        {row.instagramHandle ? `@${row.instagramHandle.replace(/^@/, "")}` : "—"}
                      </td>
                      <td className="py-2 pr-3 break-all">{row.email ?? "—"}</td>
                      <td className="py-2 pr-3">
                        <select
                          className="border rounded-md px-2 py-1 text-xs bg-background max-w-[140px]"
                          value={row.status}
                          disabled={setStatusMutation.isPending}
                          onChange={(e) =>
                            setStatusMutation.mutate({
                              id: row.id,
                              status: e.target.value as DjRow["status"],
                            })
                          }
                        >
                          <option value="not_contacted">{statusLabel("not_contacted")}</option>
                          <option value="messaged">{statusLabel("messaged")}</option>
                          <option value="responded">{statusLabel("responded")}</option>
                          <option value="skipped">{statusLabel("skipped")}</option>
                        </select>
                      </td>
                      <td className="py-2 pr-0">
                        <NotesCell id={row.id} initial={row.notes} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
