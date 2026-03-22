import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  User, Camera, Music, MapPin, DollarSign, Star, Wrench,
  Check, ArrowLeft, ExternalLink, Loader2, X, Plus, Trash2,
  Play, Pause, Upload, FileAudio,
} from "lucide-react";

const GENRE_OPTIONS = [
  "House", "Tech House", "Deep House", "Techno", "EDM", "Hip-Hop", "R&B",
  "Top 40", "Latin", "Reggaeton", "Salsa", "Merengue", "Afrobeats",
  "Pop", "Rock", "Country", "Jazz", "Blues", "Funk", "Soul",
  "Wedding DJ", "Corporate Events", "Club DJ", "Festival DJ", "Live Band",
];

const EQUIPMENT_OPTIONS = [
  "Pioneer CDJ-3000", "Pioneer CDJ-2000NXS2", "Pioneer DJM-900NXS2", "Pioneer DJM-V10",
  "Serato DJ Pro", "Rekordbox DJ", "Traktor Pro", "Ableton Live",
  "Macbook Pro", "Own PA System", "Own Lighting Rig", "Own Subwoofers",
  "Microphone", "Karaoke System",
];

// ---- Track Player Component ----
function TrackPlayer({ track, onDelete }: { track: { id: number; title: string; fileUrl: string; playCount: number }; onDelete: (id: number) => void }) {
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
    <div className="flex items-center gap-3 bg-slate-800 rounded-lg px-4 py-3 group">
      <button
        onClick={toggle}
        className="w-9 h-9 rounded-full bg-purple-600 hover:bg-purple-500 flex items-center justify-center flex-shrink-0 transition-colors"
      >
        {playing ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{track.title}</p>
        <p className="text-slate-500 text-xs">{track.playCount} plays</p>
      </div>
      <audio ref={audioRef} src={track.fileUrl} onEnded={() => setPlaying(false)} />
      <button
        onClick={() => onDelete(track.id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-red-400 p-1"
        title="Delete track"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function ArtistProfile() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const { data: profile, isLoading } = trpc.artist.getMyArtistProfile.useQuery(undefined, {
    enabled: !!user,
  });

  const [form, setForm] = useState({
    stageName: "",
    slug: "",
    bio: "",
    location: "Miami, FL",
    experienceLevel: "intermediate" as "beginner" | "intermediate" | "professional" | "expert",
    minBudget: 0,
    maxDistance: 30,
    genres: [] as string[],
    equipment: [] as string[],
    photoUrl: "",
    heroImageUrl: "",
    avatarUrl: "",
    profileImageUrl: "",
    soundcloudUrl: "",
    mixcloudUrl: "",
    youtubeUrl: "",
    instagramUrl: "",
    tiktokUrl: "",
    websiteUrl: "",
    currentResidencies: [] as string[],
    isPublished: false,
  });

  const [slugTouched, setSlugTouched] = useState(false);
  const [customGenre, setCustomGenre] = useState("");
  const [customEquipment, setCustomEquipment] = useState("");
  const [saving, setSaving] = useState(false);
  // Allow full clear before typing (avoid parseInt locking to 0/30)
  const [minBudgetInput, setMinBudgetInput] = useState("");
  const [maxDistanceInput, setMaxDistanceInput] = useState("");

  // Track upload state
  const [uploadingTrack, setUploadingTrack] = useState(false);
  const [trackTitle, setTrackTitle] = useState("");
  const trackFileRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const profileImageRef = useRef<HTMLInputElement>(null);

  const { data: myTracks = [], refetch: refetchTracks } = trpc.tracks.getMyTracks.useQuery(undefined, {
    enabled: !!user,
  });

  const uploadTrack = trpc.tracks.uploadTrack.useMutation({
    onSuccess: () => {
      refetchTracks();
      setTrackTitle("");
      if (trackFileRef.current) trackFileRef.current.value = "";
      setUploadingTrack(false);
      toast.success("Track uploaded!");
    },
    onError: (err) => {
      toast.error(err.message || "Upload failed");
      setUploadingTrack(false);
    },
  });

  const deleteTrack = trpc.tracks.deleteTrack.useMutation({
    onSuccess: () => { refetchTracks(); toast.success("Track deleted"); },
  });

  const uploadProfileImage = trpc.artist.uploadProfileImage.useMutation({
    onSuccess: (data) => {
      setForm(f => ({ ...f, profileImageUrl: data.url, photoUrl: data.url, avatarUrl: data.url }));
      utils.artist.getMyArtistProfile.invalidate();
      setUploadingPhoto(false);
      toast.success("Profile photo updated!");
    },
    onError: (err) => {
      toast.error(err.message || "Upload failed");
      setUploadingPhoto(false);
    },
  });

  const handleTrackUpload = async () => {
    const file = trackFileRef.current?.files?.[0];
    if (!file) { toast.error("Please select an audio file"); return; }
    if (!trackTitle.trim()) { toast.error("Please enter a track title"); return; }
    if (file.size > 16 * 1024 * 1024) { toast.error("File too large. Max 16MB."); return; }

    setUploadingTrack(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      uploadTrack.mutate({
        title: trackTitle.trim(),
        fileBase64: base64,
        mimeType: file.type || "audio/mpeg",
        fileSizeBytes: file.size,
      });
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!profile) return;
    const minB = profile.minBudget ?? 0;
    const maxD = profile.maxDistance ?? 30;
    setForm({
      stageName: (profile as any).stageName ?? profile.djName ?? "",
      slug: profile.slug ?? "",
      bio: profile.bio ?? "",
      location: profile.location ?? "Miami, FL",
      experienceLevel: (profile.experienceLevel as any) ?? "intermediate",
      minBudget: minB,
      maxDistance: maxD,
      genres: (profile.genres as string[]) ?? [],
      equipment: (profile.equipment as string[]) ?? [],
      photoUrl: (profile as any).photoUrl ?? (profile as any).avatarUrl ?? "",
      heroImageUrl: (profile as any).heroImageUrl ?? (profile as any).photoUrl ?? "",
      avatarUrl: (profile as any).avatarUrl ?? (profile as any).photoUrl ?? "",
      profileImageUrl: (profile as any).profileImageUrl ?? "",
      soundcloudUrl: (profile as any).soundcloudUrl ?? "",
      mixcloudUrl: (profile as any).mixcloudUrl ?? "",
      youtubeUrl: (profile as any).youtubeUrl ?? "",
      instagramUrl: (profile as any).instagramUrl ?? "",
      tiktokUrl: (profile as any).tiktokUrl ?? "",
      websiteUrl: (profile as any).websiteUrl ?? "",
      currentResidencies: ((profile as any).currentResidencies as string[]) ?? [],
      isPublished: (profile as any).isPublished ?? false,
    });
    setMinBudgetInput(String(minB));
    setMaxDistanceInput(String(maxD));
  }, [profile]);

  const updateProfile = trpc.artist.upsertMyArtistProfile.useMutation({
    onSuccess: () => {
      utils.artist.getMyArtistProfile.invalidate();
      toast.success("Profile saved!");
      setSaving(false);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to save profile");
      setSaving(false);
    },
  });

  const handleSave = () => {
    const minB = minBudgetInput === "" ? 0 : parseInt(minBudgetInput, 10);
    const maxD = maxDistanceInput === "" ? 30 : parseInt(maxDistanceInput, 10);
    setSaving(true);
    updateProfile.mutate({
      stageName: form.stageName || undefined,
      slug: form.slug || undefined,
      bio: form.bio || undefined,
      heroImageUrl: form.heroImageUrl || undefined,
      avatarUrl: form.avatarUrl || undefined,
      location: form.location,
      templateId: "default",
      themePrimary: undefined,
      themeAccent: undefined,
      isPublished: form.isPublished,
      currentResidencies: form.currentResidencies,
      soundcloudUrl: form.soundcloudUrl || undefined,
      youtubeUrl: form.youtubeUrl || undefined,
      instagramUrl: form.instagramUrl || undefined,
      tiktokUrl: form.tiktokUrl || undefined,
      websiteUrl: form.websiteUrl || undefined,
      minBudget: Number.isNaN(minB) ? 0 : minB,
      maxDistance: Number.isNaN(maxD) ? 30 : Math.min(200, Math.max(0, maxD)),
    });
  };

  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 64);

  const handleStageNameChange = (val: string) => {
    setForm(f => ({
      ...f,
      stageName: val,
      slug: slugTouched ? f.slug : autoSlug(val),
    }));
  };

  const toggleGenre = (g: string) => {
    setForm(f => ({
      ...f,
      genres: f.genres.includes(g) ? f.genres.filter(x => x !== g) : [...f.genres, g],
    }));
  };

  const toggleEquipment = (e: string) => {
    setForm(f => ({
      ...f,
      equipment: f.equipment.includes(e) ? f.equipment.filter(x => x !== e) : [...f.equipment, e],
    }));
  };

  const addCustomGenre = () => {
    if (customGenre.trim() && !form.genres.includes(customGenre.trim())) {
      setForm(f => ({ ...f, genres: [...f.genres, customGenre.trim()] }));
      setCustomGenre("");
    }
  };

  const addCustomEquipment = () => {
    if (customEquipment.trim() && !form.equipment.includes(customEquipment.trim())) {
      setForm(f => ({ ...f, equipment: [...f.equipment, customEquipment.trim()] }));
      setCustomEquipment("");
    }
  };

  const displayPhotoUrl = form.profileImageUrl || form.photoUrl || form.avatarUrl;

  const handleProfileImageUpload = async () => {
    const file = profileImageRef.current?.files?.[0];
    if (!file) { toast.error("Please select an image"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Please select a JPEG, PNG, or WebP image"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string)?.split(",")[1];
      if (base64) uploadProfileImage.mutate({ fileBase64: base64, mimeType: file.type || "image/jpeg" });
      else { toast.error("Could not read file"); setUploadingPhoto(false); }
    };
    reader.readAsDataURL(file);
    if (profileImageRef.current) profileImageRef.current.value = "";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Please log in to edit your profile.</p>
          <Link href="/login"><Button className="bg-purple-600 hover:bg-purple-700">Log In</Button></Link>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Could not load your artist profile.</p>
          <Link href="/dashboard"><Button variant="outline" className="border-slate-600">Back to dashboard</Button></Link>
        </div>
      </div>
    );
  }

  const isOwnProfile = user.id === profile.userId;
  if (!isOwnProfile) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <p className="text-slate-400 mb-4">You can only edit your own artist profile.</p>
          <Link href="/dashboard"><Button className="bg-purple-600 hover:bg-purple-700">Back to dashboard</Button></Link>
        </div>
      </div>
    );
  }

  const publicUrl = form.slug
    ? `${window.location.origin}/artist/${form.slug}`
    : null;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white">Artist Profile</h1>
              <p className="text-xs text-slate-400">How bookers will see you</p>
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : <><Check className="w-4 h-4 mr-2" /> Save Profile</>}
          </Button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Profile photo + name */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <User className="w-5 h-5 text-purple-400" /> Identity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Profile photo: upload or URL */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="w-20 h-20 rounded-full bg-slate-700 border-2 border-slate-600 overflow-hidden flex items-center justify-center flex-shrink-0">
                {displayPhotoUrl ? (
                  <img src={displayPhotoUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-8 h-8 text-slate-500" />
                )}
              </div>
              <div className="flex-1 min-w-[200px] space-y-2">
                <Label className="text-slate-300 text-sm">Profile photo</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={profileImageRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleProfileImageUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-slate-600 text-slate-300 hover:bg-slate-700 bg-transparent"
                    onClick={() => profileImageRef.current?.click()}
                    disabled={uploadingPhoto}
                  >
                    {uploadingPhoto ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</> : <><Upload className="w-4 h-4 mr-2" /> Upload image</>}
                  </Button>
                  <span className="text-xs text-slate-500">or paste URL below</span>
                </div>
                <Input
                  placeholder="https://your-photo-url.com/photo.jpg"
                  value={form.photoUrl}
                  onChange={e => setForm(f => ({ ...f, photoUrl: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300 text-sm">DJ / Stage Name</Label>
                <Input
                  placeholder="DJ Nova"
                  value={form.stageName}
                  onChange={e => handleStageNameChange(e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 mt-1"
                />
              </div>
              <div>
                <Label className="text-slate-300 text-sm">Public URL slug</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    placeholder="dj-nova"
                    value={form.slug}
                    onChange={e => {
                      setSlugTouched(true);
                      setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }));
                    }}
                    className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                  />
                  {publicUrl && (
                    <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="text-purple-400 hover:text-purple-300 flex-shrink-0">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </a>
                  )}
                </div>
                {publicUrl && (
                  <p className="text-xs text-purple-400 mt-1 truncate">{publicUrl}</p>
                )}
              </div>
            </div>

            <div>
              <Label className="text-slate-300 text-sm">Bio</Label>
              <Textarea
                placeholder="Tell bookers about yourself — your style, experience, and what makes your sets special..."
                value={form.bio}
                onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                rows={4}
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 mt-1 resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Location & Preferences */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-purple-400" /> Location & Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-slate-300 text-sm">Your Location</Label>
                <Input
                  placeholder="Miami, FL"
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 mt-1"
                />
              </div>
              <div>
                <Label className="text-slate-300 text-sm">Min Budget ($/gig)</Label>
                <Input
                  type="number"
                  min={0}
                  step={50}
                  value={minBudgetInput}
                  onChange={e => setMinBudgetInput(e.target.value)}
                  onBlur={() => {
                    const n = minBudgetInput === "" ? 0 : parseInt(minBudgetInput, 10);
                    const val = Number.isNaN(n) ? 0 : Math.max(0, n);
                    setForm(f => ({ ...f, minBudget: val }));
                    setMinBudgetInput(String(val));
                  }}
                  className="bg-slate-800 border-slate-600 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-slate-300 text-sm">Max Travel (miles)</Label>
                <Input
                  type="number"
                  min={0}
                  max={200}
                  value={maxDistanceInput}
                  onChange={e => setMaxDistanceInput(e.target.value)}
                  onBlur={() => {
                    const n = maxDistanceInput === "" ? 30 : parseInt(maxDistanceInput, 10);
                    const val = Number.isNaN(n) ? 30 : Math.min(200, Math.max(0, n));
                    setForm(f => ({ ...f, maxDistance: val }));
                    setMaxDistanceInput(String(val));
                  }}
                  className="bg-slate-800 border-slate-600 text-white mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-slate-300 text-sm">Experience Level</Label>
              <Select
                value={form.experienceLevel}
                onValueChange={v => setForm(f => ({ ...f, experienceLevel: v as any }))}
              >
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="beginner" className="text-white">Beginner (0–2 years)</SelectItem>
                  <SelectItem value="intermediate" className="text-white">Intermediate (2–5 years)</SelectItem>
                  <SelectItem value="professional" className="text-white">Professional (5–10 years)</SelectItem>
                  <SelectItem value="expert" className="text-white">Expert (10+ years)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Genres */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Music className="w-5 h-5 text-purple-400" /> Genres & Styles
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {GENRE_OPTIONS.map(g => (
                <button
                  key={g}
                  onClick={() => toggleGenre(g)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    form.genres.includes(g)
                      ? "bg-purple-600 text-white"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {g}
                </button>
              ))}
              {form.genres.filter(g => !GENRE_OPTIONS.includes(g)).map(g => (
                <button
                  key={g}
                  onClick={() => toggleGenre(g)}
                  className="px-3 py-1.5 rounded-full text-sm font-medium bg-purple-600 text-white flex items-center gap-1"
                >
                  {g} <X className="w-3 h-3" />
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add custom genre..."
                value={customGenre}
                onChange={e => setCustomGenre(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addCustomGenre()}
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
              />
              <Button onClick={addCustomGenre} variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700 bg-transparent">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Equipment */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Wrench className="w-5 h-5 text-purple-400" /> Equipment & Setup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT_OPTIONS.map(e => (
                <button
                  key={e}
                  onClick={() => toggleEquipment(e)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    form.equipment.includes(e)
                      ? "bg-blue-600 text-white"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {e}
                </button>
              ))}
              {form.equipment.filter(e => !EQUIPMENT_OPTIONS.includes(e)).map(e => (
                <button
                  key={e}
                  onClick={() => toggleEquipment(e)}
                  className="px-3 py-1.5 rounded-full text-sm font-medium bg-blue-600 text-white flex items-center gap-1"
                >
                  {e} <X className="w-3 h-3" />
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add custom equipment..."
                value={customEquipment}
                onChange={e => setCustomEquipment(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addCustomEquipment()}
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
              />
              <Button onClick={addCustomEquipment} variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700 bg-transparent">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Music Tracks */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Music className="w-5 h-5 text-purple-400" /> Music Tracks
              <span className="text-slate-500 text-sm font-normal ml-1">({myTracks.length} uploaded)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing tracks */}
            {myTracks.length > 0 ? (
              <div className="space-y-2">
                {myTracks.map(track => (
                  <TrackPlayer
                    key={track.id}
                    track={track}
                    onDelete={(id) => deleteTrack.mutate({ trackId: id })}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-500">
                <FileAudio className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No tracks yet. Upload your mixes to showcase your style.</p>
              </div>
            )}

            {/* Upload new track */}
            <div className="border border-dashed border-slate-600 rounded-lg p-4 space-y-3">
              <p className="text-slate-400 text-sm font-medium flex items-center gap-2">
                <Upload className="w-4 h-4" /> Upload a Track
              </p>
              <Input
                placeholder="Track title (e.g. Miami Sunset Mix)"
                value={trackTitle}
                onChange={e => setTrackTitle(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
              />
              <div className="flex items-center gap-3">
                <input
                  ref={trackFileRef}
                  type="file"
                  accept="audio/mpeg,audio/mp3,audio/wav,audio/mp4,audio/m4a,audio/ogg"
                  className="flex-1 text-sm text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-purple-600 file:text-white hover:file:bg-purple-500 cursor-pointer"
                />
                <Button
                  onClick={handleTrackUpload}
                  disabled={uploadingTrack}
                  className="bg-purple-600 hover:bg-purple-700 text-white flex-shrink-0"
                >
                  {uploadingTrack ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</> : "Upload"}
                </Button>
              </div>
              <p className="text-xs text-slate-500">Supported: MP3, WAV, M4A, OGG - Max 16MB per file</p>
            </div>
          </CardContent>
        </Card>

        {/* SoundCloud / Mixcloud Embeds */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Music className="w-4 h-4 text-purple-500" />
              Streaming Embeds
            </CardTitle>
            <p className="text-sm text-slate-500">Paste your SoundCloud or Mixcloud profile/track URL to embed a player on your public profile.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">SoundCloud URL</label>
              <Input
                placeholder="https://soundcloud.com/yourname or https://soundcloud.com/yourname/track"
                value={form.soundcloudUrl}
                onChange={e => setForm(f => ({ ...f, soundcloudUrl: e.target.value }))}
              />
              {form.soundcloudUrl && (
                <div className="mt-2 rounded-lg overflow-hidden border border-slate-200">
                  <iframe
                    width="100%"
                    height="166"
                    scrolling="no"
                    frameBorder="no"
                    allow="autoplay"
                    src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(form.soundcloudUrl)}&color=%23a855f7&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`}
                  />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Mixcloud URL</label>
              <Input
                placeholder="https://www.mixcloud.com/yourname/ or https://www.mixcloud.com/yourname/mix-title/"
                value={form.mixcloudUrl}
                onChange={e => setForm(f => ({ ...f, mixcloudUrl: e.target.value }))}
              />
              {form.mixcloudUrl && (() => {
                // Extract the path after mixcloud.com for the embed key
                const match = form.mixcloudUrl.match(/mixcloud\.com(\/[^?#]+)/);
                const key = match ? match[1] : null;
                return key ? (
                  <div className="mt-2 rounded-lg overflow-hidden border border-slate-200">
                    <iframe
                      width="100%"
                      height="180"
                      src={`https://player-widget.mixcloud.com/widget/iframe/?hide_cover=1&feed=${encodeURIComponent(key)}`}
                      frameBorder="0"
                    />
                  </div>
                ) : null;
              })()}
            </div>
          </CardContent>
        </Card>

        {/* Save button at bottom */}
        <div className="flex justify-end pb-8">
          <Button
            onClick={handleSave}
            disabled={saving}
            size="lg"
            className="bg-purple-600 hover:bg-purple-700 text-white px-8"
          >
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : <><Check className="w-4 h-4 mr-2" /> Save Profile</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
