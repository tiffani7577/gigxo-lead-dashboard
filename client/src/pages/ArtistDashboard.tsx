import { Button } from "@/components/ui/button";
import StripePaymentDialog from "@/components/StripePaymentDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { clearAuthToken } from "@/lib/authToken";
import { useState, useEffect, useRef, Component } from "react";
import { Link } from "wouter";
import {
  Loader2, MapPin, DollarSign, Calendar, Phone, Mail, Lock, Unlock,
  Search, Music, User, Gift, Copy, Check, Eye,
  ChevronRight, Zap, Star, LogOut, Users, Sparkles, Flame, ThumbsUp, ThumbsDown, MessageSquare, BarChart2, Building2, ExternalLink, Clock3,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import NotificationBell from "@/components/NotificationBell";

class ErrorBoundary extends Component<{ children: any }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center max-w-md w-full">
            <p className="text-slate-900 font-semibold mb-2">An unexpected error occurred</p>
            <p className="text-slate-500 text-sm">Please refresh the page.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const EVENT_TYPES = [
  "All", "Wedding", "Corporate Event", "Nightclub", "Pool Party", "Private Party",
  "Festival", "After Party", "Bar Gig", "Restaurant Event", "Yacht Party",
  "Art Opening", "Charity Gala", "Birthday Party", "Quinceañera",
];

const CITY_MARKETS = [
  { id: "all", label: "All Cities" },
  { id: "miami", label: "Miami" },
  { id: "nyc", label: "New York City" },
  { id: "la", label: "Los Angeles" },
  { id: "chicago", label: "Chicago" },
  { id: "houston", label: "Houston" },
  { id: "dallas", label: "Dallas" },
  { id: "atlanta", label: "Atlanta" },
  { id: "las_vegas", label: "Las Vegas" },
  { id: "nashville", label: "Nashville" },
  { id: "orlando", label: "Orlando" },
  { id: "phoenix", label: "Phoenix" },
  { id: "dc", label: "Washington DC" },
];

const PERFORMER_TYPES: { value: string; label: string; icon: string }[] = [
  { value: "all", label: "All Types", icon: "🎵" },
  { value: "dj", label: "DJ", icon: "🎧" },
  { value: "singer", label: "Singer", icon: "🎤" },
  { value: "solo_act", label: "Solo Act", icon: "🎸" },
  { value: "small_band", label: "Small Band", icon: "🎷" },
  { value: "large_band", label: "Large Band", icon: "🎺" },
  { value: "instrumentalist", label: "Instrumentalist", icon: "🎹" },
  { value: "immersive_experience", label: "Immersive", icon: "✨" },
  { value: "hybrid_electronic", label: "Hybrid Electronic", icon: "🎛️" },
  { value: "photo_video", label: "Photo/Video", icon: "📸" },
  { value: "photo_booth", label: "Photo Booth", icon: "🪞" },
  { value: "makeup_artist", label: "Makeup Artist", icon: "💄" },
  { value: "emcee", label: "Emcee/Host", icon: "🎙️" },
  { value: "princess_character", label: "Princess/Character", icon: "👑" },
  { value: "photographer", label: "Photographer", icon: "📷" },
  { value: "videographer", label: "Videographer", icon: "🎬" },
  { value: "audio_engineer", label: "Audio Engineer", icon: "🔊" },
  { value: "other", label: "Other", icon: "🎶" },
];

function formatBudget(cents: number | null) {
  if (!cents) return "";
  const dollars = cents / 100;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return `$${dollars.toFixed(0)}`;
}

function buildOutreachMailto(
  email: string,
  venueName: string | null | undefined,
  location: string | null | undefined,
  contactName?: string | null,
  performerType?: string | null
): string {
  const safeVenue = String(venueName ?? "").trim() || "Venue";
  const city = String(location ?? "").split(",")[0]?.trim() || String(location ?? "").trim() || "your city";
  const safeName = String(contactName ?? "").trim() || "there";
  const genreLabel =
    PERFORMER_TYPES.find((p) => p.value === performerType)?.label ??
    "live entertainment";
  const subject = `Entertainment Inquiry: ${safeVenue}`;
  const body = [
    `Hi ${safeName},`,
    "",
    `I saw your new license listing for ${safeVenue} in ${city} and wanted to reach out regarding your entertainment needs.`,
    `I am a local performer specializing in ${genreLabel} and would love to share options for your venue.`,
    "",
    "If helpful, I can send over availability, rates, and sample sets.",
    "",
    "Best,",
  ].join("\n");
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function getLeadDisplayPriceCents(lead: any): number {
  if (lead && lead.unlockPriceCents != null) {
    const cents = Number(lead.unlockPriceCents) || 0;
    const valid = [300, 700, 1500];
    if (!Number.isFinite(cents) || cents <= 0) return valid[0];
    return valid.reduce(
      (closest, value) =>
        Math.abs(value - cents) < Math.abs(closest - cents) ? value : closest,
      valid[0],
    );
  }
  const tier = lead?.leadTier as string | undefined;
  if (tier === "starter_friendly") return 300;
  if (tier === "premium") return 1500;
  if (tier === "standard") return 700;
  return 700;
}

function formatLeadStatusLabel(status: string | null | undefined): string {
  const value = String(status ?? "").trim();
  if (!value) return "";
  if (value === "new") return "New";
  if (value === "contacted") return "Contacted";
  if (value === "followed_up") return "Followed Up";
  if (value === "booked") return "Booked";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Facebook / Meta + Instagram profile-style paths that must not appear in pre-unlock copy. */
const SOCIAL_PROFILE_URL_RE =
  /(?:https?:\/\/)?(?:www\.|m\.)?(?:facebook\.com|fb\.com|fb\.me)\/[^\s<>"')\]]+|(?:https?:\/\/)?(?:www\.)?instagram\.com\/[^\s<>"')\]]+/gi;

function normalizeSocialProfileUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t.replace(/^\/+/, "")}`;
}

function textContainsSocialProfileUrl(text: string): boolean {
  if (!text) return false;
  SOCIAL_PROFILE_URL_RE.lastIndex = 0;
  return SOCIAL_PROFILE_URL_RE.test(text);
}

function stripSocialProfileUrls(text: string): string {
  if (!text) return text;
  return text
    .replace(SOCIAL_PROFILE_URL_RE, "")
    .replace(/\[link removed\]\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Primary contact is via profile link (matches server hasFacebookProfileLink; client fallback if stale API). */
function showFacebookProfileLeadCta(lead: any): boolean {
  if ((lead as any).hasFacebookProfileLink) return true;
  const hasEmail = !!(lead as any).hasContactEmail;
  const hasPhone = !!(lead as any).hasContactPhone;
  if (hasEmail || hasPhone) return false;
  const blob = [lead?.publicPreviewDescription, lead?.description, lead?.fullDescription, lead?.venueUrl]
    .filter(Boolean)
    .join("\n");
  return textContainsSocialProfileUrl(blob);
}

function extractFirstSocialProfileUrl(text: string): string | null {
  if (!text) return null;
  SOCIAL_PROFILE_URL_RE.lastIndex = 0;
  const m = text.match(SOCIAL_PROFILE_URL_RE);
  return m?.[0] ? normalizeSocialProfileUrl(m[0]) : null;
}

/** After unlock: venueUrl if it is a social URL, else first social URL in full description. */
function getSocialProfileUrlForLead(lead: any): string | null {
  if (!lead?.isUnlocked) return null;
  const vu = String(lead?.venueUrl ?? "").trim();
  if (vu && textContainsSocialProfileUrl(vu)) return normalizeSocialProfileUrl(vu);
  const body = String(lead?.fullDescription ?? lead?.description ?? "");
  return extractFirstSocialProfileUrl(body);
}

function getLeadDescriptionForDisplay(lead: any): string {
  const preview = String(lead?.publicPreviewDescription ?? "").trim();
  const full = String(lead?.fullDescription ?? lead?.description ?? "").trim();
  const raw = lead?.isUnlocked ? full || preview : preview || full.slice(0, 150);
  return stripSocialProfileUrls(raw);
}

function getPreviewTags(lead: any): string[] {
  const text = String(lead?.publicPreviewDescription ?? lead?.description ?? "").toLowerCase();
  const tags: string[] = [];
  if (/wedding/.test(text) || /wedding/i.test(String(lead?.eventType ?? ""))) tags.push("Wedding");
  if (/bilingual|spanish/.test(text)) tags.push("Bilingual Required");
  if (/actively looking|urgent|asap|book now/.test(text)) tags.push("High Intent");
  return tags.slice(0, 3);
}

function getSourceBadgeColor(source: string) {
  switch (source) {
    case "gigxo": return "bg-transparent text-stone-500";
    case "manual": return "bg-transparent text-stone-500";
    case "eventbrite": return "bg-orange-100 text-orange-700";
    case "thumbtack": return "bg-transparent text-stone-500";
    case "yelp": return "bg-red-100 text-red-700";
    case "craigslist": return "bg-amber-100 text-amber-700";
    case "nextdoor": return "bg-green-100 text-green-700";
    case "facebook": return "bg-transparent text-stone-500";
    default: return "bg-gray-100 text-gray-700";
  }
}

function getSourceLabel(source: string) {
  switch (source) {
    case "gigxo": return "Gigxo";
    case "manual": return "Gigxo";
    case "eventbrite": return "Eventbrite";
    case "thumbtack": return "Thumbtack";
    case "yelp": return "Yelp";
    case "craigslist": return "Craigslist";
    case "nextdoor": return "Nextdoor";
    case "facebook": return "Facebook";
    default: return "Gigxo";
  }
}

type Tab = "leads" | "unlocked" | "referrals" | "inquiries" | "packs";
type LeadProgressStatus = "new" | "contacted" | "followed_up" | "booked";

type InquiryStatus = "new" | "read" | "replied" | "booked" | "declined";
type Inquiry = {
  id: number;
  inquirerName: string;
  inquirerEmail: string;
  inquirerPhone?: string | null;
  eventType?: string | null;
  eventDate?: string | null;
  eventLocation?: string | null;
  budget?: string | null;
  message?: string | null;
  status: InquiryStatus;
  artistNotes?: string | null;
  bookingStage?: string | null;
  createdAt: Date;
};

const STATUS_CONFIG: Record<InquiryStatus, { label: string; bg: string; text: string; dot: string }> = {
  new:      { label: "New",      bg: "bg-transparent", text: "text-stone-400", dot: "bg-stone-500" },
  read:     { label: "Read",     bg: "bg-slate-100",  text: "text-slate-600",  dot: "bg-slate-400" },
  replied:  { label: "Replied",  bg: "bg-transparent", text: "text-stone-400",   dot: "bg-stone-500" },
  booked:   { label: "Booked",   bg: "bg-green-100",  text: "text-green-700",  dot: "bg-green-500" },
  declined: { label: "Declined", bg: "bg-red-100",    text: "text-red-700",    dot: "bg-red-400" },
};

function InquiriesTab({ inquiries, onUpdateStatus }: {
  inquiries: Inquiry[];
  onUpdateStatus: (args: { inquiryId: number; status: InquiryStatus; artistNotes?: string }) => void;
}) {
  const [filterStatus, setFilterStatus] = useState<InquiryStatus | "all">("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const utils = trpc.useUtils();

  const safeInquiries = (inquiries ?? []) as Inquiry[];
  const filtered = filterStatus === "all" ? safeInquiries : (safeInquiries ?? []).filter(i => i.status === filterStatus);
  const counts = (safeInquiries ?? []).reduce((acc, i) => { acc[i.status] = (acc[i.status] ?? 0) + 1; return acc; }, {} as Record<string, number>);

  const handleStatusChange = (inquiry: Inquiry, status: InquiryStatus) => {
    onUpdateStatus({ inquiryId: inquiry.id, status, artistNotes: notes[inquiry.id] ?? inquiry.artistNotes ?? undefined });
  };

  const handleSaveNotes = (inquiry: Inquiry) => {
    onUpdateStatus({ inquiryId: inquiry.id, status: inquiry.status, artistNotes: notes[inquiry.id] });
    utils.booking.getMyInquiries.invalidate();
    toast.success("Notes saved");
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Booking Inquiries</h2>
          <p className="text-slate-500 text-sm mt-0.5">Manage requests from clients who want to book you.</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-slate-900">{(safeInquiries ?? []).length}</p>
          <p className="text-xs text-slate-500">total inquiries</p>
        </div>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        {(["all", "new", "replied", "booked", "declined"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filterStatus === s
                ? "border border-amber-400 bg-amber-50 text-amber-800 font-medium"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {s === "all" ? `All (${(safeInquiries ?? []).length})` : `${STATUS_CONFIG[s].label} (${counts[s] ?? 0})`}
          </button>
        ))}
      </div>

      {(filtered ?? []).length === 0 ? (
        <Card className="border-dashed border-slate-300">
          <CardContent className="p-12 text-center">
            <Mail className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">{(safeInquiries ?? []).length === 0 ? "No inquiries yet" : "No inquiries match this filter"}</p>
            <p className="text-slate-400 text-sm mt-1">{(safeInquiries ?? []).length === 0 ? "Share your profile link to start receiving booking requests" : "Try a different status filter above"}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(filtered ?? []).map((inquiry) => {
            const cfg = STATUS_CONFIG[inquiry.status];
            const isExpanded = expandedId === inquiry.id;
            const noteVal = notes[inquiry.id] ?? inquiry.artistNotes ?? "";
            return (
              <Card key={inquiry.id} className={`border transition-all ${
                inquiry.status === "new" ? "shadow-sm" : "border-slate-200"
              }`}>
                <CardContent className="p-0">
                  {/* Header row */}
                  <div
                    className="p-4 cursor-pointer select-none"
                    onClick={() => setExpandedId(isExpanded ? null : inquiry.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <User className="w-4 h-4 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900">{inquiry.inquirerName}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.text}`}>
                              <span className={`inline-block w-1.5 h-1.5 rounded-full ${cfg.dot} mr-1 mb-px`} />
                              {cfg.label}
                            </span>
                            {inquiry.status === "new" && (
                              <span className="text-xs px-1.5 py-0.5 rounded font-medium animate-pulse" style={{background:"#c9a84c",color:"#1c1c2e"}}>NEW</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-1">
                            <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{inquiry.inquirerEmail}</span>
                            {inquiry.inquirerPhone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{inquiry.inquirerPhone}</span>}
                            {inquiry.eventType && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{inquiry.eventType}</span>}
                            {inquiry.eventDate && <span>{inquiry.eventDate}</span>}
                            {inquiry.budget && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{inquiry.budget}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <p className="text-xs text-slate-400 hidden sm:block">
                          {new Date(inquiry.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                      </div>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
                      {inquiry.message && (
                        <div className="bg-slate-50 rounded-lg p-3">
                          <p className="text-xs font-medium text-slate-500 mb-1">Message from client</p>
                          <p className="text-sm text-slate-700">{inquiry.message}</p>
                        </div>
                      )}
                      {inquiry.eventLocation && (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <MapPin className="w-4 h-4 text-slate-400" />
                          <span>{inquiry.eventLocation}</span>
                        </div>
                      )}

                      {/* Notes */}
                      <div>
                        <label className="text-xs font-medium text-slate-500 block mb-1">Your private notes</label>
                        <textarea
                          value={noteVal}
                          onChange={(e) => setNotes(n => ({ ...n, [inquiry.id]: e.target.value }))}
                          placeholder="Add notes about this inquiry (only you can see this)..."
                          rows={2}
                          className="w-full text-sm border rounded-lg p-2 resize-none" style={{borderColor:"#e8e4dc",color:"#1c1c2e"}}
                        />
                      </div>

                      {/* Action row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex-1">
                          <label className="text-xs font-medium text-slate-500 block mb-1">Update status</label>
                          <div className="flex flex-wrap gap-1.5">
                            {(["read", "replied", "booked", "declined"] as InquiryStatus[]).map((s) => (
                              <button
                                key={s}
                                onClick={() => handleStatusChange(inquiry, s)}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
                                  inquiry.status === s
                                    ? `${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].text} border-transparent`
                                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                }`}
                              >
                                {STATUS_CONFIG[s].label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={() => handleSaveNotes(inquiry)}
                            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md font-medium"
                          >
                            Save Notes
                          </button>
                          <a
                            href={`mailto:${inquiry.inquirerEmail}?subject=Re: Your booking inquiry`}
                            className="text-xs px-3 py-1.5 rounded-md font-medium flex items-center gap-1" style={{background:"#c9a84c",color:"#1c1c2e"}}
                          >
                            <Mail className="w-3 h-3" /> Reply by Email
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreditPackButton({ packId, highlighted }: { packId: "pack_3" | "pack_10" | "pack_25"; highlighted: boolean }) {
  const { mutate, isPending } = trpc.payments.purchaseCreditPack.useMutation({
    onSuccess: (data: { checkoutUrl: string | null }) => {
      const url = data.checkoutUrl?.trim();
      if (url) {
        toast.success("Redirecting to checkout...");
        try {
          window.location.assign(url);
        } catch {
          toast.error("Could not open the payment page. Check your browser settings and try again.");
        }
        return;
      }
      toast.error("Checkout link was missing. Please try again.");
    },
    onError: (e: { message?: string }) => {
      const msg = e.message?.trim();
      toast.error(msg ? `Payment setup failed: ${msg}` : "Payment setup failed. Please try again.");
    },
  });
  return (
    <Button
      onClick={() => mutate({ packId })}
      disabled={isPending}
      className={`w-full ${
        highlighted
          ? "bg-amber-500 text-slate-900 font-bold"
          : "bg-slate-700 text-white"
      }`}
    >
      {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buy Now"}
    </Button>
  );
}

function EmailVerificationBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [sent, setSent] = useState(false);
  const resend = trpc.auth.resendVerification.useMutation({
    onSuccess: () => setSent(true),
    onError: (e) => toast.error(e.message),
  });

  if (dismissed) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Mail className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-amber-900">Please verify your email address</p>
            <p className="text-xs text-amber-700">Check your inbox for a verification link. Some features are limited until you verify.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {sent ? (
            <span className="text-xs text-green-700 font-medium flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Sent!
            </span>
          ) : (
            <button
              onClick={() => resend.mutate({ origin: window.location.origin })}
              disabled={resend.isPending}
              className="text-xs font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
            >
              {resend.isPending ? "Sending..." : "Resend email"}
            </button>
          )}
          <button
            onClick={() => setDismissed(true)}
            className="text-amber-500 hover:text-amber-700 p-1"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ArtistDashboard() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("leads");
  const [selectedLead, setSelectedLead] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("All");
  const [performerTypeFilter, setPerformerTypeFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [eventWindowFilter, setEventWindowFilter] = useState<number | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [unlockingLeadId, setUnlockingLeadId] = useState<number | null>(null);
  const [paymentData, setPaymentData] = useState<{
    clientSecret: string | null;
    paymentIntentId: string | null;
    amount: number;
    creditApplied: number;
    leadTitle: string;
    isDemoMode: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pitchLeadId, setPitchLeadId] = useState<number | null>(null);
  const [pitchText, setPitchText] = useState<string | null>(null);
  const [pitchLoading, setPitchLoading] = useState(false);
  const [pitchCopied, setPitchCopied] = useState(false);
  const [feedbackLeadId, setFeedbackLeadId] = useState<number | null>(null);
  const onLoginCalled = useRef(false);
  const [, navigate] = useLocation();

  const utils = trpc.useUtils();

  // Fire onLogin once after auth to trigger welcome email + referral attribution
  const { mutate: onLogin } = trpc.auth.onLogin.useMutation();
  const { mutate: logout } = trpc.auth.logout.useMutation({
    onSuccess: () => { clearAuthToken(); utils.auth.me.invalidate(); navigate("/login"); },
  });
  useEffect(() => {
    if (isAuthenticated && user && !onLoginCalled.current) {
      onLoginCalled.current = true;
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      onLogin({
        referralCode: ref ? `ref-${ref}` : undefined,
        origin: window.location.origin,
      });
    }
  }, [isAuthenticated, user]);

  // Fetch active event windows for filter chips
  const { data: activeEventWindows = [] } = trpc.events.getActiveFilters.useQuery(
    { marketId: cityFilter !== "all" ? cityFilter : undefined },
    { staleTime: 5 * 60 * 1000 }
  );

  // Fetch available leads
  const { data: leads, isLoading: leadsLoading, isError: leadsError, error: leadsErrorObj } = trpc.leads.getAvailable.useQuery({
    limit: 100,
    offset: 0,
  });

  // Fetch lead stats
  const { data: stats } = trpc.leads.getStats.useQuery();

  // Fetch my unlocked leads
  const { data: myUnlocks = [] } = trpc.artist.getMyUnlocks.useQuery();

  // Feedback mutation
  const { mutate: submitFeedback, isPending: feedbackPending } = trpc.leads.submitFeedback.useMutation({
    onSuccess: () => { toast.success("Thanks for the feedback! It helps improve lead scoring."); setFeedbackLeadId(null); },
    onError: (err) => toast.error(err.message),
  });
  const { mutate: updateLeadStatus, isPending: statusUpdatePending } = trpc.leads.updateLeadStatus.useMutation({
    onSuccess: (_data, variables) => {
      utils.leads.getById.invalidate({ id: variables.leadId });
      utils.leads.getAvailable.invalidate();
      toast.success("Lead status updated");
    },
    onError: (err) => toast.error(err.message || "Failed to update lead status"),
  });

  // My feedback map (leadId -> outcome)
  const { data: myFeedbackList = [] } = trpc.leads.getMyFeedback.useQuery();
  const myFeedbackMap = Object.fromEntries((myFeedbackList ?? []).map((f: any) => [f.leadId, f.outcome]));

  // Fetch my credits
  const { data: creditData } = trpc.artist.getMyCredits.useQuery();

  // Fetch referral stats
  const { data: referralStats } = trpc.referrals.getReferralStats.useQuery();

  // Fetch booking inquiries
  const { data: myInquiries } = trpc.booking.getMyInquiries.useQuery();

  // Fetch subscription
  const { data: mySubscription } = trpc.subscription.getMy.useQuery();
  const { data: venueIntelEligibility } = trpc.venueIntel.getSubscriptionEligibility.useQuery();
  const hasVenueIntelAccess = !!venueIntelEligibility?.eligible;

  // Update inquiry status mutation
  const { mutate: updateInquiryStatus } = trpc.booking.updateStatus.useMutation({
    onSuccess: () => { utils.booking.getMyInquiries.invalidate(); toast.success("Status updated"); },
  });

  // Start premium subscription
  const { mutate: startPremium, isPending: isStartingPremium } = trpc.subscription.startPremium.useMutation({
    onSuccess: (data) => {
      const url = data.checkoutUrl?.trim();
      if (url) {
        try {
          window.location.href = url;
        } catch {
          toast.error("Could not open the payment page. Check your browser settings and try again.");
        }
        return;
      }
      if (data.demo) {
        utils.subscription.getMy.invalidate();
        toast.success("Premium activated! You now have 5 monthly unlocks.");
        return;
      }
      toast.error("Checkout link was missing. Please try again.");
    },
    onError: (err) => {
      const msg = err.message?.trim();
      toast.error(msg ? `Payment setup failed: ${msg}` : "Payment setup failed. Please try again.");
    },
  });

  // Fetch referral link
  const { data: referralLink } = trpc.referrals.getReferralLink.useQuery({
    origin: typeof window !== "undefined" ? window.location.origin : undefined,
  });

  // Fetch selected lead details
  const { data: selectedLeadData } = trpc.leads.getById.useQuery(
    { id: selectedLead! },
    { enabled: !!selectedLead }
  );

  // Fetch Stripe config (publishable key)
  const { data: stripeConfig } = trpc.payments.getConfig.useQuery();

  // Create payment intent
  const { mutate: createPaymentIntent, isPending: isCreatingPayment } = trpc.payments.createPaymentIntent.useMutation({
    onSuccess: (data) => {
      if ((data as any).isFree || (data as any).isFreeWithCredits) {
        // Free trial or fully covered by credits — skip payment dialog entirely
        confirmPayment({
          leadId: unlockingLeadId!,
          paymentIntentId: null,
          isFree: true,
        });
        return;
      }
      // Store payment data for the dialog
      setPaymentData({
        clientSecret: data.clientSecret ?? null,
        paymentIntentId: data.paymentIntentId ?? null,
        amount: data.amount,
        creditApplied: data.creditApplied,
        leadTitle: data.leadTitle,
        isDemoMode: data.isDemoMode,
      });
      setShowPaymentDialog(true);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create payment");
      setUnlockingLeadId(null);
    },
  });

  // Confirm payment
  const { mutate: confirmPayment, isPending: isConfirming } = trpc.payments.confirmPayment.useMutation({
    onSuccess: (_data, variables) => {
      setShowPaymentDialog(false);
      setUnlockingLeadId(null);
      utils.leads.getAvailable.invalidate();
      if (variables?.leadId) {
        setSelectedLead(variables.leadId);
        utils.leads.getById.invalidate({ id: variables.leadId });
        const el = document.getElementById(`lead-card-${variables.leadId}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      utils.leads.getStats.invalidate();
      utils.artist.getMyUnlocks.invalidate();
      utils.artist.getMyCredits.invalidate();
      toast.success("🎉 Lead unlocked! Contact details are now visible.");
    },
    onError: (error) => {
      toast.error(error.message || "Payment failed");
      setUnlockingLeadId(null);
      setShowPaymentDialog(false);
    },
  });

  const handleUnlock = (leadId: number) => {
    setUnlockingLeadId(leadId);
    createPaymentIntent({ leadId });
  };

  const { mutateAsync: generatePitchMutation } = trpc.leads.generatePitch.useMutation();

  const handleGeneratePitch = async (leadId: number) => {
    setPitchLeadId(leadId);
    setPitchText(null);
    setPitchLoading(true);
    setPitchCopied(false);
    try {
      const result = await generatePitchMutation({ leadId });
      setPitchText(result.pitch);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate pitch");
      setPitchLeadId(null);
    } finally {
      setPitchLoading(false);
    }
  };

  const handleCopyReferral = () => {
    if (referralLink?.link) {
      navigator.clipboard.writeText(referralLink.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Referral link copied!");
    }
  };

  // Show spinner while auth is resolving to prevent white screen flash
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{background:"#f9f7f4"}}>
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" style={{color:"#c9a84c"}} />
          <p className="text-slate-400 text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{background:"#f9f7f4"}}>
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{background:"#c9a84c"}}>
            <Music className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Sign in to browse gigs</h1>
          <p className="text-slate-400 mb-8">Access curated gig leads for South Florida artists — Miami, Fort Lauderdale, Boca, West Palm</p>
          <div className="flex gap-3 justify-center">
            <Link href="/login">
              <Button style={{background:"#c9a84c",color:"#1c1c2e",fontWeight:700}} className="px-8 py-3 text-lg">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button variant="outline" style={{borderColor:"#c9a84c",color:"#b8963e"}} className="px-8 py-3 text-lg">
                Create Account
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const filteredLeads = (leads ?? []).filter((lead) => {
    const matchesSearch = !searchTerm ||
      (lead.title ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.location ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.eventType && lead.eventType.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesEventType = eventTypeFilter === "All" || lead.eventType === eventTypeFilter;
    const matchesPerformerType = performerTypeFilter === "all" || lead.performerType === performerTypeFilter;
    const cityLabel = CITY_MARKETS.find(c => c.id === cityFilter)?.label ?? "";
    const matchesCity = cityFilter === "all" || (lead.location ?? "").toLowerCase().includes(cityLabel.toLowerCase());
    // Event window filter: match leads whose performer type is in the window's relevant types
    const matchesEventWindow = !eventWindowFilter || (() => {
      const win = (activeEventWindows ?? []).find(w => w.id === eventWindowFilter);
      if (!win) return true;
      const types = (win.relevantPerformerTypes as string[] | null | undefined) ?? [];
      return types.includes(lead.performerType ?? "") || types.includes("all");
    })();
    return matchesSearch && matchesEventType && matchesPerformerType && matchesCity && matchesEventWindow;
  }) || [];

  const isProcessing = isCreatingPayment || isConfirming;
  const availableCredits = creditData?.totalCredits ?? 0;

  return (
    <ErrorBoundary>
    <div style={{minHeight:'100vh',background:'#f9f7f4',color:'#1c1c2e'}}>
      {/* Scarcity Banner */}
      {stats && stats.totalAvailable > 0 && (
        <div style={{background:'linear-gradient(to right,#c9a84c,#a07830)',color:'#f9f7f4',textAlign:'center',padding:'0.5rem 1rem',fontSize:'0.8rem',fontWeight:700,letterSpacing:'0.03em'}}>
          <Zap className="w-3.5 h-3.5 inline mr-1.5 mb-0.5" /> Pricing: Discovery $3 (post link), Standard $7 (partial contact), Premium $15 (direct contact).{" "}
          <Link href="/pricing" className="underline font-medium">Go Pro</Link> — $49/mo, 15 leads any tier, no commission or booking fees.
        </div>
      )}

      {/* Email Verification Banner */}
      {user && !(user as any).emailVerified && (
        <EmailVerificationBanner />
      )}

      {/* Top Nav */}
      <div style={{background:'#ffffff',borderBottom:'1px solid rgba(201,168,76,0.15)',position:'sticky',top:0,zIndex:10}}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="4" fill="#c9a84c" fillOpacity="0.12"/>
              <path d="M4 20 Q8 10 12 16 Q16 22 20 10 Q23 2 28 12" stroke="#c9a84c" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            </svg>
            <span style={{fontWeight:800,fontSize:'1.2rem',letterSpacing:'-0.02em',color:'#1c1c2e'}}>Gig<span style={{color:'#c9a84c'}}>XO</span></span>
          </div>
          <div className="flex items-center gap-4">
            {stats && (
              <div className="hidden md:flex items-center gap-4 text-sm text-slate-600">
                <span style={{display:'flex',alignItems:'center',gap:'0.25rem',color:'#c9a84c',fontSize:'0.8rem'}}>
                  <Unlock className="w-4 h-4" />
                  {stats.myUnlocks} unlocked
                </span>
                {availableCredits > 0 && (
                  <span style={{display:'flex',alignItems:'center',gap:'0.25rem',background:'rgba(201,168,76,0.12)',color:'#c9a84c',padding:'0.2rem 0.6rem',borderRadius:'999px',fontWeight:600,fontSize:'0.78rem'}}>
                    <Gift className="w-3.5 h-3.5" />
                    ${(availableCredits / 100).toFixed(2)} credit
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Link href="/share">
                <button style={{display:'flex',alignItems:'center',gap:'0.4rem',fontSize:'0.75rem',color:'#c9a84c',border:'1px solid rgba(201,168,76,0.3)',padding:'0.25rem 0.6rem',borderRadius:'4px',background:'transparent',cursor:'pointer'}} title="Share & Earn">
                  <Gift className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-xs font-semibold">Share & Earn</span>
                </button>
              </Link>
              <Link href="/pipeline">
                <button style={{display:'flex',alignItems:'center',gap:'0.4rem',fontSize:'0.75rem',color:'#6b6860',background:'transparent',border:'none',padding:'0.25rem 0.5rem',cursor:'pointer'}} title="Booking Pipeline">
                  <span className="hidden sm:inline text-xs font-medium">Pipeline</span>
                </button>
              </Link>
              {hasVenueIntelAccess && (
                <Link href="/venue-intel">
                  <button style={{display:'flex',alignItems:'center',gap:'0.4rem',fontSize:'0.75rem',color:'#6b6860',background:'transparent',border:'none',padding:'0.25rem 0.5rem',cursor:'pointer'}} title="South Florida Venue Intelligence">
                    <Building2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline text-xs font-medium">Venue Intel</span>
                  </button>
                </Link>
              )}
              <NotificationBell />
              <Link href="/profile">
                <button style={{display:'flex',alignItems:'center',gap:'0.4rem',fontSize:'0.75rem',color:'#6b6860',background:'transparent',border:'none',padding:'0.25rem 0.5rem',cursor:'pointer'}}>
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">{user?.name || user?.email || "Artist"}</span>
                </button>
              </Link>
              <button
                onClick={() => logout()}
                style={{display:'flex',alignItems:'center',gap:'0.25rem',fontSize:'0.72rem',color:'#6b6860',background:'transparent',border:'none',padding:'0.25rem 0.5rem',cursor:'pointer'}}
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{borderTop:'1px solid rgba(201,168,76,0.1)'}} className="max-w-7xl mx-auto px-4 flex gap-1">
          {(["leads", "unlocked", "referrals", "inquiries", "packs"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{padding:'0.6rem 1rem',fontSize:'0.82rem',fontWeight:600,background:'transparent',border:'none',borderBottom: activeTab===tab ? '2px solid #c9a84c' : '2px solid transparent',color: activeTab===tab ? '#c9a84c' : '#6b6860',cursor:'pointer',marginBottom:'-1px',transition:'color 0.2s'}}
            >
              {tab === "leads" && "Browse Gigs"}
              {tab === "unlocked" && `My Unlocks${(myUnlocks ?? []).length ? ` (${(myUnlocks ?? []).length})` : ""}`}
              {tab === "referrals" && "Referrals"}
              {tab === "inquiries" && (
                <span className="flex items-center gap-1">
                  Inquiries
                  {(myInquiries ?? []).filter((i) => i.status === "new").length > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                      {(myInquiries ?? []).filter((i) => i.status === "new").length}
                    </span>
                  )}
                </span>
              )}
              {tab === "packs" && "Buy Packs"}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* LEADS TAB */}
        {activeTab === "leads" && (
          <>
            {/* Stats Bar */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'0.75rem',marginBottom:'1.25rem'}}>
              {[{label:'Active Leads',value:(filteredLeads??[]).length,sub:'in your market'},{label:'Avg Budget',value:'$2,400',sub:'per gig this week'},{label:'Response Rate',value:'94%',sub:'when you unlock fast'},{label:'Your ROI',value:'3.2×',sub:'avg return on lead cost'}].map((s,i)=>(
                <div key={i} style={{background:'#ffffff',border:'1px solid rgba(201,168,76,0.15)',borderRadius:'4px',padding:'0.85rem 1rem'}}>
                  <div style={{fontSize:'1.4rem',fontWeight:800,color:'#c9a84c',lineHeight:1}}>{s.value}</div>
                  <div style={{fontSize:'0.72rem',fontWeight:700,color:'#1c1c2e',marginTop:'0.2rem',textTransform:'uppercase',letterSpacing:'0.05em'}}>{s.label}</div>
                  <div style={{fontSize:'0.68rem',color:'#6b6860',marginTop:'0.15rem'}}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Event Window Filter Chips — auto-shown when active windows exist */}
            {(activeEventWindows ?? []).length > 0 && (
              <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:'0.5rem',marginBottom:'0.75rem',padding:'0.75rem',background:'rgba(201,168,76,0.06)',border:'1px solid rgba(201,168,76,0.2)',borderRadius:'4px'}}>
                <Zap style={{width:'1rem',height:'1rem',color:'#c9a84c',flexShrink:0}} />
                <span style={{fontSize:'0.72rem',fontWeight:700,color:'#c9a84c',marginRight:'0.25rem',textTransform:'uppercase',letterSpacing:'0.05em'}}>Event Boosts:</span>
                {(activeEventWindows ?? []).map((w) => (
                  <button
                    key={w.id}
                    onClick={() => setEventWindowFilter(eventWindowFilter === w.id ? null : w.id)}
                    style={{padding:'0.2rem 0.75rem',borderRadius:'999px',fontSize:'0.75rem',fontWeight:600,border: eventWindowFilter===w.id ? '1px solid #c9a84c' : '1px solid rgba(201,168,76,0.3)',background: eventWindowFilter===w.id ? '#c9a84c' : 'transparent',color: eventWindowFilter===w.id ? '#f9f7f4' : '#c9a84c',cursor:'pointer'}}
                  >
                    {w.filterLabel}
                    <span className="ml-1 opacity-70">{w.leadBoostMultiplier}x</span>
                  </button>
                ))}
                {eventWindowFilter && (
                  <button
                    onClick={() => setEventWindowFilter(null)}
                    style={{marginLeft:'auto',fontSize:'0.72rem',color:'#6b6860',background:'transparent',border:'none',cursor:'pointer'}}
                  >
                    Clear
                  </button>
                )}
              </div>
            )}

            {/* Compact inline filter bar */}
            <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:'0.5rem',marginBottom:'1rem'}}>
              {/* Search */}
              <div style={{position:'relative',flex:1,minWidth:'180px'}}>
                <Search style={{position:'absolute',left:'0.75rem',top:'50%',transform:'translateY(-50%)',width:'1rem',height:'1rem',color:'#6b6860'}} />
                <Input
                  placeholder="Search gigs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              {/* City dropdown */}
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className={`h-9 text-sm border rounded-lg px-3 pr-8 focus:outline-none transition-colors ${
                  cityFilter !== "all" ? "border-amber-400 bg-amber-50 text-amber-800 font-medium" : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                <option value="all">All Cities</option>
                {(CITY_MARKETS ?? []).filter(c => c.id !== "all").map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              {/* Performer type dropdown */}
              <select
                value={performerTypeFilter}
                onChange={(e) => setPerformerTypeFilter(e.target.value)}
                className={`h-9 text-sm border rounded-lg px-3 pr-8 focus:outline-none transition-colors ${
                  performerTypeFilter !== "all" ? "border-amber-400 bg-amber-50 text-amber-800 font-medium" : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                <option value="all">All Types</option>
                {(PERFORMER_TYPES ?? []).filter(p => p.value !== "all").map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              {/* Event type dropdown */}
              <select
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                className={`h-9 text-sm border rounded-lg px-3 pr-8 focus:outline-none transition-colors ${
                  eventTypeFilter !== "All" ? "border-amber-400 bg-amber-50 text-amber-800 font-medium" : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                {(EVENT_TYPES ?? []).map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              {/* Clear filters — only show when any filter is active */}
              {(cityFilter !== "all" || performerTypeFilter !== "all" || eventTypeFilter !== "All" || searchTerm) && (
                <button
                  onClick={() => { setCityFilter("all"); setPerformerTypeFilter("all"); setEventTypeFilter("All"); setSearchTerm(""); }}
                  className="h-9 px-3 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors"
                >
                  Clear
                </button>
              )}
              <span style={{fontSize:'0.78rem',color:'#6b6860',marginLeft:'auto'}}>
                {leadsLoading ? "Loading..." : `${(filteredLeads ?? []).length} leads`}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Lead List */}
              <div className="lg:col-span-2" style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
                {leadsLoading ? (
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'4rem 0'}}>
                    <Loader2 style={{width:'2rem',height:'2rem',color:'#c9a84c',animation:'spin 1s linear infinite'}} />
                  </div>
                ) : leadsError ? (
                  <div style={{background:'#ffffff',border:'1px solid rgba(201,168,76,0.15)',borderRadius:'4px',padding:'3rem',textAlign:'center'}}>
                    <p style={{color:'#ef4444',fontWeight:600}}>Could not load gigs right now.</p>
                    <p style={{color:'#6b6860',fontSize:'0.85rem',marginTop:'0.25rem'}}>{leadsErrorObj?.message ?? "Please try again in a moment."}</p>
                  </div>
                ) : (filteredLeads ?? []).length === 0 ? (
                  <div style={{background:'#ffffff',border:'1px solid rgba(201,168,76,0.15)',borderRadius:'4px',padding:'3rem',textAlign:'center'}}>
                    <Music style={{width:'3rem',height:'3rem',color:'#c9a84c',margin:'0 auto 1rem'}} />
                    <p style={{color:'#1c1c2e',fontWeight:600}}>No gigs found</p>
                    <p style={{color:'#6b6860',fontSize:'0.85rem',marginTop:'0.25rem'}}>Try adjusting your search or filters</p>
                  </div>
                ) : (
                  (filteredLeads ?? []).map((lead) => (
                    <div
                      key={lead.id}
                      id={`lead-card-${lead.id}`}
                      className="card-luxury"
                      onClick={() => setSelectedLead(lead.id)}
                      style={{background: selectedLead===lead.id ? '#fffbf0' : '#ffffff',border: selectedLead===lead.id ? '2px solid #c9a84c' : '1px solid #e8e4dc',borderRadius:'12px',cursor:'pointer',transition:'all 0.15s',boxShadow: selectedLead===lead.id ? '0 4px 20px rgba(201,168,76,0.15)' : '0 1px 4px rgba(0,0,0,0.06)'}}
                    >
                      <div className="lead-card-header" style={{ padding: '1rem' }}>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {/* Lead Temperature Badge */}
                              {(lead as any).leadTemperature === 'hot' && (
                                <span style={{flexShrink:0,display:'inline-flex',alignItems:'center',gap:'0.2rem',fontSize:'0.68rem',fontWeight:800,color:'#fff',background:'#ef4444',padding:'0.15rem 0.5rem',borderRadius:'999px',letterSpacing:'0.05em'}}>
                                  <Flame style={{width:'0.7rem',height:'0.7rem'}} /> HOT
                                </span>
                              )}
                              {(lead as any).leadTemperature === 'warm' && (
                                <span style={{flexShrink:0,fontSize:'0.68rem',fontWeight:800,color:'#f97316',background:'rgba(249,115,22,0.12)',padding:'0.15rem 0.5rem',borderRadius:'999px',letterSpacing:'0.05em'}}>
                                  WARM
                                </span>
                              )}
                              {(lead as any).leadTemperature === 'cold' && (
                                <span style={{flexShrink:0,fontSize:'0.68rem',fontWeight:600,color:'#9ca3af',background:'#f0ede6',padding:'0.15rem 0.5rem',borderRadius:'999px'}}>
                                  COLD
                                </span>
                              )}
                              <h3 style={{fontWeight:700,color:'#1c1c2e',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:'0.95rem'}}>{lead.title}</h3>
                              {/* New badge — show for leads created in the last 48 hours */}
                              {lead.createdAt && (Date.now() - new Date(lead.createdAt).getTime()) < 48 * 60 * 60 * 1000 && (
                                <span style={{flexShrink:0,fontSize:'0.68rem',fontWeight:800,color:'#f9f7f4',background:'#c9a84c',padding:'0.15rem 0.5rem',borderRadius:'999px',letterSpacing:'0.05em'}}>
                                  NEW
                                </span>
                              )}
                              {lead.isUnlocked && (
                                <span style={{flexShrink:0,display:'inline-flex',alignItems:'center',gap:'0.2rem',fontSize:'0.68rem',fontWeight:600,color:'#22c55e',background:'rgba(34,197,94,0.1)',padding:'0.15rem 0.5rem',borderRadius:'999px'}}>
                                  <Unlock style={{width:'0.65rem',height:'0.65rem'}} />
                                  Unlocked
                                </span>
                              )}
                              {lead.isUnlocked && !!formatLeadStatusLabel((lead as any).status) && (
                                <span className="flex-shrink-0 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                                  {formatLeadStatusLabel((lead as any).status)}
                                </span>
                              )}
                              {/* Lead tier / unlock price badge — show what they're paying before they click */}
                              {!lead.isUnlocked && (
                                <span style={{flexShrink:0,fontSize:'0.68rem',fontWeight:700,color:'#c9a84c',background:'rgba(201,168,76,0.1)',border:'1px solid rgba(201,168,76,0.25)',padding:'0.15rem 0.5rem',borderRadius:'999px'}}>
                                  {(() => {
                                    const cents = getLeadDisplayPriceCents(lead as any);
                                    const dollars = Math.round(cents / 100);
                                    return `Unlock $${dollars}`;
                                  })()}
                                </span>
                              )}
                            </div>
                            <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:'0.5rem',fontSize:'0.75rem',color:'#6b6860',marginTop:'0.25rem'}}>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {lead.location}
                              </span>
                              {lead.eventDate && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(lead.eventDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </span>
                              )}
                              {/* Social proof */}
                              {('viewCount' in lead) && (lead as any).viewCount > 0 && (
                                <span style={{display:'inline-flex',alignItems:'center',gap:'0.2rem',color:'#9ca3af'}}>
                                  <Eye style={{width:'0.7rem',height:'0.7rem'}} />
                                  {(lead as any).viewCount} viewed
                                </span>
                              )}
                              {('unlockCount' in lead) && (lead as any).unlockCount > 0 && (
                                <span style={{display:'inline-flex',alignItems:'center',gap:'0.2rem',fontWeight:600,color:(lead as any).unlockCount>=5?'#ef4444':(lead as any).unlockCount>=3?'#f97316':'#c9a84c'}}>
                                  <Users className="w-3 h-3" />
                                  {(lead as any).unlockCount === 1
                                    ? '1 pro has this'
                                    : `${(lead as any).unlockCount} pros have this`
                                  }
                                </span>
                              )}
                            </div>
                            {/* Tier helper text */}
                            {/* Tier explanation moved to global banner to reduce per-card noise */}
                          </div>
                          <div style={{flexShrink:0,textAlign:'right'}}>
                            <div style={{fontSize:'1rem',fontWeight:800,color:'#c9a84c'}}>Client budget: {formatBudget(lead.budget)}</div>
                            <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:'0.35rem',marginTop:'0.25rem',justifyContent:'flex-end'}}>
                              {lead.performerType && lead.performerType !== "other" && (
                                <span style={{fontSize:'0.72rem',fontWeight:600,background:'rgba(201,168,76,0.1)',color:'#c9a84c',padding:'0.15rem 0.5rem',borderRadius:'999px'}}>
                                  {PERFORMER_TYPES.find(p => p.value === lead.performerType)?.icon} {PERFORMER_TYPES.find(p => p.value === lead.performerType)?.label}
                                </span>
                              )}
                              {lead.eventType && (
                                <span style={{fontSize:'0.72rem',color:'#6b6860'}}>{lead.eventType}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div style={{ padding: '0 1rem 1rem 1rem' }}>
                        {getLeadDescriptionForDisplay(lead) && (
                          <p style={{fontSize:'0.82rem',color:'#4a4a5e',display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflow:'hidden',marginBottom:'0.5rem',lineHeight:1.6}}>
                            {getLeadDescriptionForDisplay(lead)}
                          </p>
                        )}
                        {!lead.isUnlocked && (
                          <p style={{fontSize:'0.72rem',color:'#9ca3af',marginBottom:'0.5rem',fontStyle:'italic'}}>
                            Full contact info revealed after unlock
                          </p>
                        )}
                        {!lead.isUnlocked && getPreviewTags(lead).length > 0 && (
                          <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:'0.35rem',marginBottom:'0.5rem'}}>
                            {getPreviewTags(lead).map((tag) => (
                              <span key={tag} style={{fontSize:'0.68rem',fontWeight:600,color:'#6b6860',background:'#f0ede6',border:'1px solid #e8e4dc',padding:'0.1rem 0.5rem',borderRadius:'4px',letterSpacing:'0.04em',textTransform:'uppercase'}}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Win Probability Bar */}
                        {(lead as any).winProbability !== undefined && (lead as any).winProbability !== null && (
                          <div style={{marginBottom:'0.5rem'}}>
                            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.2rem'}}>
                              <span style={{fontSize:'0.7rem',color:'#6b6860',textTransform:'uppercase',letterSpacing:'0.05em'}}>Win probability</span>
                              <span style={{fontSize:'0.75rem',fontWeight:700,color:(lead as any).winProbability>=70?'#22c55e':(lead as any).winProbability>=45?'#f97316':'#6b6860'}}>{Math.round((lead as any).winProbability)}%</span>
                            </div>
                            <div style={{height:'3px',background:'#e8e4dc',borderRadius:'999px',overflow:'hidden'}}>
                              <div
                                style={{height:'100%',borderRadius:'999px',transition:'width 0.3s',background:(lead as any).winProbability>=70?'#22c55e':(lead as any).winProbability>=45?'#f97316':'rgba(255,255,255,0.15)',width:`${Math.min(100,Math.round((lead as any).winProbability))}%`}}
                              />
                            </div>
                          </div>
                        )}

                        {/* Contact availability badges — what artists unlock */}
                        {!lead.isUnlocked && (
                          <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:'0.35rem',marginBottom:'0.5rem'}}>
                            {(lead as any).hasContactEmail && (
                              <span style={{display:'inline-flex',alignItems:'center',gap:'0.25rem',fontSize:'0.68rem',fontWeight:600,color:'#c9a84c',background:'rgba(201,168,76,0.08)',border:'1px solid rgba(201,168,76,0.2)',padding:'0.15rem 0.5rem',borderRadius:'3px'}}>
                                <Mail style={{width:'0.65rem',height:'0.65rem'}} />
                                Email included
                              </span>
                            )}
                            {(lead as any).hasContactPhone && (
                              <span style={{display:'inline-flex',alignItems:'center',gap:'0.25rem',fontSize:'0.68rem',fontWeight:600,color:'#c9a84c',background:'rgba(201,168,76,0.08)',border:'1px solid rgba(201,168,76,0.2)',padding:'0.15rem 0.5rem',borderRadius:'3px'}}>
                                <Phone style={{width:'0.65rem',height:'0.65rem'}} />
                                Phone included
                              </span>
                            )}
                            {showFacebookProfileLeadCta(lead) && (
                              <span style={{display:'inline-flex',alignItems:'center',gap:'0.25rem',fontSize:'0.68rem',fontWeight:600,color:'#6b6860',background:'#f0ede6',border:'1px solid #e8e4dc',padding:'0.15rem 0.5rem',borderRadius:'4px'}}>
                                Direct profile link included
                              </span>
                            )}
                          </div>
                        )}

                        <div className="w-full">
                          {!lead.isUnlocked ? (
                            <button
                              type="button"
                              className="btn-gold"
                              style={{ width: '100%' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnlock(lead.id);
                              }}
                              disabled={isProcessing && unlockingLeadId === lead.id}
                            >
                              {isProcessing && unlockingLeadId === lead.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <>
                                  <Lock className="w-3 h-3 mr-1" />
                                  {(() => {
                                    const priceCents = getLeadDisplayPriceCents(lead as any);
                                    if (availableCredits >= priceCents) return "Unlock FREE";
                                    const dollars = Math.round(priceCents / 100);
                                    return `Unlock $${dollars}`;
                                  })()}
                                </>
                              )}
                            </button>
                          ) : (
                            <div className="flex flex-col items-end gap-1 text-xs text-green-700">
                              <span className="font-medium flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                Contact available
                              </span>
                              <div className="flex flex-col items-end gap-1 text-[11px] text-slate-600">
                                {lead.contactName && (
                                  <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {lead.contactName}
                                  </span>
                                )}
                                {lead.contactEmail && (
                                  <a
                                    href={buildOutreachMailto(
                                      lead.contactEmail,
                                      lead.title,
                                      lead.location,
                                      lead.contactName,
                                      lead.performerType
                                    )}
                                    style={{color:"#b8963e"}} className="flex items-center gap-1 hover:underline"
                                  >
                                    <Mail className="w-3 h-3" />
                                    {lead.contactEmail}
                                  </a>
                                )}
                                {lead.contactPhone && (
                                  <a
                                    href={`tel:${lead.contactPhone}`}
                                    style={{color:"#b8963e"}} className="flex items-center gap-1 hover:underline"
                                  >
                                    <Phone className="w-3 h-3" />
                                    {lead.contactPhone}
                                  </a>
                                )}
                                {(() => {
                                  const socialUrl = getSocialProfileUrlForLead(lead);
                                  if (socialUrl) {
                                    const ig = /instagram\.com/i.test(socialUrl);
                                    return (
                                      <a
                                        href={socialUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-800 hover:bg-sky-100"
                                      >
                                        <ExternalLink className="w-3 h-3 shrink-0" />
                                        {ig ? "Open Instagram profile" : "Open Facebook / profile link"}
                                      </a>
                                    );
                                  }
                                  if (lead.venueUrl) {
                                    return (
                                      <a
                                        href={lead.venueUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-blue-600 hover:underline"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                        View website
                                      </a>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedLead(lead.id);
                                  const el = document.getElementById(`lead-card-${lead.id}`);
                                  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                                }}
                                className="text-[11px] font-medium" style={{color:'#b8963e'}}
                              >
                                View full details
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Lead Detail Panel */}
              <div className="lg:sticky lg:top-28 lg:self-start space-y-4">
                {selectedLeadData ? (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="p-5 text-white" style={{background:"linear-gradient(135deg,#1c1c2e,#2d2d42)"}}>
                      <h2 className="font-bold text-lg leading-tight mb-1">{selectedLeadData.title}</h2>
                      {selectedLeadData.eventType && (
                        <p className="text-sm" style={{color:"#c9a84c",opacity:0.8}}>{selectedLeadData.eventType}</p>
                      )}
                      {(selectedLeadData as any).lastContactedAt && (
                        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-medium text-white">
                          <Clock3 className="w-3 h-3" />
                          Last Contacted{" "}
                          {new Date((selectedLeadData as any).lastContactedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                      )}
                    </div>

                    <div className="p-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <DollarSign className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Client budget</p>
                          <p className="font-bold text-slate-900 text-lg">{formatBudget(selectedLeadData.budget)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Location</p>
                          <p className="font-medium text-slate-900">{selectedLeadData.location}</p>
                        </div>
                      </div>

                      {(() => {
                        const source = String((selectedLeadData as any).source ?? "").toLowerCase();
                        const isDbprLead = source === "dbpr";
                        const hasEmail = !!String(selectedLeadData.contactEmail ?? "").trim();
                        const hasPhone = !!String(selectedLeadData.contactPhone ?? "").trim();
                        const missingContactInfo = !hasEmail && !hasPhone;
                        const query = [selectedLeadData.title, selectedLeadData.location].filter(Boolean).join(" ").trim();
                        if (!isDbprLead || !missingContactInfo || !query) return null;
                        return (
                          <button
                            type="button"
                            onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank", "noopener,noreferrer")}
                            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <Search className="w-3.5 h-3.5" />
                            Search on Google
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        );
                      })()}

                      {selectedLeadData.eventDate && (
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:"#fef9ec"}}>
                            <Calendar className="w-4 h-4" style={{color:"#c9a84c"}} />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Event Date</p>
                            <p className="font-medium text-slate-900">
                              {new Date(selectedLeadData.eventDate).toLocaleDateString("en-US", {
                                weekday: "short", month: "long", day: "numeric", year: "numeric"
                              })}
                            </p>
                          </div>
                        </div>
                      )}

                      {getLeadDescriptionForDisplay(selectedLeadData) && (
                        <div className="pt-2 border-t border-slate-100">
                          <p className="text-xs text-slate-500 mb-1.5">Details</p>
                          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                            {getLeadDescriptionForDisplay(selectedLeadData)}
                          </p>
                        </div>
                      )}

                      {/* ── Gig Intelligence Panel ── */}
                      {((selectedLeadData as any).winProbability !== undefined && (selectedLeadData as any).winProbability !== null) && (
                        <div className="pt-3 border-t border-slate-100">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                            <BarChart2 className="w-3.5 h-3.5" /> Gig Intelligence
                          </p>

                          {/* Win Probability */}
                          <div className="bg-slate-50 rounded-lg p-3 mb-2">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs text-slate-600 font-medium">Win Probability</span>
                              <span className={`text-sm font-bold ${
                                (selectedLeadData as any).winProbability >= 70 ? 'text-green-600' :
                                (selectedLeadData as any).winProbability >= 45 ? 'text-orange-500' :
                                'text-slate-500'
                              }`}>{Math.round((selectedLeadData as any).winProbability)}%</span>
                            </div>
                            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  (selectedLeadData as any).winProbability >= 70 ? 'bg-green-500' :
                                  (selectedLeadData as any).winProbability >= 45 ? 'bg-orange-400' :
                                  'bg-slate-400'
                                }`}
                                style={{ width: `${Math.min(100, Math.round((selectedLeadData as any).winProbability))}%` }}
                              />
                            </div>
                          </div>

                          {/* Competition + Buyer Type row */}
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            {(selectedLeadData as any).competitionLevel && (
                              <div className="bg-slate-50 rounded-lg p-2.5">
                                <p className="text-xs text-slate-400 mb-0.5">Competition</p>
                                <p className={`text-xs font-semibold capitalize ${
                                  (selectedLeadData as any).competitionLevel === 'low' ? 'text-green-600' :
                                  (selectedLeadData as any).competitionLevel === 'medium' ? 'text-orange-500' :
                                  'text-red-500'
                                }`}>{(selectedLeadData as any).competitionLevel}</p>
                              </div>
                            )}
                            {(selectedLeadData as any).buyerType && (selectedLeadData as any).buyerType !== 'unknown' && (
                              <div className="bg-slate-50 rounded-lg p-2.5">
                                <p className="text-xs text-slate-400 mb-0.5">Buyer Type</p>
                                <p className="text-xs font-semibold text-slate-700 capitalize">{((selectedLeadData as any).buyerType as string).replace(/_/g, ' ')}</p>
                              </div>
                            )}
                          </div>

                          {/* Suggested Rate */}
                          {(selectedLeadData as any).suggestedRate && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 mb-2">
                              <p className="text-xs text-emerald-600 font-medium mb-0.5">Suggested Rate</p>
                              <p className="text-sm font-bold text-emerald-800">{(selectedLeadData as any).suggestedRate}</p>
                            </div>
                          )}

                          {/* Pitch Style */}
                          {(selectedLeadData as any).pitchStyle && (
                            <div className="rounded-lg p-2.5 mb-2" style={{background:"#fef9ec",border:"1px solid rgba(201,168,76,0.3)"}}>
                              <p style={{color:"#b8963e"}} className="text-xs font-medium mb-0.5">Pitch Approach</p>
                              <p style={{color:"#1c1c2e"}} className="text-xs">{(selectedLeadData as any).pitchStyle}</p>
                            </div>
                          )}

                          {/* Evidence snippets */}
                          {((selectedLeadData as any).intentEvidence || (selectedLeadData as any).contactEvidence || (selectedLeadData as any).eventEvidence) && (
                            <div className="space-y-1.5">
                              <p className="text-xs text-slate-400 font-medium">Why this lead scored high:</p>
                              {(selectedLeadData as any).intentEvidence && (
                                <div className="flex items-start gap-1.5 text-xs text-slate-600">
                                  <Check className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                                  <span>{(selectedLeadData as any).intentEvidence}</span>
                                </div>
                              )}
                              {(selectedLeadData as any).contactEvidence && (
                                <div className="flex items-start gap-1.5 text-xs text-slate-600">
                                  <Check className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                                  <span>{(selectedLeadData as any).contactEvidence}</span>
                                </div>
                              )}
                              {(selectedLeadData as any).eventEvidence && (
                                <div className="flex items-start gap-1.5 text-xs text-slate-600">
                                  <Check className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                                  <span>{(selectedLeadData as any).eventEvidence}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {selectedLeadData.isUnlocked ? (
                        <div className="pt-2 border-t border-slate-100 space-y-3">
                          <div>
                            <p className="text-xs text-slate-500 mb-1.5">Lead Status</p>
                            <select
                              value={(String((selectedLeadData as any).status || "new") as LeadProgressStatus)}
                              onChange={(e) => {
                                const nextStatus = e.target.value as LeadProgressStatus;
                                updateLeadStatus({ leadId: selectedLeadData.id, status: nextStatus });
                              }}
                              disabled={statusUpdatePending}
                              style={{borderColor:"#e8e4dc",color:"#1c1c2e"}} className="w-full h-9 rounded-md border bg-white px-3 text-sm disabled:opacity-60"
                            >
                              <option value="new">New</option>
                              <option value="contacted">Contacted</option>
                              <option value="followed_up">Followed Up</option>
                              <option value="booked">Booked</option>
                            </select>
                          </div>

                          <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                            <Unlock className="w-3 h-3 text-green-600" />
                            Contact Information
                          </p>
                          <div className="bg-green-50 rounded-lg p-3 space-y-2">
                            {selectedLeadData.contactName && (
                              <div className="flex items-center gap-2 text-sm">
                                <User className="w-3.5 h-3.5 text-green-600" />
                                <span className="font-medium text-slate-900">{selectedLeadData.contactName}</span>
                              </div>
                            )}
                            {selectedLeadData.contactEmail && (
                              <div className="flex items-center gap-2 text-sm">
                                <Mail className="w-3.5 h-3.5 text-green-600" />
                                <a
                                  href={buildOutreachMailto(
                                    selectedLeadData.contactEmail,
                                    selectedLeadData.title,
                                    selectedLeadData.location,
                                    selectedLeadData.contactName,
                                    selectedLeadData.performerType
                                  )}
                                  style={{color:"#b8963e"}} className="hover:underline"
                                >
                                  {selectedLeadData.contactEmail}
                                </a>
                              </div>
                            )}
                            {selectedLeadData.contactPhone && (
                              <div className="flex items-center gap-2 text-sm">
                                <Phone className="w-3.5 h-3.5 text-green-600" />
                                <a href={`tel:${selectedLeadData.contactPhone}`} style={{color:'#b8963e'}} className="hover:underline">
                                  {selectedLeadData.contactPhone}
                                </a>
                              </div>
                            )}
                            {(() => {
                              const u = getSocialProfileUrlForLead(selectedLeadData);
                              if (!u) return null;
                              const ig = /instagram\.com/i.test(u);
                              return (
                                <div className="pt-1">
                                  <a
                                    href={u}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-2 text-xs font-medium text-sky-800 hover:bg-sky-100 sm:w-auto sm:justify-start"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                                    {ig ? "Open Instagram profile" : "Open Facebook / profile link"}
                                  </a>
                                </div>
                              );
                            })()}
                            {(selectedLeadData.contactEmail || selectedLeadData.contactPhone) && (
                              <div className="pt-2 mt-2 border-t border-green-200">
                                <p className="text-[11px] font-semibold text-green-700 mb-2">Quick Actions</p>
                                <div className="flex flex-wrap gap-2">
                                  {selectedLeadData.contactEmail && (
                                    <a
                                      href={buildOutreachMailto(
                                        selectedLeadData.contactEmail,
                                        selectedLeadData.title,
                                        selectedLeadData.location,
                                        selectedLeadData.contactName,
                                        selectedLeadData.performerType
                                      )}
                                      className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                                    >
                                      <Mail className="w-3.5 h-3.5" />
                                      Email Venue
                                    </a>
                                  )}
                                  {selectedLeadData.contactPhone && (
                                    <a
                                      href={`tel:${selectedLeadData.contactPhone}`}
                                      className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
                                    >
                                      <Phone className="w-3.5 h-3.5" />
                                      Call Venue
                                    </a>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Tier-specific post-unlock messaging */}
                          <p className="text-[11px] text-slate-500">
                            {(() => {
                              const tier = (selectedLeadData as any).leadTier as string | undefined;
                              if (tier === "starter_friendly") {
                                return "This is a discovery lead. Use the original post or venue link to contact the client.";
                              }
                              if (tier === "standard") {
                                return "This lead includes partial contact info (phone or website when available).";
                              }
                              if (tier === "premium") {
                                return "This lead includes direct contact details (email and/or phone).";
                              }
                              return "Contact details vary by lead; use the information shown above to reach out.";
                            })()}
                          </p>

                          {/* AI Pitch Draft */}
                          {pitchLeadId === selectedLeadData.id && pitchText ? (
                            <div className="rounded-lg p-3" style={{background:"#fef9ec",border:"1px solid rgba(201,168,76,0.3)"}}>
                              <div className="flex items-center justify-between mb-2">
                                <p style={{color:"#b8963e"}} className="text-xs font-semibold flex items-center gap-1">
                                  <Sparkles className="w-3.5 h-3.5" /> AI Pitch Draft
                                </p>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(pitchText);
                                    setPitchCopied(true);
                                    setTimeout(() => setPitchCopied(false), 2000);
                                  }}
                                  style={{color:"#b8963e"}} className="text-xs flex items-center gap-1"
                                >
                                  {pitchCopied ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
                                </button>
                              </div>
                              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">{pitchText}</p>
                              <button
                                onClick={() => handleGeneratePitch(selectedLeadData.id)}
                                style={{color:"#b8963e"}} className="mt-2 text-xs"
                              >
                                Regenerate
                              </button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              style={{borderColor:"rgba(201,168,76,0.4)",color:"#b8963e"}} className="w-full gap-2"
                              onClick={() => handleGeneratePitch(selectedLeadData.id)}
                              disabled={pitchLoading && pitchLeadId === selectedLeadData.id}
                            >
                              {pitchLoading && pitchLeadId === selectedLeadData.id ? (
                                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Writing pitch...</>
                              ) : (
                                <><Sparkles className="w-3.5 h-3.5" /> Write AI Pitch for This Gig</>
                              )}
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="pt-2 border-t border-slate-100">
                          {(() => {
                            const priceCents = getLeadDisplayPriceCents(selectedLeadData as any);
                            return availableCredits >= priceCents;
                          })() && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3 flex items-center gap-2 text-sm">
                              <Gift className="w-4 h-4 text-amber-600 flex-shrink-0" />
                              <span className="text-amber-800 font-medium">
                                You have ${(availableCredits / 100).toFixed(2)} in lead credit — this lead unlocks free.
                              </span>
                            </div>
                          )}
                          <div className="bg-slate-50 rounded-lg p-3 mb-3">
                            <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                              <Lock className="w-3.5 h-3.5" />
                              <span>Contact info locked</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mb-2">
                              {(selectedLeadData as any).hasContactEmail && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                                  <Mail className="w-3 h-3" />
                                  Email available
                                </span>
                              )}
                              {(selectedLeadData as any).hasContactPhone && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                                  <Phone className="w-3 h-3" />
                                  Phone available
                                </span>
                              )}
                              {showFacebookProfileLeadCta(selectedLeadData) && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full">
                                  Facebook Lead — contact via profile link
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400">Unlock to reveal contact details</p>
                          </div>
                          <button
                            type="button"
                            className="btn-gold"
                            style={{ width: '100%' }}
                            onClick={() => handleUnlock(selectedLeadData.id)}
                            disabled={isProcessing && unlockingLeadId === selectedLeadData.id}
                          >
                            {isProcessing && unlockingLeadId === selectedLeadData.id ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <Lock className="w-4 h-4 mr-2" />
                                {(() => {
                                  const priceCents = getLeadDisplayPriceCents(selectedLeadData as any);
                                  if (availableCredits >= priceCents) return "Unlock Contact Info — FREE";
                                  const dollars = Math.round(priceCents / 100);
                                  return `Unlock Contact Info — $${dollars}`;
                                })()}
                              </>
                            )}
                          </button>
                          <p className="text-xs text-slate-400 text-center mt-2">
                            One-time payment · Instant access · No subscription
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Music className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-slate-600 font-medium">Select a gig to view details</p>
                    <p className="text-slate-400 text-sm mt-1">Click any lead on the left to see full info</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* UNLOCKED TAB */}
        {activeTab === "unlocked" && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-5">My Unlocked Leads</h2>
            {(myUnlocks ?? []).length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <Unlock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 font-medium">No unlocked leads yet</p>
                <p className="text-slate-400 text-sm mt-1 mb-6">
                  Browse gigs and unlock contact info — Discovery leads $3, Standard $7, Premium $15.
                </p>
                <Button onClick={() => setActiveTab("leads")} style={{background:"#c9a84c",color:"#1c1c2e",fontWeight:700}} className="">
                  Browse Gigs <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(myUnlocks ?? []).map((unlock) => (
                  <Card key={unlock.unlockId} className="border-slate-200">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-slate-900">{unlock.title}</h3>
                          <p className="text-sm text-slate-500">{unlock.eventType}</p>
                        </div>
                        <span className="text-lg font-bold text-emerald-600">{formatBudget(unlock.budget)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-slate-500 mb-3">
                        <MapPin className="w-3.5 h-3.5" />
                        {unlock.location}
                        {unlock.eventDate && (
                          <>
                            <span className="mx-1">·</span>
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(unlock.eventDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </>
                        )}
                      </div>
                      <div className="bg-green-50 rounded-lg p-3 space-y-1.5">
                        {unlock.contactName && (
                          <div className="flex items-center gap-2 text-sm">
                            <User className="w-3.5 h-3.5 text-green-600" />
                            <span className="font-medium">{unlock.contactName}</span>
                          </div>
                        )}
                        {unlock.contactEmail && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="w-3.5 h-3.5 text-green-600" />
                            <a
                              href={buildOutreachMailto(
                                unlock.contactEmail,
                                unlock.title,
                                unlock.location,
                                unlock.contactName,
                                unlock.performerType
                              )}
                              style={{color:"#b8963e"}} className="hover:underline"
                            >
                              {unlock.contactEmail}
                            </a>
                          </div>
                        )}
                        {unlock.contactPhone && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="w-3.5 h-3.5 text-green-600" />
                            <a href={`tel:${unlock.contactPhone}`} style={{color:'#b8963e'}} className="hover:underline">{unlock.contactPhone}</a>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-2">
                        Unlocked {new Date(unlock.unlockedAt).toLocaleDateString()}
                      </p>

                      {/* Feedback loop */}
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        {myFeedbackMap[unlock.leadId] ? (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Check className="w-3.5 h-3.5 text-green-500" />
                            Outcome recorded: <span className="font-medium capitalize">{(myFeedbackMap[unlock.leadId] as string).replace(/_/g, ' ')}</span>
                          </div>
                        ) : feedbackLeadId === unlock.leadId ? (
                          <div className="space-y-2">
                            <p className="text-xs text-slate-500 font-medium">How did this lead go?</p>
                            <div className="grid grid-cols-2 gap-1.5">
                              {([
                                { outcome: 'booked', label: '✅ Booked!', cls: 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' },
                                { outcome: 'no_response', label: '📭 No Response', cls: 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100' },
                                { outcome: 'lost', label: '❌ Lost', cls: 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100' },
                                { outcome: 'price_too_high', label: '💸 Price Too High', cls: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' },
                              ] as const).map(({ outcome, label, cls }) => (
                                <button
                                  key={outcome}
                                  disabled={feedbackPending}
                                  onClick={() => submitFeedback({ leadId: unlock.leadId, outcome })}
                                  className={`text-xs font-medium px-2 py-1.5 rounded-lg border transition-colors ${cls}`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                            <button onClick={() => setFeedbackLeadId(null)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setFeedbackLeadId(unlock.leadId)}
                            style={{color:"#b8963e"}} className="text-xs font-medium flex items-center gap-1"
                          >
                            <MessageSquare className="w-3 h-3" /> Record outcome
                          </button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* REFERRALS TAB */}
        {activeTab === "referrals" && (
          <div className="max-w-2xl">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Referral Program</h2>
            <p className="text-slate-500 text-sm mb-6">Share your link. Earn $7 in lead credit for every artist who joins.</p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <Card className="border-slate-200">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-slate-900">{referralStats?.referrals ?? 0}</p>
                  <p className="text-xs text-slate-500 mt-1">Artists Referred</p>
                </CardContent>
              </Card>
              <Card className="border-slate-200">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-600">${(referralStats?.pendingCredits ?? 0).toFixed(2)}</p>
                  <p className="text-xs text-slate-500 mt-1">Available Credits</p>
                </CardContent>
              </Card>
              <Card className="border-slate-200">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-slate-900">${(referralStats?.earnings ?? 0).toFixed(2)}</p>
                  <p className="text-xs text-slate-500 mt-1">Total Earned</p>
                </CardContent>
              </Card>
            </div>

            {/* How it works */}
            <Card className="border-slate-200 mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">How it works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { icon: Copy, text: "Share your unique referral link with other artists" },
                  { icon: Users, text: "They sign up and get 50% off their first lead unlock" },
                  { icon: Gift, text: "You earn a $7 lead credit — use it to unlock your next lead free" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{background:"#fef9ec"}}>
                      <item.icon className="w-4 h-4" style={{color:"#c9a84c"}} />
                    </div>
                    <p className="text-sm text-slate-700">{item.text}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Referral Link */}
            <Card className="" style={{borderColor:"rgba(201,168,76,0.3)",background:"#fef9ec"}}>
              <CardContent className="p-5">
                <p className="text-sm font-medium text-slate-700 mb-2">Your referral link</p>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={referralLink?.link ?? "Loading..."}
                    className="bg-white text-sm font-mono"
                  />
                  <Button
                    onClick={handleCopyReferral}
                    style={{background:"#c9a84c",color:"#1c1c2e",fontWeight:700}} className="flex-shrink-0"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Share on Instagram, Facebook, or text it to artist friends
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* INQUIRIES TAB */}
        {activeTab === "inquiries" && (
          <InquiriesTab inquiries={myInquiries ?? []} onUpdateStatus={updateInquiryStatus} />
        )}

        {/* SUBSCRIPTION / PREMIUM TAB */}
        {activeTab === "packs" && (
          <div className="max-w-2xl">
            <h2 className="text-xl font-bold text-slate-900 mb-1">Pro & Unlock Packs</h2>
            <p className="text-slate-500 text-sm mb-6">
              Pro: $49/month — 15 leads included, any tier, your choice. No commission. No booking fees. Ever. New leads added daily. Or buy one-time packs. Discovery leads $3, Standard $7, Premium $15.
              Credits are dollar-based and can be used toward any lead price.
            </p>
            {/* Pro subscription CTA */}
            {!mySubscription?.tier && (
              <Card className="mb-6 border-2" style={{borderColor:"#c9a84c",background:"#fef9ec"}}>
                <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-bold text-slate-900 text-lg">Pro — $49/month</p>
                    <p className="text-sm text-slate-600 whitespace-pre-line">{`15 leads included — any tier, your choice\nNo commission. No booking fees. Ever.\nNew leads added daily.`}</p>
                  </div>
                  <Button
                    style={{background:"#c9a84c",color:"#1c1c2e",fontWeight:700}} className="shrink-0"
                    disabled={isStartingPremium}
                    onClick={() => startPremium({ origin: typeof window !== "undefined" ? window.location.origin : undefined })}
                  >
                    {isStartingPremium ? "Loading…" : "Go Pro"}
                  </Button>
                </CardContent>
              </Card>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {([
                { id: "pack_3" as const, label: "3-Pack", unlocks: 3, price: "$18", perLead: "$6/lead", savings: "Save $3", highlighted: false },
                { id: "pack_10" as const, label: "10-Pack", unlocks: 10, price: "$49", perLead: "$4.90/lead", savings: "Save $21", highlighted: true },
                { id: "pack_25" as const, label: "25-Pack", unlocks: 25, price: "$99", perLead: "$3.96/lead", savings: "Save $76", highlighted: false },
              ]).map((pack) => (
                <Card key={pack.id} className={`relative p-5 ${pack.highlighted ? "border-2" : "border-slate-200"}`}>
                  {pack.highlighted && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">Most Popular</span>
                  )}
                  <p className="font-bold text-slate-900 text-lg mb-1">{pack.label}</p>
                  <p className="text-3xl font-bold mb-0.5" style={{color:"#c9a84c"}}>{pack.price}</p>
                  <p className="text-xs text-slate-500 mb-1">{pack.perLead}</p>
                  <p className="text-xs font-semibold text-green-600 mb-4">{pack.savings}</p>
                  <CreditPackButton packId={pack.id} highlighted={pack.highlighted} />
                </Card>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-4 text-center">Credits are added to your account instantly after checkout. Use them on any lead, anytime.</p>
          </div>
        )}
      </div>

      {/* Stripe Payment Dialog */}
      <StripePaymentDialog
        open={showPaymentDialog}
        onOpenChange={(open) => {
          setShowPaymentDialog(open);
          if (!open) {
            setUnlockingLeadId(null);
            setPaymentData(null);
          }
        }}
        clientSecret={paymentData?.clientSecret ?? null}
        paymentIntentId={paymentData?.paymentIntentId ?? null}
        amount={paymentData?.amount ?? 700}
        creditApplied={paymentData?.creditApplied ?? 0}
        leadTitle={paymentData?.leadTitle ?? ""}
        leadTier={(leads ?? []).find(l => l.id === unlockingLeadId)?.leadTier as any ?? null}
        publishableKey={stripeConfig?.publishableKey ?? null}
        isDemoMode={paymentData?.isDemoMode ?? stripeConfig?.isDemoMode ?? true}
        onSuccess={(paymentIntentId) => {
          if (unlockingLeadId) {
            confirmPayment({
              leadId: unlockingLeadId,
              paymentIntentId,
            });
          }
        }}
      />
    </div>
    </ErrorBoundary>
  );
}
