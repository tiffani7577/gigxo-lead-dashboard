import { Component, type ReactNode, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Tab = "requests" | "workers";

function parseField(text: string | null | undefined, key: string): string {
  if (!text) return "";
  const line = text.split("\n").find((l) => l.toLowerCase().startsWith(`${key.toLowerCase()}:`));
  return line ? line.split(":").slice(1).join(":").trim() : "";
}

function parseStatus(notes: string | null | undefined): "new" | "in_progress" | "fulfilled" {
  const raw = (notes ?? "")
    .split("\n")
    .find((line) => line.startsWith("avStatus="))
    ?.split("=")[1]
    ?.trim();
  if (raw === "in_progress" || raw === "fulfilled") return raw;
  return "new";
}

/** Catches render errors in AV admin subtree (hooks/async errors still need query error UI). */
class AVAdminErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="text-center text-slate-900">AV Admin Error</div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AdminAVRequests() {
  const { user, isAuthenticated } = useAuth();
  const [tab, setTab] = useState<Tab>("requests");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [citySearch, setCitySearch] = useState("");
  const [skillSearch, setSkillSearch] = useState("");

  const {
    data: requestsData,
    refetch: refetchRequests,
    isLoading: loadingRequests,
    isError: requestsError,
    error: requestsErr,
  } = trpc.admin.getAVRequests.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const {
    data: workersData,
    isLoading: loadingWorkers,
    isError: workersError,
    error: workersErr,
  } = trpc.admin.getAVWorkers.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  /** tRPC can yield `null`; default `data: x = []` only replaces `undefined`, not `null`. */
  const requests = Array.isArray(requestsData) ? requestsData : [];
  const workers = Array.isArray(workersData) ? workersData : [];

  const updateStatus = trpc.admin.updateAVRequestStatus.useMutation({
    onSuccess: () => {
      toast.success("Status updated");
      refetchRequests();
    },
    onError: (e) => toast.error(e.message),
  });

  const filteredWorkers = useMemo(() => {
    return (workers ?? []).filter((w: any) => {
      const skillsText = String(w?.skills ?? "").toLowerCase();
      const cityOk = citySearch ? String(w?.city ?? "").toLowerCase().includes(citySearch.toLowerCase()) : true;
      const skillOk = skillSearch ? skillsText.includes(skillSearch.toLowerCase()) : true;
      return cityOk && skillOk;
    });
  }, [workers, citySearch, skillSearch]);

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2 text-slate-900">Access Denied</h1>
          <p className="text-slate-600">Admin access required</p>
        </div>
      </div>
    );
  }

  try {
    return (
      <AVAdminErrorBoundary>
        <DashboardLayout>
          <div className="min-h-screen bg-slate-50">
            <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-900">AV Staffing</h1>
                <div className="flex gap-2">
                  <Button variant={tab === "requests" ? "default" : "outline"} onClick={() => setTab("requests")}>
                    Crew Requests
                  </Button>
                  <Button variant={tab === "workers" ? "default" : "outline"} onClick={() => setTab("workers")}>
                    AV Workers
                  </Button>
                </div>
              </div>

              {requestsError ? (
                <p className="text-sm text-red-600">
                  Could not load AV requests: {requestsErr?.message ?? "Unknown error"}
                </p>
              ) : null}
              {workersError ? (
                <p className="text-sm text-red-600">
                  Could not load AV workers: {workersErr?.message ?? "Unknown error"}
                </p>
              ) : null}

              {tab === "requests" ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Crew Requests</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {loadingRequests ? <p>Loading...</p> : null}
                    {!loadingRequests && !requestsError && requests.length === 0 ? (
                      <p className="text-sm text-slate-500">No AV requests yet.</p>
                    ) : null}
                    {(requests ?? []).map((r: any, idx: number) => {
                      const roles = parseField(r?.description, "Roles Needed");
                      const urgency = parseField(r?.description, "Urgency");
                      const payRate = parseField(r?.description, "Pay Rate per Person");
                      const company = parseField(r?.description, "Company/Event Name");
                      const status = parseStatus(r?.notes);
                      const contact = `${r?.contactName ?? "-"} · ${r?.contactEmail ?? "-"} · ${r?.contactPhone ?? "-"}`;
                      return (
                        <div key={r?.id ?? `req-${idx}`} className="border rounded-lg p-3 bg-white">
                          <div className="grid grid-cols-1 md:grid-cols-8 gap-2 text-sm">
                            <div>
                              <span className="font-medium">Company/Event:</span> {company || (r?.title ?? "-")}
                            </div>
                            <div>
                              <span className="font-medium">Date:</span>{" "}
                              {r?.eventDate ? new Date(r.eventDate).toLocaleDateString() : "-"}
                            </div>
                            <div>
                              <span className="font-medium">Location:</span> {r?.location ?? "-"}
                            </div>
                            <div>
                              <span className="font-medium">Roles:</span> {roles || "-"}
                            </div>
                            <div>
                              <span className="font-medium">Urgency:</span> {urgency || "-"}
                            </div>
                            <div>
                              <span className="font-medium">Contact:</span> {contact}
                            </div>
                            <div>
                              <span className="font-medium">Pay Rate:</span> {payRate || "-"}
                            </div>
                            <div>
                              <Badge variant="secondary">{status.replace(/_/g, " ")}</Badge>
                            </div>
                          </div>
                          <div className="mt-3 flex gap-2 flex-wrap">
                            <Button
                              size="sm"
                              variant={status === "new" ? "default" : "outline"}
                              onClick={() => r?.id != null && updateStatus.mutate({ id: r.id, status: "new" })}
                            >
                              New
                            </Button>
                            <Button
                              size="sm"
                              variant={status === "in_progress" ? "default" : "outline"}
                              onClick={() => r?.id != null && updateStatus.mutate({ id: r.id, status: "in_progress" })}
                            >
                              In Progress
                            </Button>
                            <Button
                              size="sm"
                              variant={status === "fulfilled" ? "default" : "outline"}
                              onClick={() => r?.id != null && updateStatus.mutate({ id: r.id, status: "fulfilled" })}
                            >
                              Fulfilled
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setExpandedId(expandedId === r?.id ? null : r?.id ?? null)}
                            >
                              {expandedId === r?.id ? "Hide Details" : "Expand Details"}
                            </Button>
                          </div>
                          {expandedId === r?.id ? (
                            <pre className="mt-3 text-xs bg-slate-50 border rounded p-3 whitespace-pre-wrap">
                              {r?.description ?? ""}
                            </pre>
                          ) : null}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>AV Workers</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <Input placeholder="Search by city" value={citySearch} onChange={(e) => setCitySearch(e.target.value)} />
                      <Input placeholder="Search by skill" value={skillSearch} onChange={(e) => setSkillSearch(e.target.value)} />
                    </div>
                    {loadingWorkers ? <p>Loading...</p> : null}
                    {!loadingWorkers && !workersError && filteredWorkers.length === 0 ? (
                      <p className="text-sm text-slate-500">No AV workers yet.</p>
                    ) : null}
                    {(filteredWorkers ?? []).map((w: any, idx: number) => {
                      const skillsText = (() => {
                        try {
                          const arr = JSON.parse(String(w?.skills ?? "[]"));
                          return Array.isArray(arr) ? arr.join(", ") : String(w?.skills ?? "");
                        } catch {
                          return String(w?.skills ?? "");
                        }
                      })();
                      return (
                        <div
                          key={w?.id ?? `worker-${idx}`}
                          className="border rounded-lg p-3 bg-white grid grid-cols-1 md:grid-cols-6 gap-2 text-sm"
                        >
                          <div>
                            <span className="font-medium">Name:</span> {w?.name ?? "-"}
                          </div>
                          <div>
                            <span className="font-medium">Phone:</span> {w?.phone ?? "-"}
                          </div>
                          <div>
                            <span className="font-medium">City:</span> {w?.city ?? "-"}
                          </div>
                          <div>
                            <span className="font-medium">Skills:</span> {skillsText}
                          </div>
                          <div>
                            <span className="font-medium">Min Rate:</span> {w?.minDayRate ?? "-"}
                          </div>
                          <div>
                            <span className="font-medium">Same Day:</span> {(w?.availableSameDay ?? false) ? "Yes" : "No"}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </DashboardLayout>
      </AVAdminErrorBoundary>
    );
  } catch {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center text-slate-900">AV Admin Error</div>
      </div>
    );
  }
}
