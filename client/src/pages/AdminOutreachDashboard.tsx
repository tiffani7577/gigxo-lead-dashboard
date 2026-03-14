import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Link2, List, FileText } from "lucide-react";
import { useLocation } from "wouter";

const MICROSOFT_LOGIN_PATH = "/api/auth/microsoft/login";

export default function AdminOutreachDashboard() {
  const [, setLocation] = useLocation();
  const { data: inbox, isLoading } = trpc.admin.getMicrosoftInboxStatus.useQuery();
  const [connecting, setConnecting] = useState(false);

  const handleConnect = () => {
    setConnecting(true);
    const redirect = encodeURIComponent("/admin/outreach");
    window.location.href = `${MICROSOFT_LOGIN_PATH}?redirect=${redirect}`;
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Outreach Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Teryn persona — emails are prepared automatically but only send when you click Send.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Microsoft Inbox
            </CardTitle>
            <CardDescription>Connect the inbox used to send outreach as Teryn (teryn@gigxo.com).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Checking connection…</p>
            ) : inbox?.connected ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Connected inbox:</span>
                <a href={`mailto:${inbox.connectedEmail}`} className="text-primary hover:underline font-medium">
                  {inbox.connectedEmail}
                </a>
              </div>
            ) : (
              <Button onClick={handleConnect} disabled={connecting}>
                <Link2 className="h-4 w-4 mr-2" />
                {connecting ? "Redirecting…" : "Connect Microsoft Inbox"}
              </Button>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setLocation("/admin/outreach/leads")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <List className="h-4 w-4" />
                Leads
              </CardTitle>
              <CardDescription>View leads, preview emails, and send (manual send only).</CardDescription>
            </CardHeader>
          </Card>
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setLocation("/admin/outreach/templates")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Templates
              </CardTitle>
              <CardDescription>Create and edit email templates. Variables: {"{{name}}"}, {"{{venue}}"}, {"{{city}}"}</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
