import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search, MapPin, Music, Star, Users, ChevronRight,
  Loader2, Filter, X, CheckCircle2,
} from "lucide-react";

const GENRE_FILTERS = [
  "House", "Tech House", "Deep House", "Techno", "EDM", "Hip-Hop", "R&B",
  "Top 40", "Latin", "Reggaeton", "Afrobeats", "Pop", "Jazz", "Wedding DJ",
  "Corporate Events", "Club DJ", "Festival DJ", "Live Band",
];

const LOCATION_FILTERS = ["Miami, FL", "Fort Lauderdale, FL", "Boca Raton, FL", "Coral Gables, FL", "Hialeah, FL"];

const EXPERIENCE_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  professional: "Professional",
  expert: "Expert",
};

export default function ArtistDirectory() {
  const [query, setQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedExp, setSelectedExp] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 24;

  const { data, isLoading } = trpc.directory.searchArtists.useQuery({
    query: query || undefined,
    genre: selectedGenre || undefined,
    location: selectedLocation || undefined,
    experienceLevel: (selectedExp as any) || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const artists = data?.artists ?? [];
  const total = data?.total ?? 0;

  const hasFilters = !!(query || selectedGenre || selectedLocation || selectedExp);

  const clearFilters = () => {
    setQuery("");
    setSelectedGenre("");
    setSelectedLocation("");
    setSelectedExp("");
    setPage(0);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                <Music className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-white text-lg">Gigxo</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">Log In</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white">Join as Artist</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 py-12 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            Find Miami Artists
          </h1>
          <p className="text-slate-400 text-lg mb-8">
            Browse verified DJs, live bands, and performers available for your event.
          </p>

          {/* Search bar */}
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Search by name, DJ name, or genre..."
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(0); }}
              className="pl-12 pr-4 py-3 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 text-base h-12 rounded-xl"
            />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Filter bar */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={`border-slate-600 text-slate-300 hover:bg-slate-800 bg-transparent gap-2 ${showFilters ? "border-purple-500 text-purple-400" : ""}`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasFilters && <span className="bg-purple-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">!</span>}
          </Button>

          {/* Quick genre chips */}
          <div className="flex gap-2 flex-wrap">
            {["House", "Hip-Hop", "Latin", "Wedding DJ", "Club DJ"].map(g => (
              <button
                key={g}
                onClick={() => { setSelectedGenre(selectedGenre === g ? "" : g); setPage(0); }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedGenre === g
                    ? "bg-purple-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 ml-auto"
            >
              <X className="w-3 h-3" /> Clear all
            </button>
          )}
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Genre */}
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Genre</p>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                {GENRE_FILTERS.map(g => (
                  <button
                    key={g}
                    onClick={() => { setSelectedGenre(selectedGenre === g ? "" : g); setPage(0); }}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedGenre === g ? "bg-purple-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Location */}
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Location</p>
              <div className="flex flex-col gap-1.5">
                {LOCATION_FILTERS.map(loc => (
                  <button
                    key={loc}
                    onClick={() => { setSelectedLocation(selectedLocation === loc ? "" : loc); setPage(0); }}
                    className={`px-3 py-1.5 rounded-lg text-xs text-left font-medium transition-colors ${
                      selectedLocation === loc ? "bg-purple-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>

            {/* Experience */}
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Experience Level</p>
              <div className="flex flex-col gap-1.5">
                {Object.entries(EXPERIENCE_LABELS).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => { setSelectedExp(selectedExp === val ? "" : val); setPage(0); }}
                    className={`px-3 py-1.5 rounded-lg text-xs text-left font-medium transition-colors ${
                      selectedExp === val ? "bg-purple-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Results count */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-slate-400 text-sm">
            {isLoading ? "Searching..." : `${total} artist${total !== 1 ? "s" : ""} found`}
          </p>
        </div>

        {/* Artist grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
        ) : artists.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-lg font-medium">No artists found</p>
            <p className="text-slate-500 text-sm mt-1">Try adjusting your search or filters</p>
            {hasFilters && (
              <Button onClick={clearFilters} variant="outline" size="sm" className="mt-4 border-slate-600 text-slate-300 bg-transparent hover:bg-slate-800">
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {artists.map(artist => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-center gap-3 mt-10">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="border-slate-600 text-slate-300 bg-transparent hover:bg-slate-800"
            >
              Previous
            </Button>
            <span className="text-slate-400 text-sm">
              Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={(page + 1) * PAGE_SIZE >= total}
              onClick={() => setPage(p => p + 1)}
              className="border-slate-600 text-slate-300 bg-transparent hover:bg-slate-800"
            >
              Next
            </Button>
          </div>
        )}

        {/* CTA for artists */}
        <div className="mt-16 bg-gradient-to-r from-purple-900/40 to-slate-900 border border-purple-800/40 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Are you a Miami artist?</h2>
          <p className="text-slate-400 mb-6">
            Join Gigxo to get booked for weddings, nightclubs, yacht parties, and more.
            Browse gig leads for just $7 per unlock.
          </p>
          <Link href="/signup">
            <Button className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 text-base">
              Create Your Artist Profile
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function ArtistCard({ artist }: {
  artist: {
    id: number;
    userId: number;
    slug: string | null;
    djName: string | null;
    displayName: string;
    photoUrl: string | null;
    avatarUrl: string | null;
    genres: unknown;
    location: string;
    experienceLevel: string;
    bio: string | null;
    trackCount: number;
    isVerified: boolean;
  }
}) {
  const genres = (artist.genres as string[]) ?? [];
  const photo = artist.photoUrl || artist.avatarUrl;
  const profileUrl = artist.slug ? `/artist/${artist.slug}` : null;

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden hover:border-purple-600/50 transition-all group">
      {/* Photo */}
      <div className="aspect-square bg-slate-800 relative overflow-hidden">
        {photo ? (
          <img src={photo} alt={artist.displayName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/30 to-slate-800">
            <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center">
              <Music className="w-8 h-8 text-slate-500" />
            </div>
          </div>
        )}
        {artist.isVerified && (
          <div className="absolute top-2 right-2 bg-purple-600 rounded-full p-1" title="Verified Profile">
            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
          </div>
        )}
        {artist.trackCount > 0 && (
          <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1">
            <Music className="w-3 h-3 text-purple-400" />
            <span className="text-white text-xs">{artist.trackCount}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-white font-semibold text-sm truncate">{artist.displayName}</h3>
          <span className="text-xs text-slate-500 flex-shrink-0">{EXPERIENCE_LABELS[artist.experienceLevel] ?? artist.experienceLevel}</span>
        </div>
        <div className="flex items-center gap-1 text-slate-500 text-xs mb-3">
          <MapPin className="w-3 h-3" />
          <span className="truncate">{artist.location}</span>
        </div>
        {genres.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {genres.slice(0, 3).map(g => (
              <span key={g} className="px-2 py-0.5 bg-slate-800 text-slate-300 text-xs rounded-full">{g}</span>
            ))}
            {genres.length > 3 && (
              <span className="px-2 py-0.5 bg-slate-800 text-slate-500 text-xs rounded-full">+{genres.length - 3}</span>
            )}
          </div>
        )}
        {profileUrl ? (
          <Link href={profileUrl}>
            <Button size="sm" variant="outline" className="w-full border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white bg-transparent text-xs gap-1">
              View Profile <ChevronRight className="w-3 h-3" />
            </Button>
          </Link>
        ) : (
          <Button size="sm" variant="outline" disabled className="w-full border-slate-700 text-slate-600 bg-transparent text-xs">
            Profile not public
          </Button>
        )}
      </div>
    </div>
  );
}
