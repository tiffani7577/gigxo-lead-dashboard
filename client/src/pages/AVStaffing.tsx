import { Component, type ReactNode, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const ROLES = [
  "A1 Audio Engineer",
  "A2 Audio Assistant",
  "Lighting Designer",
  "Lighting Tech",
  "LED Tech",
  "Stage Manager",
  "Stagehand",
  "Video Tech",
  "Backline Tech",
  "Other",
] as const;

const PAY_RATES = ["$150-200/day", "$200-300/day", "$300-400/day", "$400+/day", "To be discussed"] as const;
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
  const [callTime, setCallTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [rolesNeeded, setRolesNeeded] = useState<string[]>([]);
  const [numberOfCrew, setNumberOfCrew] = useState("1");
  const [payRate, setPayRate] = useState<(typeof PAY_RATES)[number] | "">("");
  const [urgency, setUrgency] = useState<(typeof URGENCY)[number] | "">("");
  const [readyToBook, setReadyToBook] = useState<"yes" | "no">("yes");
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

  const toggleRole = (role: string) => {
    setRolesNeeded((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  };

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
    if (!companyName || !contactName || !contactEmail || !contactPhone || !eventDate || !callTime || !endTime || !location) {
      toast.error("Please fill all required fields.");
      return;
    }
    if (rolesNeeded.length === 0) {
      toast.error("Please select at least one role.");
      return;
    }
    if (!payRate || !urgency) {
      toast.error("Please select pay rate and urgency.");
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
      callTime,
      endTime,
      location,
      rolesNeeded,
      numberOfCrew: Number(numberOfCrew) || 1,
      payRate,
      urgency,
      readyToBook,
      additionalNotes: additionalNotes || undefined,
    });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="pt-8 text-center">
              <h2 className="text-2xl font-bold mb-3">Request received!</h2>
              <p className="text-slate-300">
                Our team will contact you at <span className="font-semibold">{submittedEmail}</span> within 1 hour with crew options.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="pt-8">
            <h1 className="text-3xl font-bold mb-3">Need AV Crew in South Florida?</h1>
            <p className="text-slate-300 text-lg">
              Submit your request and our team personally matches you with vetted, available AV professionals — often within the hour.
            </p>
            <p className="text-slate-400 text-sm mt-3">
              Requests are fulfilled manually by our team. You will hear from us within 1 hour of submission.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle>$15 crew request fee</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="text-slate-300 space-y-1 text-sm">
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

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle>AV Crew Request Form</CardTitle>
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
              <Input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>Event Date</Label>
                <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
              </div>
              <div>
                <Label>Call Time</Label>
                <Input type="time" value={callTime} onChange={(e) => setCallTime(e.target.value)} />
              </div>
              <div>
                <Label>End Time</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Location/Venue</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div>
              <Label>Roles Needed</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {ROLES.map((role) => (
                  <label key={role} className="text-sm flex items-center gap-2">
                    <input type="checkbox" checked={rolesNeeded.includes(role)} onChange={() => toggleRole(role)} />
                    <span>{role}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>Number of Crew</Label>
              <Input type="number" min={1} value={numberOfCrew} onChange={(e) => setNumberOfCrew(e.target.value)} />
            </div>
            <div>
              <Label>Pay Rate per Person</Label>
              <Select value={payRate} onValueChange={(v) => setPayRate(v as (typeof PAY_RATES)[number])}>
                <SelectTrigger><SelectValue placeholder="Select a range" /></SelectTrigger>
                <SelectContent>
                  {PAY_RATES.map((rate) => <SelectItem key={rate} value={rate}>{rate}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Urgency</Label>
              <Select value={urgency} onValueChange={(v) => setUrgency(v as (typeof URGENCY)[number])}>
                <SelectTrigger><SelectValue placeholder="Select urgency" /></SelectTrigger>
                <SelectContent>
                  {URGENCY.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ready to book immediately?</Label>
              <Select value={readyToBook} onValueChange={(v) => setReadyToBook(v as "yes" | "no")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Additional notes</Label>
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

  render() {
    if (this.state.hasError) {
      return <div>AV Staffing</div>;
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
