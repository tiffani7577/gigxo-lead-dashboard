import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2, Mail } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";

export default function VerifyEmail() {
  const [location, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") ?? "";

  const [status, setStatus] = useState<"loading" | "success" | "error" | "no-token">(
    token ? "loading" : "no-token"
  );
  const [errorMsg, setErrorMsg] = useState("");

  const verifyMutation = trpc.auth.verifyEmailByToken.useMutation({
    onSuccess: () => setStatus("success"),
    onError: (err) => {
      setStatus("error");
      setErrorMsg(err.message);
    },
  });

  const resendMutation = trpc.auth.resendVerification.useMutation();

  useEffect(() => {
    if (token) {
      verifyMutation.mutate({ token });
    }
  }, [token]);

  if (status === "no-token") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-purple-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Check your email</h1>
          <p className="text-slate-400 mb-6">
            We sent a verification link to your email address. Click the link to verify your account and start browsing gig leads.
          </p>
          <p className="text-slate-500 text-sm mb-6">
            Didn't get the email? Check your spam folder, or{" "}
            <button
              onClick={() => resendMutation.mutate({ origin: window.location.origin })}
              className="text-purple-400 hover:text-purple-300 underline"
              disabled={resendMutation.isPending}
            >
              {resendMutation.isPending ? "Sending..." : "resend it"}
            </button>.
          </p>
          {resendMutation.isSuccess && (
            <p className="text-green-400 text-sm mb-4">Verification email resent!</p>
          )}
          <Link href="/dashboard">
            <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800">
              Continue to Dashboard
            </Button>
          </Link>
        </div>
        </div>
        <SiteFooter compact />
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Verifying your email...</p>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Email verified!</h1>
          <p className="text-slate-400 mb-8">
            Your email has been verified. You can now unlock gig leads and access all features.
          </p>
          <Link href="/dashboard">
            <Button className="bg-purple-600 hover:bg-purple-700 text-white w-full">
              Browse Gig Leads →
            </Button>
          </Link>
        </div>
        </div>
        <SiteFooter compact />
      </div>
    );
  }

  // Error state
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Verification failed</h1>
        <p className="text-slate-400 mb-6">{errorMsg || "This verification link is invalid or has expired."}</p>
        <div className="space-y-3">
          <Button
            onClick={() => resendMutation.mutate({ origin: window.location.origin })}
            disabled={resendMutation.isPending}
            className="bg-purple-600 hover:bg-purple-700 text-white w-full"
          >
            {resendMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
            ) : "Resend verification email"}
          </Button>
          {resendMutation.isSuccess && (
            <p className="text-green-400 text-sm">New verification email sent!</p>
          )}
          <Link href="/login">
            <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800 w-full">
              Back to Login
            </Button>
          </Link>
        </div>
      </div>
      </div>
      <SiteFooter compact />
    </div>
  );
}
