import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Music, Calendar, Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";

const REDIRECTS: Record<string, string> = {
  performer: "/dashboard",
  client: "/book",
  venue: "/venue-dashboard",
};

export default function Welcome() {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();

  const setUserType = trpc.auth.setUserType.useMutation({
    onSuccess: (_, variables) => {
      utils.auth.me.invalidate();
      const path = REDIRECTS[variables.userType];
      if (path) setLocation(path);
    },
    onError: (e) => toast.error(e.message),
  });

  // Already has userType → redirect to appropriate place (show once only)
  useEffect(() => {
    if (loading || !user) return;
    if (user.userType) {
      setLocation(REDIRECTS[user.userType] ?? "/dashboard");
    }
  }, [user, loading, setLocation]);

  // Not logged in → send to login
  useEffect(() => {
    if (loading) return;
    if (!user) {
      setLocation("/login");
    }
  }, [user, loading, setLocation]);

  const handleChoice = (userType: "performer" | "client" | "venue") => {
    setUserType.mutate({ userType });
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  // Skip rendering form if we're about to redirect (userType already set)
  if (user.userType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-slate-900 to-slate-950 flex flex-col">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
      </div>

      <div className="flex-1 flex items-center justify-center p-4 relative">
        <div className="w-full max-w-lg">
          <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-sm shadow-2xl">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-white text-xl">Welcome to Gigxo</CardTitle>
              <CardDescription className="text-slate-400">
                What brings you to Gigxo?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              <Button
                variant="outline"
                className="w-full h-auto py-4 px-4 justify-start gap-3 bg-slate-800/80 border-slate-600 hover:bg-slate-700 hover:border-purple-500/50 text-white"
                onClick={() => handleChoice("performer")}
                disabled={setUserType.isPending}
              >
                <Music className="w-5 h-5 text-purple-400 shrink-0" />
                <span className="text-left">
                  I&apos;m a performer (DJ, band, photographer, etc.)
                </span>
              </Button>
              <Button
                variant="outline"
                className="w-full h-auto py-4 px-4 justify-start gap-3 bg-slate-800/80 border-slate-600 hover:bg-slate-700 hover:border-purple-500/50 text-white"
                onClick={() => handleChoice("client")}
                disabled={setUserType.isPending}
              >
                <Calendar className="w-5 h-5 text-purple-400 shrink-0" />
                <span className="text-left">I&apos;m planning an event</span>
              </Button>
              <Button
                variant="outline"
                className="w-full h-auto py-4 px-4 justify-start gap-3 bg-slate-800/80 border-slate-600 hover:bg-slate-700 hover:border-purple-500/50 text-white"
                onClick={() => handleChoice("venue")}
                disabled={setUserType.isPending}
              >
                <Building2 className="w-5 h-5 text-purple-400 shrink-0" />
                <span className="text-left">I manage a venue</span>
              </Button>
              {setUserType.isPending && (
                <p className="text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Taking you there...
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
