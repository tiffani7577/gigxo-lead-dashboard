import { Component, type ErrorInfo, type ReactNode, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const CITIES = [
  "miami",
  "fort-lauderdale",
  "orlando",
  "tampa",
  "jacksonville",
  "boca-raton",
  "west-palm-beach",
  "naples",
  "sarasota",
  "gainesville",
  "tallahassee",
  "pensacola",
  "daytona-beach",
  "melbourne",
  "fort-myers",
  "key-west",
  "clearwater",
  "st-petersburg",
  "ocala",
  "palm-beach",
] as const;

const SKILLS = [
  "A1 Audio Engineer",
  "A2 Audio Assistant",
  "Lighting Designer",
  "Lighting Tech",
  "LED Tech",
  "Stage Manager",
  "Stagehand",
  "Video Tech",
  "Backline Tech",
  "Production Manager",
] as const;

const EXPERIENCE = ["Less than 1 year", "1-3 years", "3-5 years", "5+ years"] as const;
const MIN_RATE = ["$150/day", "$200/day", "$250/day", "$300/day", "$400+/day"] as const;

function prettyCity(cityId: string) {
  return cityId
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function AVWorkerSignupContent() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [yearsExperience, setYearsExperience] = useState<(typeof EXPERIENCE)[number] | "">("");
  const [minDayRate, setMinDayRate] = useState<(typeof MIN_RATE)[number] | "">("");
  const [availableSameDay, setAvailableSameDay] = useState<"yes" | "no">("yes");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submitWorker = trpc.inbound.submitAVWorker.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (err) => toast.error(err.message || "Could not submit registration"),
  });

  const toggleSkill = (skill: string) => {
    setSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]));
  };

  const onSubmit = () => {
    if (!name || !phone || !email || !city) {
      toast.error("Please complete all required fields.");
      return;
    }
    if (skills.length === 0) {
      toast.error("Select at least one skill.");
      return;
    }
    submitWorker.mutate({
      name,
      phone,
      email,
      city,
      skills,
      yearsExperience: yearsExperience || undefined,
      minDayRate: minDayRate || undefined,
      availableSameDay: availableSameDay === "yes",
      notes: notes || undefined,
    });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="pt-8 text-center">
              <h2 className="text-2xl font-bold mb-3">You're registered!</h2>
              <p className="text-slate-300">
                We'll reach out when a gig matches your profile. Make sure your phone is on.
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
            <h1 className="text-3xl font-bold mb-3">Get Hired for AV Gigs in Florida</h1>
            <p className="text-slate-300 text-lg">
              Register once, get matched with paid crew calls that fit your skills and location. Free to join.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle>AV Worker Registration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Full Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Phone (We'll text you when a gig matches your skills)</Label>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>City</Label>
              <Select value={city || undefined} onValueChange={setCity}>
                <SelectTrigger className="w-full max-w-full"><SelectValue placeholder="Select city" /></SelectTrigger>
                <SelectContent>
                  {CITIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {prettyCity(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Skills</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {SKILLS.map((skill) => (
                  <label key={skill} className="text-sm flex items-center gap-2">
                    <input type="checkbox" checked={skills.includes(skill)} onChange={() => toggleSkill(skill)} />
                    <span>{skill}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>Years experience</Label>
              <Select
                value={yearsExperience || undefined}
                onValueChange={(v) => setYearsExperience(v as (typeof EXPERIENCE)[number])}
              >
                <SelectTrigger className="w-full max-w-full"><SelectValue placeholder="Select experience" /></SelectTrigger>
                <SelectContent>
                  {EXPERIENCE.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Minimum day rate</Label>
              <Select
                value={minDayRate || undefined}
                onValueChange={(v) => setMinDayRate(v as (typeof MIN_RATE)[number])}
              >
                <SelectTrigger className="w-full max-w-full"><SelectValue placeholder="Select day rate" /></SelectTrigger>
                <SelectContent>
                  {MIN_RATE.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Available for same-day calls?</Label>
              <Select value={availableSameDay} onValueChange={(v) => setAvailableSameDay(v as "yes" | "no")}>
                <SelectTrigger className="w-full max-w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Any notes about your experience</Label>
              <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <Button onClick={onSubmit} disabled={submitWorker.isPending} className="bg-purple-600 hover:bg-purple-700">
              {submitWorker.isPending ? "Submitting..." : "Register"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type BoundaryProps = { children: ReactNode };
type BoundaryState = { hasError: boolean };

class AVWorkerSignupBoundary extends Component<BoundaryProps, BoundaryState> {
  constructor(props: BoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AVWorkerSignup] render error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center px-4">
          <div className="max-w-md w-full rounded-xl border border-slate-700 bg-slate-900 p-8 text-center shadow-xl">
            <h1 className="text-xl font-semibold text-white mb-2">AV Worker Signup</h1>
            <p className="text-slate-400 text-sm mb-6">
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

export default function AVWorkerSignup() {
  return (
    <AVWorkerSignupBoundary>
      <AVWorkerSignupContent />
    </AVWorkerSignupBoundary>
  );
}
