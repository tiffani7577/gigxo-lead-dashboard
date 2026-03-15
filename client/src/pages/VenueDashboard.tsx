import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, ArrowRight } from "lucide-react";

/**
 * Placeholder dashboard for venue managers (userType = 'venue').
 * Can be expanded with venue-specific leads, bookings, or intelligence.
 */
export default function VenueDashboard() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">Please sign in.</p>
        <Link href="/login"><Button className="ml-2">Sign in</Button></Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 text-slate-600 mb-6">
          <Building2 className="w-5 h-5" />
          <span className="font-medium">Venue Dashboard</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Welcome, {user.name || "Venue Manager"}</CardTitle>
            <CardDescription>
              You’re set up as a venue. Here you can manage your venue and see tools we’re building for you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600 text-sm">
              Venue-specific features (leads, bookings, analytics) can be added here. For now, you can browse the rest of Gigxo or visit admin venue intelligence if you have access.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/">
                <Button variant="outline" size="sm">
                  Home
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="outline" size="sm">
                  Lead marketplace
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
