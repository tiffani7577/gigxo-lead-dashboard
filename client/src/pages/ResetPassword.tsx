import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Music, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { SiteFooter } from "@/components/SiteFooter";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    setToken(t);
  }, []);

  const { mutate: resetPassword, isPending } = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      setDone(true);
      setTimeout(() => navigate("/login"), 3000);
    },
    onError: (e) => toast.error(e.message),
  });

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-slate-900 to-slate-950 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Invalid link</h2>
            <p className="text-slate-400 mb-6">This reset link is missing or invalid.</p>
            <Link href="/forgot-password">
              <Button className="bg-purple-600 hover:bg-purple-700">Request a new link</Button>
            </Link>
          </div>
        </div>
        <SiteFooter compact />
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-slate-900 to-slate-950 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Password updated!</h2>
            <p className="text-green-400 font-medium mb-2">Your password has been updated successfully.</p>
            <p className="text-slate-400 text-sm mb-6">You'll be redirected to sign in shortly.</p>
            <Link href="/login">
              <Button className="bg-purple-600 hover:bg-purple-700 text-white font-semibold">
                Sign in now
              </Button>
            </Link>
          </div>
        </div>
        <SiteFooter compact />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-slate-900 to-slate-950 flex flex-col">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl" />
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <Link href="/">
            <div className="inline-flex items-center gap-3 cursor-pointer">
              <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-600/30">
                <Music className="w-5 h-5 text-white" />
              </div>
              <span className="text-2xl font-bold text-white">Gigxo</span>
            </div>
          </Link>
        </div>

        <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-sm shadow-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-white text-xl">Choose a new password</CardTitle>
            <CardDescription className="text-slate-400">
              Make it at least 8 characters
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (password.length < 8) return toast.error("Password must be at least 8 characters");
                resetPassword({ token, newPassword: password });
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-slate-300 text-sm">New password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-purple-500 pr-10"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isPending}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold h-11"
              >
                {isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Updating...</> : "Update password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      </div>
      <SiteFooter compact />
    </div>
  );
}
