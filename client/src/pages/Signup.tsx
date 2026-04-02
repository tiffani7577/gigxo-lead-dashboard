import { useState, useEffect } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { setAuthToken } from "@/lib/authToken";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
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

export default function Signup() {
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [referralCode, setReferralCode] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) setReferralCode(`ref-${ref}`);
  }, []);

  const { mutate: signup, isPending } = trpc.auth.signup.useMutation({
    onSuccess: async (data) => {
      if (data.token) setAuthToken(data.token);
      toast.success("Welcome to GigXO!");
      window.location.href = "/dashboard";
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Please enter your name");
    if (!form.email.trim()) return toast.error("Please enter your email");
    if (form.password.length < 8) return toast.error("Password must be at least 8 characters");
    signup({ ...form, referralCode: referralCode ?? undefined });
  };

  const passwordStrength = (() => {
    const p = form.password;
    if (p.length === 0) return null;
    if (p.length < 8) return { label: "Too short", color: "#ef4444", width: "25%" };
    if (p.length < 10 && !/[A-Z]/.test(p)) return { label: "Weak", color: "#f97316", width: "50%" };
    if (/[A-Z]/.test(p) && /[0-9]/.test(p)) return { label: "Strong", color: "#22c55e", width: "100%" };
    return { label: "Good", color: "#c9a84c", width: "75%" };
  })();

  return (
    <div style={{ minHeight: '100vh', background: '#f9f7f4', display: 'flex', flexDirection: 'column' }}>
      {/* Subtle gold glow */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '15%', right: '25%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(201,168,76,0.05) 0%, transparent 70%)', borderRadius: '50%' }} />
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
        <div style={{ width: '100%', maxWidth: '440px', position: 'relative' }}>

          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <Link href="/">
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <rect width="32" height="32" rx="4" fill="#c9a84c" fillOpacity="0.12"/>
                  <path d="M4 20 Q8 10 12 16 Q16 22 20 10 Q23 2 28 12" stroke="#c9a84c" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
                </svg>
                <span style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#1c1c2e' }}>
                  Gig<span style={{ color: '#c9a84c' }}>XO</span>
                </span>
              </div>
            </Link>
            <p style={{ color: '#6b6860', marginTop: '0.5rem', fontSize: '0.85rem' }}>South Florida's Gig Lead Marketplace</p>
          </div>

          {referralCode && (
            <div style={{ marginBottom: '1rem', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: '4px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 style={{ width: '1rem', height: '1rem', color: '#c9a84c', flexShrink: 0 }} />
              <p style={{ color: '#c9a84c', fontSize: '0.82rem' }}>
                Referral applied — you'll get a launch promo on your first few leads.
              </p>
            </div>
          )}

          {/* Card */}
          <div style={{ background: '#ffffff', border: '1px solid rgba(201,168,76,0.15)', borderRadius: '4px', padding: '2rem', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
            <h1 style={{ color: '#1c1c2e', fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.35rem' }}>Create your account</h1>
            <p style={{ color: '#6b6860', fontSize: '0.82rem', marginBottom: '1.75rem', lineHeight: 1.5 }}>
              Join 50+ artists. Discovery $3 · Standard $7 · Premium $15 · Pro $49/mo. No commission. Ever.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <Label htmlFor="name" style={{ color: '#c9a84c', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Full name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="DJ Nova"
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  style={{ marginTop: '0.4rem', background: '#f0ede6', border: '1px solid rgba(201,168,76,0.2)', color: '#1c1c2e' }}
                  autoComplete="name"
                  required
                />
              </div>

              <div>
                <Label htmlFor="email" style={{ color: '#c9a84c', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                  style={{ marginTop: '0.4rem', background: '#f0ede6', border: '1px solid rgba(201,168,76,0.2)', color: '#1c1c2e' }}
                  autoComplete="email"
                  required
                />
              </div>

              <div>
                <Label htmlFor="password" style={{ color: '#c9a84c', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Password</Label>
                <div style={{ position: 'relative', marginTop: '0.4rem' }}>
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    value={form.password}
                    onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                    style={{ background: '#f0ede6', border: '1px solid rgba(201,168,76,0.2)', color: '#1c1c2e', paddingRight: '2.5rem' }}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6b6860', cursor: 'pointer' }}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordStrength && (
                  <div style={{ marginTop: '0.4rem' }}>
                    <div style={{ height: '3px', background: '#f0ede6', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: '2px', background: passwordStrength.color, width: passwordStrength.width, transition: 'width 0.3s' }} />
                    </div>
                    <p style={{ fontSize: '0.72rem', color: '#6b6860', marginTop: '0.25rem' }}>{passwordStrength.label}</p>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isPending}
                style={{ width: '100%', background: 'linear-gradient(135deg,#c9a84c,#e8c97a)', color: '#1c1c2e', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0.85rem', border: 'none', borderRadius: '2px', cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                {isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</> : "Create Account — It's Free"}
              </button>

              {/* Divider */}
              <div style={{ position: 'relative', margin: '0.25rem 0' }}>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: '100%', borderTop: '1px solid rgba(201,168,76,0.12)' }} />
                </div>
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                  <span style={{ background: '#ffffff', padding: '0 0.75rem', color: '#6b6860', fontSize: '0.75rem' }}>or sign up with</span>
                </div>
              </div>

              <a
                href={`/api/auth/google/login?origin=${encodeURIComponent(window.location.origin)}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', width: '100%', padding: '0.75rem', border: '1px solid rgba(201,168,76,0.2)', background: '#f0ede6', color: '#1c1c2e', fontSize: '0.85rem', fontWeight: 500, borderRadius: '2px', textDecoration: 'none' }}
              >
                <GoogleIcon />
                Sign up with Google
              </a>

              <p style={{ textAlign: 'center', color: '#6b6860', fontSize: '0.85rem' }}>
                Already have an account?{" "}
                <Link href="/login" style={{ color: '#c9a84c', fontWeight: 600, textDecoration: 'none' }}>
                  Sign in
                </Link>
              </p>
            </form>
          </div>

          <p style={{ textAlign: 'center', color: '#6b6860', fontSize: '0.72rem', marginTop: '1rem' }}>
            By signing up, you agree to our{" "}
            <Link href="/terms" style={{ color: '#c9a84c', textDecoration: 'none' }}>Terms of Service</Link>
            {" "}and{" "}
            <Link href="/privacy" style={{ color: '#c9a84c', textDecoration: 'none' }}>Privacy Policy</Link>.
          </p>
        </div>
      </div>
      <SiteFooter compact />
    </div>
  );
}
