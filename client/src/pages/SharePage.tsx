import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Copy, ExternalLink, Gift, Users, DollarSign, Share2, Music, Instagram, Facebook } from "lucide-react";
import { Link } from "wouter";

const templates = [
  {
    id: "fb-dj-group",
    channel: "Facebook DJ Groups",
    icon: <Facebook className="w-4 h-4" />,
    color: "bg-blue-50 border-blue-200",
    badgeColor: "bg-blue-100 text-blue-700",
    subject: "Post for DJ / Performer Facebook Groups",
    audience: "DJs, performers, musicians in local FB groups",
    body: (link: string) =>
      `Anyone else tired of paying 20%+ commission on every gig? 🙋‍♂️\n\nI've been using Gigxo — it's a lead marketplace where you pay tiered prices to unlock the client's contact info: $3 discovery, $7 standard, $15 premium. Then you book directly and keep 100% of your fee.\n\nThey have weddings, corporate events, clubs, and private parties in Miami, Fort Lauderdale, and all major US cities.\n\nUse my link to sign up: ${link}\n\n#DJLife #GigLife #MiamiDJ`,
    suggestedGroups: ["Miami DJs", "South Florida DJs & Performers", "DJ Networking Group", "Gig Workers Unite"],
  },
  {
    id: "ig-story",
    channel: "Instagram Story / Caption",
    icon: <Instagram className="w-4 h-4" />,
    color: "bg-pink-50 border-pink-200",
    badgeColor: "bg-pink-100 text-pink-700",
    subject: "IG Story or Post Caption",
    audience: "Your Instagram followers",
    body: (link: string) =>
      `Stop paying 20% commission on every gig 💸\n\nGigxo lets you unlock client contact info with simple tiered pricing — $3 discovery, $7 standard, $15 premium. No platform middleman, no bidding wars, no commission.\n\nWeddings • Corporate • Clubs • Private Parties\n📍 All US cities\n\nTry it here → ${link}\n\n#DJ #Performer #GigLife #MusicBusiness #DJLife #Miami`,
    suggestedGroups: ["Your IG feed", "IG Stories with link sticker"],
  },
  {
    id: "tiktok",
    channel: "TikTok Caption",
    icon: <Music className="w-4 h-4" />,
    color: "bg-gray-50 border-gray-200",
    badgeColor: "bg-gray-100 text-gray-700",
    subject: "TikTok Video Caption",
    audience: "TikTok DJ / performer community",
    body: (link: string) =>
      `POV: You just booked a $2,000 wedding gig for $7 🤯\n\nGigxo is a lead marketplace where you pay $7 to unlock the client's contact info — no 20% commission, no bidding, no platform fees.\n\nLink in bio → ${link}\n\n#DJTikTok #GigLife #MusicBusiness #DJLife #HowToGetGigs #PerformerLife`,
    suggestedGroups: ["TikTok bio link", "Video caption"],
  },
  {
    id: "dm-friend",
    channel: "Direct Message",
    icon: <Share2 className="w-4 h-4" />,
    color: "bg-purple-50 border-purple-200",
    badgeColor: "bg-purple-100 text-purple-700",
    subject: "DM to DJ / Performer Friends",
    audience: "Individual DJ / performer contacts",
    body: (link: string) =>
      `Hey! Have you heard of Gigxo? It's a gig lead marketplace — clients post events (weddings, corporate, clubs) and you pay tiered prices to unlock their contact info: $3 discovery, $7 standard, $15 premium. No commission, no bidding.\n\nI've been using it and it's legit. Sign up with my link: ${link}\n\nLet me know if you try it!`,
    suggestedGroups: ["Instagram DMs", "Facebook Messenger", "iMessage / WhatsApp"],
  },
  {
    id: "nextdoor",
    channel: "Nextdoor / Community Boards",
    icon: <Users className="w-4 h-4" />,
    color: "bg-green-50 border-green-200",
    badgeColor: "bg-green-100 text-green-700",
    subject: "Nextdoor or Community Board Post",
    audience: "Local community members looking for entertainment",
    body: (link: string) =>
      `Local performers — are you looking for more gigs in our area? 🎵\n\nGigxo is a new platform where event clients post their entertainment needs and local DJs, bands, and performers can connect directly — no middleman, no big platform fees.\n\nIf you're a performer: sign up free and unlock leads with simple tiered pricing — $3 discovery, $7 standard, $15 premium → ${link}\n\nIf you're planning an event: you can also post your gig directly on Gigxo to reach local talent.`,
    suggestedGroups: ["Nextdoor", "Local Facebook community groups", "Ring / Neighbors app"],
  },
  {
    id: "email-blast",
    channel: "Email to Contacts",
    icon: <Gift className="w-4 h-4" />,
    color: "bg-yellow-50 border-yellow-200",
    badgeColor: "bg-yellow-100 text-yellow-700",
    subject: "Email to Your Network",
    audience: "Your email contacts who are performers",
    body: (link: string) =>
      `Subject: Found a better way to get gig leads\n\nHey,\n\nI wanted to share something I've been using to find gig leads without paying commission.\n\nIt's called Gigxo — basically a marketplace where event clients post their entertainment needs (weddings, corporate events, clubs, private parties) and you unlock their contact info with simple tiered pricing: $3 discovery, $7 standard, $15 premium.\n\nNo 20% GigSalad commission. No bidding wars. Just direct access to clients.\n\nThey cover all major US cities and have leads across DJ, live music, photography, makeup, and more.\n\nSign up with my link: ${link}\n\nLet me know if you have questions!\n\nBest,`,
    suggestedGroups: ["Gmail", "Mailchimp", "Your email list"],
  },
];

