import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { setAuthToken } from "@/lib/authToken";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { SiteFooter } from "@/components/SiteFooter";

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

  const urlParams = new URLSearchParams(window.location.search);
  const googleError = urlParams.get("error");

  const { mutate: login, isPending } = trpc.auth.login.useMutation({
    onSuccess: async (data) => {
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
    <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', flexDirection: 'column' }}>
      {/* Subtle gold glow */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '20%', left: '30%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%)', borderRadius: '50%' }} />
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
        <div style={{ width: '100%', maxWidth: '420px', position: 'relative' }}>

          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <Link href="/">
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <rect width="32" height="32" rx="4" fill="#c9a84c" fillOpacity="0.12"/>
                  <path d="M4 20 Q8 10 12 16 Q16 22 20 10 Q23 2 28 12" stroke="#c9a84c" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
                </svg>
                <span style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#f0ece0' }}>
                  Gig<span style={{ color: '#c9a84c' }}>XO</span>
                </span>
              </div>
            </Link>
            <p style={{ color: '#888880', marginTop: '0.5rem', fontSize: '0.85rem' }}>South Florida's Gig Lead Marketplace</p>
          </div>

          {/* Card */}
          <div style={{ background: '#111111', border: '1px solid rgba(201,168,76,0.15)', borderRadius: '4px', padding: '2rem', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
            <h1 style={{ color: '#f0ece0', fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.35rem' }}>Sign in to GigXO</h1>
            <p style={{ color: '#888880', fontSize: '0.82rem', marginBottom: '1.75rem', lineHeight: 1.5 }}>
              Access leads · Discovery $3 · Standard $7 · Premium $15 · Pro $49/mo
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <Label htmlFor="email" style={{ color: '#c9a84c', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                  style={{ marginTop: '0.4rem', background: '#1a1a1a', border: '1px solid rgba(201,168,76,0.2)', color: '#f0ece0' }}
                  autoComplete="email"
                  required
                />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Label htmlFor="password" style={{ color: '#c9a84c', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Password</Label>
                  <Link href="/forgot-password" style={{ color: '#c9a84c', fontSize: '0.75rem', textDecoration: 'none' }}>
                    Forgot password?
                  </Link>
                </div>
                <div style={{ position: 'relative', marginTop: '0.4rem' }}>
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Your password"
                    value={form.password}
                    onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                    style={{ background: '#1a1a1a', border: '1px solid rgba(201,168,76,0.2)', color: '#f0ece0', paddingRight: '2.5rem' }}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#888880', cursor: 'pointer' }}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending}
                style={{ width: '100%', background: 'linear-gradient(135deg,#c9a84c,#e8c97a)', color: '#080808', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0.85rem', border: 'none', borderRadius: '2px', cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                {isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : "Sign In"}
              </button>

              {/* Divider */}
              <div style={{ position: 'relative', margin: '0.25rem 0' }}>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: '100%', borderTop: '1px solid rgba(201,168,76,0.12)' }} />
                </div>
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                  <span style={{ background: '#111111', padding: '0 0.75rem', color: '#888880', fontSize: '0.75rem' }}>or continue with</span>
                </div>
              </div>

              <a
                href={`/api/auth/google/login?origin=${encodeURIComponent(window.location.origin)}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', width: '100%', padding: '0.75rem', border: '1px solid rgba(201,168,76,0.2)', background: '#1a1a1a', color: '#f0ece0', fontSize: '0.85rem', fontWeight: 500, borderRadius: '2px', textDecoration: 'none', transition: 'border-color 0.2s' }}
              >
                <GoogleIcon />
                Continue with Google
              </a>

              {googleError && (
                <p style={{ textAlign: 'center', color: '#ef4444', fontSize: '0.85rem' }}>
                  {googleError === "google_cancelled" ? "Google sign-in was cancelled." : "Google sign-in failed. Please try again."}
                </p>
              )}

              <p style={{ textAlign: 'center', color: '#888880', fontSize: '0.85rem' }}>
                Don't have an account?{" "}
                <Link href="/signup" style={{ color: '#c9a84c', fontWeight: 600, textDecoration: 'none' }}>
                  Create one free
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
      <SiteFooter compact />
    </div>
  );
}
