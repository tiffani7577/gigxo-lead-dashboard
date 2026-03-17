import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { setAuthToken } from "@/lib/authToken";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Music, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { SiteFooter } from "@/components/SiteFooter";

// Simple Google icon SVG
function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  // Check for Google OAuth error in URL
  const urlParams = new URLSearchParams(window.location.search);
  const googleError = urlParams.get("error");

  const { mutate: login, isPending } = trpc.auth.login.useMutation({
    onSuccess: async (data) => {
      // Store token in localStorage — works in all browsers including Safari
      if (data.token) setAuthToken(data.token);
      toast.success("Welcome back!");
      window.location.href = "/dashboard";
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim() || !form.password) return;
    login(form);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-slate-900 to-slate-950 flex flex-col">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/">
            <div className="inline-flex items-center gap-3 cursor-pointer">
              <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-600/30">
                <Music className="w-5 h-5 text-white" />
              </div>
              <span className="text-2xl font-bold text-white">Gigxo</span>
            </div>
          </Link>
          <p className="text-slate-400 mt-2 text-sm">Miami & Fort Lauderdale Gig Leads</p>
        </div>

        <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-sm shadow-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-white text-xl">Sign in to Gigxo</CardTitle>
            <CardDescription className="text-slate-400">
              Access your gig leads, unlock contacts (Discovery $3, Standard $7, Premium $15), and manage your Pro subscription
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-slate-300 text-sm">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-purple-500 focus:ring-purple-500/20"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-slate-300 text-sm">Password</Label>
                  <Link href="/forgot-password" className="text-purple-400 hover:text-purple-300 text-xs">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Your password"
                    value={form.password}
                    onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-purple-500 focus:ring-purple-500/20 pr-10"
                    autoComplete="current-password"
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
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold h-11 shadow-lg shadow-purple-600/20"
              >
                {isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Signing in...</>
                ) : (
                  "Sign in"
                )}
              </Button>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-600" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-slate-800/60 px-3 text-slate-400">or continue with</span>
                </div>
              </div>

              {/* Google Sign In — user login only (separate from Microsoft Graph / outreach) */}
              <a
                href={`/api/auth/google/login?origin=${encodeURIComponent(window.location.origin)}`}
                className="flex items-center justify-center gap-3 w-full h-11 rounded-md border border-slate-600 bg-slate-700/50 hover:bg-slate-700 text-white text-sm font-medium transition-colors"
              >
                <GoogleIcon />
                Continue with Google
              </a>

              {googleError && (
                <p className="text-center text-red-400 text-sm">
                  {googleError === "google_cancelled" ? "Google sign-in was cancelled." : "Google sign-in failed. Please try again."}
                </p>
              )}

              <p className="text-center text-slate-400 text-sm">
                Don't have an account?{" "}
                <Link href="/signup" className="text-purple-400 hover:text-purple-300 font-medium">
                  Create one free
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
      </div>
      <SiteFooter compact />
    </div>
  );
}