export default function SharePage() {
  const { user } = useAuth();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const { data: refData } = trpc.referrals.getReferralLink.useQuery(
    { origin: typeof window !== "undefined" ? window.location.origin : "https://gigxo.com" },
    { enabled: !!user }
  );
  const { data: stats } = trpc.referrals.getReferralStats.useQuery(undefined, { enabled: !!user });

  const referralLink = refData?.link ?? "https://gigxo.com";

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const shareToFacebook = () => {
    // Facebook sharer deep-link — opens the share dialog pre-filled with the referral URL.
    // On mobile this opens the native FB app; on desktop it opens a popup.
    const fbShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}&quote=${encodeURIComponent("Stop paying 20% commission on every gig. Gigxo lets you unlock client contact info with simple tiered pricing — $3 discovery, $7 standard, $15 premium. No middleman, no bidding wars. 🎵")}` ;
    window.open(fbShareUrl, "_blank", "noopener,noreferrer,width=600,height=500");
  };

  const shareToFacebookWithCopy = () => {
    // Copy the full FB group post text first, then open Facebook so the user can paste it
    const fbTemplate = templates.find((t) => t.id === "fb-dj-group");
    if (fbTemplate) {
      navigator.clipboard.writeText(fbTemplate.body(referralLink));
    }
    setTimeout(() => {
      window.open("https://www.facebook.com/groups/feed/", "_blank", "noopener,noreferrer");
    }, 300);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white border-b border-purple-100 px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 text-purple-700 font-bold text-lg">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
            <Music className="w-4 h-4 text-white" />
          </div>
          Gigxo
        </Link>
        <Link href="/dashboard">
          <Button variant="outline" size="sm">← Back to Dashboard</Button>
        </Link>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 px-4 py-2 rounded-full text-sm font-semibold mb-4">
            <Gift className="w-4 h-4" />
            Refer & Earn
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-3">Share Gigxo. Earn free leads.</h1>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            Every artist you refer earns you a <strong className="text-purple-700">$7 credit</strong> — that's one free lead unlock.
            Your referral gets <strong className="text-green-700">50% off their first unlock</strong>.
          </p>
        </div>

        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <Card className="text-center border-purple-100">
              <CardContent className="pt-5 pb-4">
                <div className="text-2xl font-bold text-purple-700">{stats.referrals}</div>
                <div className="text-xs text-slate-500 mt-1">Artists Referred</div>
              </CardContent>
            </Card>
            <Card className="text-center border-green-100">
              <CardContent className="pt-5 pb-4">
                <div className="text-2xl font-bold text-green-700">${stats.pendingCredits.toFixed(2)}</div>
                <div className="text-xs text-slate-500 mt-1">Credits Available</div>
              </CardContent>
            </Card>
            <Card className="text-center border-blue-100">
              <CardContent className="pt-5 pb-4">
                <div className="text-2xl font-bold text-blue-700">${stats.earnings.toFixed(2)}</div>
                <div className="text-xs text-slate-500 mt-1">Total Earned</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Referral Link */}
        <Card className="mb-8 border-purple-200 bg-purple-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Share2 className="w-4 h-4 text-purple-600" />
              Your Referral Link
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="flex-1 bg-white border border-purple-200 rounded-lg px-4 py-3 text-sm text-slate-700 font-mono truncate">
                {referralLink}
              </div>
              <Button onClick={copyLink} className="shrink-0 bg-purple-600 hover:bg-purple-700">
                {linkCopied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                {linkCopied ? "Copied!" : "Copy Link"}
              </Button>
            </div>
            <p className="text-xs text-purple-600 mt-2 flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              You earn $7 credit for each signup. They get 50% off their first unlock.
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <Button
                onClick={shareToFacebook}
                className="bg-[#1877F2] hover:bg-[#166FE5] text-white flex items-center gap-2 text-sm"
              >
                <Facebook className="w-4 h-4" />
                Share on Facebook
              </Button>
              <Button
                onClick={shareToFacebookWithCopy}
                variant="outline"
                className="border-[#1877F2] text-[#1877F2] hover:bg-blue-50 flex items-center gap-2 text-sm"
              >
                <Copy className="w-4 h-4" />
                Copy post + open FB Groups
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Social Templates */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Ready-to-post copy</h2>
          <p className="text-slate-500 text-sm mb-6">
            Click any template to copy it with your referral link already embedded. Paste directly into Facebook groups, Instagram, TikTok, or DMs.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((tpl) => (
              <Card key={tpl.id} className={`border ${tpl.color}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Badge className={`text-xs mb-1 border-0 ${tpl.badgeColor}`}>
                        <span className="mr-1">{tpl.icon}</span>
                        {tpl.channel}
                      </Badge>
                      <CardTitle className="text-sm font-semibold text-slate-800">{tpl.subject}</CardTitle>
                      <p className="text-xs text-slate-400 mt-0.5">For: {tpl.audience}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 bg-white"
                      onClick={() => copyText(tpl.body(referralLink), tpl.id)}
                    >
                      {copiedId === tpl.id ? (
                        <><Check className="w-3.5 h-3.5 text-green-500 mr-1" /> Copied!</>
                      ) : (
                        <><Copy className="w-3.5 h-3.5 mr-1" /> Copy</>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-600 leading-relaxed bg-white rounded p-3 whitespace-pre-wrap border border-slate-100">
                    {tpl.body(referralLink)}
                  </p>
                  {tpl.id === "fb-dj-group" && (
                    <Button
                      onClick={shareToFacebookWithCopy}
                      className="mt-3 w-full bg-[#1877F2] hover:bg-[#166FE5] text-white flex items-center justify-center gap-2 text-sm"
                    >
                      <Facebook className="w-4 h-4" />
                      Copy post &amp; open Facebook Groups
                    </Button>
                  )}
                  {tpl.suggestedGroups.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-slate-500 mb-1">Post in:</p>
                      <div className="flex flex-wrap gap-1">
                        {tpl.suggestedGroups.map((g) => (
                          <span key={g} className="text-xs bg-white text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">{g}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* How it works */}
        <Card className="mt-8 border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-800">How referrals work</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div>
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Share2 className="w-5 h-5 text-purple-600" />
                </div>
                <p className="text-sm font-semibold text-slate-800">1. Share your link</p>
                <p className="text-xs text-slate-500 mt-1">Post in DJ groups, send to friends, or add to your IG bio</p>
              </div>
              <div>
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-sm font-semibold text-slate-800">2. They sign up</p>
                <p className="text-xs text-slate-500 mt-1">They get 50% off their first unlock — a real incentive to join</p>
              </div>
              <div>
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-sm font-semibold text-slate-800">3. You earn $7</p>
                <p className="text-xs text-slate-500 mt-1">Credit is added to your account — use it on your next lead unlock</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
