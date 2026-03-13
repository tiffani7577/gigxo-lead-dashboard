import { useState, useRef } from "react";
import { Link, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Music, MapPin, Star, Play, Pause, ArrowLeft,
  Loader2, Send, CheckCircle2, ExternalLink, Users,
  Calendar, DollarSign,
} from "lucide-react";

const EXPERIENCE_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  professional: "Professional",
  expert: "Expert",
};

function TrackPlayer({ track }: { track: { id: number; title: string; fileUrl: string; playCount: number } }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const incrementPlay = trpc.tracks.incrementPlay.useMutation();

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
      incrementPlay.mutate({ trackId: track.id });
    }
  };

  return (
    <div className="flex items-center gap-3 bg-slate-800 rounded-lg px-4 py-3 hover:bg-slate-700 transition-colors">
      <button
        onClick={toggle}
        className="w-10 h-10 rounded-full bg-purple-600 hover:bg-purple-500 flex items-center justify-center flex-shrink-0 transition-colors"
      >
        {playing ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{track.title}</p>
        <p className="text-slate-500 text-xs">{track.playCount} plays</p>
      </div>
      <audio ref={audioRef} src={track.fileUrl} onEnded={() => setPlaying(false)} />
    </div>
  );
}

export default function PublicArtistProfile() {
  const [, params] = useRoute("/artist/:slug");
  const slug = params?.slug ?? "";

  const { data: artist, isLoading } = trpc.directory.getArtistBySlug.useQuery(
    { slug },
    { enabled: !!slug }
  );

  const [inquiryForm, setInquiryForm] = useState({
    name: "",
    email: "",
    eventType: "",
    eventDate: "",
    message: "",
  });
  const [inquirySent, setInquirySent] = useState(false);

  const sendInquiry = trpc.booking.submitInquiry.useMutation({
    onSuccess: () => {
      setInquirySent(true);
      toast.success("Inquiry sent! The artist will contact you soon.");
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message || "Failed to send inquiry");
    },
  });

  const handleInquiry = () => {
    if (!inquiryForm.name.trim() || !inquiryForm.email.trim() || !inquiryForm.eventType.trim()) {
      toast.error("Please fill in your name, email, and event type");
      return;
    }
    if (!artist) return;
    sendInquiry.mutate({
      artistUserId: artist.userId,
      inquirerName: inquiryForm.name,
      inquirerEmail: inquiryForm.email,
      eventType: inquiryForm.eventType,
      eventDate: inquiryForm.eventDate || undefined,
      message: inquiryForm.message || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <Music className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Artist Not Found</h1>
          <p className="text-slate-400 mb-6">This artist profile doesn't exist or hasn't been published yet.</p>
          <Link href="/artists">
            <Button className="bg-purple-600 hover:bg-purple-700 text-white">Browse All Artists</Button>
          </Link>
        </div>
      </div>
    );
  }

  const genres = (artist.genres as string[]) ?? [];
  const equipment = (artist.equipment as string[]) ?? [];
  const photo = artist.photoUrl || artist.avatarUrl;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Nav */}
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/artists">
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white gap-2">
              <ArrowLeft className="w-4 h-4" /> Artist Directory
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white">Join as Artist</Button>
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero section */}
        <div className="flex flex-col sm:flex-row gap-6 mb-8">
          {/* Photo */}
          <div className="w-full sm:w-48 h-48 rounded-2xl overflow-hidden bg-slate-800 flex-shrink-0">
            {photo ? (
              <img src={photo} alt={artist.displayName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/30 to-slate-800">
                <Music className="w-16 h-16 text-slate-600" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex items-start gap-3 mb-2">
              <h1 className="text-3xl font-bold text-white">{artist.displayName}</h1>
              {artist.isVerified && (
                <div className="mt-1.5 flex items-center gap-1 bg-purple-600/20 border border-purple-600/40 rounded-full px-2 py-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-purple-400 text-xs font-medium">Verified</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 text-slate-400 text-sm mb-4">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                <span>{artist.location}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Star className="w-4 h-4" />
                <span>{EXPERIENCE_LABELS[artist.experienceLevel] ?? artist.experienceLevel}</span>
              </div>
              {artist.tracks && artist.tracks.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Music className="w-4 h-4" />
                  <span>{artist.tracks.length} track{artist.tracks.length !== 1 ? "s" : ""}</span>
                </div>
              )}
            </div>

            {genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {genres.map(g => (
                  <Badge key={g} variant="secondary" className="bg-slate-800 text-slate-300 border-slate-700 text-xs">
                    {g}
                  </Badge>
                ))}
              </div>
            )}

            {artist.bio && (
              <p className="text-slate-300 text-sm leading-relaxed line-clamp-3">{artist.bio}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: bio, tracks, equipment */}
          <div className="lg:col-span-2 space-y-6">
            {/* Full bio */}
            {artist.bio && (
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
                <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-400" /> About
                </h2>
                <p className="text-slate-300 text-sm leading-relaxed">{artist.bio}</p>
              </div>
            )}

            {/* Tracks */}
            {artist.tracks && artist.tracks.length > 0 && (
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
                <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Music className="w-4 h-4 text-purple-400" /> Music & Mixes
                  <span className="text-slate-500 text-sm font-normal">({artist.tracks.length})</span>
                </h2>
                <div className="space-y-2">
                  {artist.tracks.map(track => (
                    <TrackPlayer key={track.id} track={track} />
                  ))}
                </div>
              </div>
            )}

            {/* Equipment */}
            {equipment.length > 0 && (
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
                <h2 className="text-white font-semibold mb-3">Equipment & Setup</h2>
                <div className="flex flex-wrap gap-2">
                  {equipment.map(e => (
                    <span key={e} className="px-3 py-1 bg-slate-800 text-slate-300 text-xs rounded-full border border-slate-700">
                      {e}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* SoundCloud Embed */}
            {(artist as any).soundcloudUrl && (
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
                <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 text-orange-400">&#9654;</span> SoundCloud
                </h2>
                <iframe
                  width="100%"
                  height="166"
                  scrolling="no"
                  frameBorder="no"
                  allow="autoplay"
                  src={`https://w.soundcloud.com/player/?url=${encodeURIComponent((artist as any).soundcloudUrl)}&color=%23a855f7&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`}
                  className="rounded-lg"
                />
              </div>
            )}

            {/* Mixcloud Embed */}
            {(artist as any).mixcloudUrl && (() => {
              const match = ((artist as any).mixcloudUrl as string).match(/mixcloud\.com(\/[^?#]+)/);
              const key = match ? match[1] : null;
              return key ? (
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
                  <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <span className="w-5 h-5 text-blue-400">&#9654;</span> Mixcloud
                  </h2>
                  <iframe
                    width="100%"
                    height="180"
                    src={`https://player-widget.mixcloud.com/widget/iframe/?hide_cover=1&feed=${encodeURIComponent(key)}`}
                    frameBorder="0"
                    className="rounded-lg"
                  />
                </div>
              ) : null;
            })()}
          </div>

          {/* Right column: booking inquiry */}
          <div className="lg:col-span-1">
            <div className="bg-slate-900 border border-purple-800/40 rounded-xl p-5 sticky top-20">
              {inquirySent ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                  <h3 className="text-white font-semibold mb-1">Inquiry Sent!</h3>
                  <p className="text-slate-400 text-sm">
                    {artist.displayName} will reach out to you at {inquiryForm.email} soon.
                  </p>
                </div>
              ) : (
                <>
                  <h2 className="text-white font-semibold mb-1">Book {artist.displayName}</h2>
                  <p className="text-slate-400 text-xs mb-4">Send a booking inquiry directly to this artist.</p>

                  <div className="space-y-3">
                    <div>
                      <Label className="text-slate-400 text-xs">Your Name *</Label>
                      <Input
                        placeholder="Jane Smith"
                        value={inquiryForm.name}
                        onChange={e => setInquiryForm(f => ({ ...f, name: e.target.value }))}
                        className="mt-1 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-400 text-xs">Your Email *</Label>
                      <Input
                        type="email"
                        placeholder="jane@example.com"
                        value={inquiryForm.email}
                        onChange={e => setInquiryForm(f => ({ ...f, email: e.target.value }))}
                        className="mt-1 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-400 text-xs">Event Type *</Label>
                      <Input
                        placeholder="Wedding, Birthday, Club Night..."
                        value={inquiryForm.eventType}
                        onChange={e => setInquiryForm(f => ({ ...f, eventType: e.target.value }))}
                        className="mt-1 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-400 text-xs">Event Date</Label>
                      <Input
                        type="date"
                        value={inquiryForm.eventDate}
                        onChange={e => setInquiryForm(f => ({ ...f, eventDate: e.target.value }))}
                        className="mt-1 bg-slate-800 border-slate-600 text-white text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-400 text-xs">Message</Label>
                      <Textarea
                        placeholder="Tell the artist about your event, venue, expected attendance..."
                        value={inquiryForm.message}
                        onChange={e => setInquiryForm(f => ({ ...f, message: e.target.value }))}
                        rows={3}
                        className="mt-1 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 text-sm resize-none"
                      />
                    </div>
                    <Button
                      onClick={handleInquiry}
                      disabled={sendInquiry.isPending}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white gap-2"
                    >
                      {sendInquiry.isPending ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                      ) : (
                        <><Send className="w-4 h-4" /> Send Inquiry</>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* Are you this artist? */}
            <div className="mt-4 bg-slate-900 border border-slate-700 rounded-xl p-4 text-center">
              <p className="text-slate-400 text-xs mb-2">Are you this artist?</p>
              <Link href="/profile">
                <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 bg-transparent hover:bg-slate-800 text-xs w-full">
                  Edit Your Profile
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
