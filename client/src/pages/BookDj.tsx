import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Music, Calendar, MapPin, DollarSign, Loader2, CheckCircle2 } from "lucide-react";

export default function BookDj() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    eventDate: "",
    location: "",
    eventType: "",
    budget: "",
    notes: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const submitLead = trpc.publicLeads.submitClientLead.useMutation({
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (err) => {
      console.error("[BookDj] submitClientLead error:", err);
      // @ts-expect-error tRPC error shape
      const message = err?.message ?? err?.data?.message ?? "Something went wrong. Please try again.";
      // lazy import to avoid circulars; toast already used elsewhere
      // eslint-disable-next-line no-alert
      alert(message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLead.isPending) return;
    const budgetNum = form.budget ? Number(form.budget) : undefined;
    submitLead.mutate({
      name: form.name.trim(),
      email: form.email.trim(),
      eventDate: form.eventDate || undefined,
      location: form.location.trim(),
      eventType: form.eventType.trim(),
      budget: budgetNum,
      notes: form.notes.trim() || undefined,
    });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <Card className="max-w-md w-full bg-slate-900 border-slate-800 text-center">
          <CardHeader>
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 mx-auto flex items-center justify-center mb-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <CardTitle className="text-white text-xl">Thanks! Local artists will contact you.</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-400 text-sm">
              Your request has been shared with nearby performers. Keep an eye on your email for replies.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <Card className="w-full max-w-2xl bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center">
              <Music className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">Book a DJ</CardTitle>
              <p className="text-slate-400 text-sm">Tell us about your event and we’ll notify local artists.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-slate-200">Your name</Label>
                <Input
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="bg-slate-950 border-slate-700 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-sm text-slate-200">Email</Label>
                <Input
                  required
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="bg-slate-950 border-slate-700 text-white mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-slate-200 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" /> Event date
                </Label>
                <Input
                  type="date"
                  value={form.eventDate}
                  onChange={e => setForm(f => ({ ...f, eventDate: e.target.value }))}
                  className="bg-slate-950 border-slate-700 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-sm text-slate-200 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" /> Location
                </Label>
                <Input
                  required
                  placeholder="Miami, FL"
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  className="bg-slate-950 border-slate-700 text-white mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-slate-200">Event type</Label>
                <Input
                  required
                  placeholder="Wedding, birthday, corporate..."
                  value={form.eventType}
                  onChange={e => setForm(f => ({ ...f, eventType: e.target.value }))}
                  className="bg-slate-950 border-slate-700 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-sm text-slate-200 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-slate-400" /> Budget (optional)
                </Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="e.g. 1500"
                  value={form.budget}
                  onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
                  className="bg-slate-950 border-slate-700 text-white mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-sm text-slate-200">Notes (optional)</Label>
              <Textarea
                placeholder="Anything else we should know? Timeline, vibe, special requests..."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={4}
                className="bg-slate-950 border-slate-700 text-white mt-1 resize-none"
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={submitLead.isPending}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6"
              >
                {submitLead.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...
                  </>
                ) : (
                  "Submit Request"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

