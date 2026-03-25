import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { Mail, Phone, ExternalLink, SkipForward, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const DEFAULT_SENDER = "Gigxo <teryn@gigxo.com>";

export default function AdminOutreachHub() {
  const { data, isLoading, refetch } = trpc.admin.getNextOutreachVenue.useQuery();
  const [remaining, setRemaining] = useState<number>(0);
  const [currentVenue, setCurrentVenue] = useState<any | null>(null);

  const [senderEmail, setSenderEmail] = useState(DEFAULT_SENDER);
  const [toEmail, setToEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const sendMutation = trpc.admin.sendOutreachAndAdvance.useMutation();
  const skipMutation = trpc.admin.skipOutreachVenue.useMutation();
  const clearEmailMutation = trpc.admin.clearVenueEmailAndAdvance.useMutation();

  // Sync state from initial query
  useEffect(() => {
    if (!data) return;
    setRemaining(data.remainingCount ?? 0);
    if (data.venue) {
      setCurrentVenue(data.venue);
      setToEmail(data.venue.contactEmail ?? "");
      setSubject((data.venue as any).subject ?? "");
      setBody((data.venue as any).body ?? "");
    } else {
      setCurrentVenue(null);
      setToEmail("");
      setSubject("");
      setBody("");
    }
  }, [data]);

  const applyNextVenue = (next: any | null, decrement: boolean) => {
    if (decrement && remaining > 0) {
      setRemaining((prev) => Math.max(0, prev - 1));
    }
    if (!next) {
      setCurrentVenue(null);
      setToEmail("");
      setSubject("");
      setBody("");
      return;
    }
    setCurrentVenue(next);
    setToEmail(next.contactEmail ?? "");
    setSubject(next.subject ?? "");
    setBody(next.body ?? "");
  };

  const handleSend = async () => {
    if (!currentVenue) return;
    if (!toEmail.trim()) {
      toast.error("Recipient email is required.");
      return;
    }
    try {
      const { id } = currentVenue;
      const result = await sendMutation.mutateAsync({
        leadId: id,
        subject,
        body,
        senderEmail: senderEmail || DEFAULT_SENDER,
      });
      toast.success(`Sent to ${currentVenue.title || currentVenue.contactEmail}! Loading next venue...`);
      setTimeout(() => {
        applyNextVenue(result.nextVenue ?? null, true);
      }, 1500);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send outreach email.");
    }
  };

  const handleSkip = async () => {
    if (!currentVenue) return;
    try {
      const { id } = currentVenue;
      const result = await skipMutation.mutateAsync({ leadId: id });
      applyNextVenue(result.nextVenue ?? null, true);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to skip venue.");
    }
  };

  const handleClearEmail = async () => {
    if (!currentVenue) return;
    try {
      const { id } = currentVenue;
      const result = await clearEmailMutation.mutateAsync({ leadId: id });
      applyNextVenue(result.nextVenue ?? null, true);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to remove email.");
    }
  };

  const handleBodyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  const isBusy = isLoading || sendMutation.isPending || skipMutation.isPending || clearEmailMutation.isPending;

  const cityFromLocation = (loc: string | null | undefined) => {
    if (!loc) return "";
    const s = String(loc).trim();
    const idx = s.indexOf(",");
    return idx > 0 ? s.slice(0, idx).trim() : s;
  };

  const remainingLabel = remaining > 0 ? `${remaining} venues remaining in queue` : "No venues remaining";

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Venue Outreach Hub</h1>
            <p className="text-muted-foreground text-sm mt-1">
              One-click outreach for venue-intel leads with email (DBPR, Sunbiz, Google Maps). Review details, send as Teryn, and we&apos;ll auto-load the next venue.
            </p>
          </div>
          {!isLoading && (
            <div className="text-xs text-slate-500 border border-slate-200 rounded-full px-3 py-1">
              {remainingLabel}
            </div>
          )}
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Loading next venue…
            </CardContent>
          </Card>
        ) : !currentVenue ? (
          <Card className="border-dashed">
            <CardContent className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="text-4xl">🎉</div>
              <div>
                <h2 className="text-lg font-semibold mb-1">All caught up!</h2>
                <p className="text-sm text-slate-600">
                  No venues waiting for outreach. Run the DBPR pipeline or scraper enrich to add emails, then refresh.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  // Reuse existing admin scraper config route
                  window.location.href = "/admin/scraper-config";
                }}
              >
                Run DBPR Pipeline
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Left: Venue info card */}
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-purple-600" />
                  <span>{currentVenue.title || "Untitled venue"}</span>
                </CardTitle>
                <CardDescription className="space-y-1">
                  {currentVenue.location && (
                    <div className="text-sm text-slate-600">
                      {cityFromLocation(currentVenue.location)} · {currentVenue.location}
                    </div>
                  )}
                  {currentVenue.externalId && (
                    <div className="text-xs text-slate-500">
                      License: <span className="font-mono">{currentVenue.externalId}</span>
                    </div>
                  )}
                  {currentVenue.createdAt && (
                    <div className="text-xs text-slate-500">
                      Added: {format(new Date(currentVenue.createdAt), "MMM d, yyyy")}
                    </div>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  {currentVenue.contactEmail && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-700">Email:</span>
                      <a
                        href={`mailto:${currentVenue.contactEmail}`}
                        className="text-purple-600 hover:underline break-all"
                      >
                        {currentVenue.contactEmail}
                      </a>
                    </div>
                  )}
                  {currentVenue.contactPhone && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-700">Phone:</span>
                      <a
                        href={`tel:${currentVenue.contactPhone}`}
                        className="inline-flex items-center gap-1 text-slate-700 hover:text-purple-600"
                      >
                        <Phone className="w-3 h-3" />
                        {currentVenue.contactPhone}
                      </a>
                    </div>
                  )}
                  {currentVenue.venueUrl && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-700">Website:</span>
                      <a
                        href={currentVenue.venueUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 break-all"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {currentVenue.venueUrl}
                      </a>
                    </div>
                  )}
                </div>

                {currentVenue.description && (
                  <div className="mt-2">
                    <div className="text-xs font-semibold text-slate-500 mb-1">
                      Lead description
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-line line-clamp-8">
                      {currentVenue.description}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100 mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSkip}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1 text-xs"
                  >
                    <SkipForward className="w-3 h-3" />
                    Skip this venue
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClearEmail}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1 text-xs text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <Trash2 className="w-3 h-3" />
                    No email — remove
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Right: Email composer */}
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Email Composer</CardTitle>
                <CardDescription>
                  Review and customize the message before sending. Cmd+Enter (or Ctrl+Enter) to send.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">From</label>
                  <select
                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                  >
                    <option value={DEFAULT_SENDER}>Teryn &lt;teryn@gigxo.com&gt;</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">To</label>
                  <Input
                    type="email"
                    value={toEmail}
                    onChange={(e) => setToEmail(e.target.value)}
                    placeholder="recipient@example.com"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Subject</label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center justify-between text-xs font-medium text-slate-600">
                    <span>Body</span>
                    <span className="text-[11px] text-slate-400">Cmd+Enter (Mac) or Ctrl+Enter (PC) to send</span>
                  </label>
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    onKeyDown={handleBodyKeyDown}
                    className="min-h-[300px] text-sm"
                  />
                </div>
                <div className="pt-2">
                  <Button
                    type="button"
                    onClick={handleSend}
                    disabled={isBusy || !toEmail.trim()}
                    className="w-full md:w-auto bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6"
                  >
                    Send Email →
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

