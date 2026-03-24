import { Component, type ErrorInfo, type ReactNode, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const URGENCY = ["Same day", "Within 24 hours", "2-3 days", "Planning ahead"] as const;

function AVStaffingContent() {
  const search = typeof window !== "undefined" ? window.location.search : "";
  const query = useMemo(() => new URLSearchParams(search), [search]);
  const startsPaid = query.get("paid") === "1";

  const [isPaid, setIsPaid] = useState(startsPaid);
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [crewNeeded, setCrewNeeded] = useState("1");
  const [urgency, setUrgency] = useState<(typeof URGENCY)[number] | "">("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const createCheckout = trpc.inbound.createAVRequestCheckout.useMutation({
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err) => toast.error(err.message || "Could not start checkout"),
  });

  const submitRequest = trpc.inbound.submitAVRequest.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setSubmittedEmail(contactEmail);
    },
    onError: (err) => toast.error(err.message || "Could not submit request"),
  });

  const startCheckout = () => {
    if (!companyName.trim()) {
      toast.error("Company/Event Name is required before checkout");
      return;
    }
    if (!contactEmail.trim()) {
      toast.error("Contact Email is required before checkout");
      return;
    }
    createCheckout.mutate({ companyName: companyName.trim(), contactEmail: contactEmail.trim() });
  };

  const onSubmit = () => {
    if (!isPaid) {
      toast.error("Please complete payment first.");
      return;
    }
    if (!companyName || !contactName || !contactEmail || !contactPhone || !eventDate || !location) {
      toast.error("Please fill all required fields.");
      return;
    }
    const n = Number(crewNeeded);
    if (!Number.isFinite(n) || n < 1) {
      toast.error("Please enter how many crew you need (at least 1).");
      return;
    }
    if (!urgency) {
      toast.error("Please select urgency.");
      return;
    }

    const sessionId = query.get("session_id") || "manual_paid";
    submitRequest.mutate({
      stripeCheckoutSessionId: sessionId,
      companyName,
      contactName,
      contactEmail,
      contactPhone,
      eventDate,
      location,
      crewNeeded: n,
      urgency,
      additionalNotes: additionalNotes || undefined,
    });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-white text-slate-900">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <Card className="bg-white border-slate-200">
            <CardContent className="pt-8 text-center">
              <h2 className="text-2xl font-bold mb-3">Request received!</h2>
              <p className="text-slate-600">
                Our team will contact you at <span className="font-semibold">{submittedEmail}</span> within 1 hour with crew options.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <Card className="bg-white border-slate-200">
          <CardContent className="pt-8">
            <h1 className="text-3xl font-bold mb-3">Need Last-Minute AV Crew in South Florida?</h1>
            <p className="text-slate-600 text-lg">
              Tell us what you need and we&apos;ll have someone for you within the hour.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle>$15 crew request fee</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="text-slate-600 space-y-1 text-sm">
              <li>✓ Personal matching by our team</li>
              <li>✓ Response within 1 hour</li>
              <li>✓ Vetted professionals only</li>
              <li>✓ Same-day availability</li>
            </ul>
            {!isPaid ? (
              <Button onClick={startCheckout} disabled={createCheckout.isPending} className="bg-purple-600 hover:bg-purple-700">
                {createCheckout.isPending ? "Starting checkout..." : "Submit Request — $15"}
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setIsPaid(true)} disabled>
                Payment received
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle>Quick request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Company/Event Name</Label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
            <div>
              <Label>Contact Name</Label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div>
              <Label>Contact Email</Label>
              <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </div>
            <div>
              <Label>Contact Phone</Label>
              <Input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} required />
            </div>
            <div>
              <Label>Event Date</Label>
              <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            </div>
            <div>
              <Label>Location/Venue</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div>
              <Label>Crew needed</Label>
              <Input type="number" min={1} value={crewNeeded} onChange={(e) => setCrewNeeded(e.target.value)} />
            </div>
            <div>
              <Label>Urgency</Label>
              <Select
                value={urgency || undefined}
                onValueChange={(v) => setUrgency(v as (typeof URGENCY)[number])}
              >
                <SelectTrigger className="w-full max-w-full"><SelectValue placeholder="Select urgency" /></SelectTrigger>
                <SelectContent>
                  {URGENCY.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Additional notes (optional)</Label>
              <Textarea rows={4} value={additionalNotes} onChange={(e) => setAdditionalNotes(e.target.value)} />
            </div>
            <Button onClick={onSubmit} disabled={submitRequest.isPending} className="bg-purple-600 hover:bg-purple-700">
              {submitRequest.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type BoundaryProps = { children: ReactNode };
type BoundaryState = { hasError: boolean };

class AVStaffingBoundary extends Component<BoundaryProps, BoundaryState> {
  constructor(props: BoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AVStaffing] render error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white text-slate-900 flex flex-col items-center justify-center px-4">
          <div className="max-w-md w-full rounded-xl border border-slate-200 bg-white p-8 text-center shadow-xl">
            <h1 className="text-xl font-semibold text-slate-900 mb-2">AV Staffing</h1>
            <p className="text-slate-500 text-sm mb-6">
              Something went wrong loading this page. Try refreshing, or contact support if it keeps happening.
            </p>
            <Button
              type="button"
              onClick={() => window.location.reload()}
              className="bg-purple-600 hover:bg-purple-700 text-white w-full sm:w-auto"
            >
              Refresh page
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AVStaffing() {
  return (
    <AVStaffingBoundary>
      <AVStaffingContent />
    </AVStaffingBoundary>
  );
}
