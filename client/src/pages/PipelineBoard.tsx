import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft, Mail, Phone, Calendar, MapPin, DollarSign,
  ChevronRight, ChevronLeft, StickyNote, Check, X,
  Loader2, Music
} from "lucide-react";

type Stage = "inquiry" | "confirmed" | "completed" | "cancelled";

const STAGES: { id: Stage; label: string; color: string; bg: string; border: string }[] = [
  { id: "inquiry",   label: "New Inquiry",  color: "text-blue-400",   bg: "bg-blue-950/40",   border: "border-blue-800/50" },
  { id: "confirmed", label: "Confirmed",    color: "text-green-400",  bg: "bg-green-950/40",  border: "border-green-800/50" },
  { id: "completed", label: "Completed",    color: "text-purple-400", bg: "bg-purple-950/40", border: "border-purple-800/50" },
  { id: "cancelled", label: "Cancelled",    color: "text-slate-500",  bg: "bg-slate-900/40",  border: "border-slate-700/50" },
];

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
  artistNotes?: string | null;
  bookingStage: string;
  status: string;
  createdAt: Date;
};

function InquiryCard({
  inquiry,
  onMove,
  onNotesUpdate,
  isFirst,
  isLast,
}: {
  inquiry: Inquiry;
  onMove: (id: number, stage: Stage) => void;
  onNotesUpdate: (id: number, notes: string) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(inquiry.artistNotes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);

  const stageIndex = STAGES.findIndex(s => s.id === inquiry.bookingStage);

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    await onNotesUpdate(inquiry.id, notes);
    setSavingNotes(false);
    setEditingNotes(false);
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm hover:border-slate-600 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-white font-semibold text-sm">{inquiry.inquirerName}</p>
          {inquiry.eventType && (
            <span className="text-xs text-purple-400 font-medium">{inquiry.eventType}</span>
          )}
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-slate-500 hover:text-slate-300 text-xs flex-shrink-0"
        >
          {expanded ? "Less" : "More"}
        </button>
      </div>

      {/* Quick info */}
      <div className="space-y-1 mb-3">
        {inquiry.eventDate && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Calendar className="w-3 h-3" />
            <span>{inquiry.eventDate}</span>
          </div>
        )}
        {inquiry.budget && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <DollarSign className="w-3 h-3" />
            <span>{inquiry.budget}</span>
          </div>
        )}
        {inquiry.eventLocation && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <MapPin className="w-3 h-3" />
            <span className="truncate">{inquiry.eventLocation}</span>
          </div>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-slate-700 pt-3 mb-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <Mail className="w-3 h-3 text-slate-500" />
            <a href={`mailto:${inquiry.inquirerEmail}`} className="hover:text-purple-400 underline">
              {inquiry.inquirerEmail}
            </a>
          </div>
          {inquiry.inquirerPhone && (
            <div className="flex items-center gap-1.5 text-xs text-slate-300">
              <Phone className="w-3 h-3 text-slate-500" />
              <a href={`tel:${inquiry.inquirerPhone}`} className="hover:text-purple-400">
                {inquiry.inquirerPhone}
              </a>
            </div>
          )}
          {inquiry.message && (
            <p className="text-xs text-slate-400 bg-slate-900 rounded p-2 leading-relaxed">
              {inquiry.message}
            </p>
          )}

          {/* Notes */}
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <StickyNote className="w-3 h-3" /> Your notes
              </span>
              {!editingNotes && (
                <button
                  onClick={() => setEditingNotes(true)}
                  className="text-xs text-purple-400 hover:text-purple-300"
                >
                  Edit
                </button>
              )}
            </div>
            {editingNotes ? (
              <div className="space-y-1.5">
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Add private notes about this booking..."
                  className="text-xs bg-slate-900 border-slate-600 text-white placeholder:text-slate-600 min-h-[60px]"
                />
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="h-6 text-xs bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {savingNotes ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setEditingNotes(false); setNotes(inquiry.artistNotes ?? ""); }}
                    className="h-6 text-xs text-slate-400"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                {notes || "No notes yet"}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Stage navigation arrows */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
        <button
          onClick={() => onMove(inquiry.id, STAGES[stageIndex - 1].id)}
          disabled={isFirst}
          className="text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed p-1"
          title="Move back"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs text-slate-600">
          {new Date(inquiry.createdAt).toLocaleDateString()}
        </span>
        <button
          onClick={() => onMove(inquiry.id, STAGES[stageIndex + 1].id)}
          disabled={isLast}
          className="text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed p-1"
          title="Move forward"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function PipelineBoard() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const { data: board, isLoading } = trpc.pipeline.getBoard.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const moveCard = trpc.pipeline.moveCard.useMutation({
    onSuccess: () => utils.pipeline.getBoard.invalidate(),
    onError: () => toast.error("Failed to move card"),
  });

  const updateNotes = trpc.pipeline.updateNotes.useMutation({
    onSuccess: () => {
      utils.pipeline.getBoard.invalidate();
      toast.success("Notes saved");
    },
    onError: () => toast.error("Failed to save notes"),
  });

  const handleMove = (inquiryId: number, stage: Stage) => {
    moveCard.mutate({ inquiryId, stage });
  };

  const handleNotesUpdate = async (inquiryId: number, notes: string) => {
    await updateNotes.mutateAsync({ inquiryId, notes });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Music className="w-12 h-12 text-purple-500 mx-auto mb-4" />
          <p className="text-slate-400 mb-4">Please log in to view your pipeline</p>
          <Link href="/login">
            <Button className="bg-purple-600 hover:bg-purple-700 text-white">Log In</Button>
          </Link>
        </div>
      </div>
    );
  }

  const totalCards = board ? Object.values(board).reduce((sum, col) => sum + col.length, 0) : 0;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <button className="text-slate-400 hover:text-white flex items-center gap-1.5 text-sm">
                <ArrowLeft className="w-4 h-4" />
                Dashboard
              </button>
            </Link>
            <span className="text-slate-700">|</span>
            <h1 className="text-white font-semibold">Booking Pipeline</h1>
            {totalCards > 0 && (
              <Badge className="bg-purple-900/50 text-purple-300 border-purple-700 text-xs">
                {totalCards} total
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : totalCards === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Music className="w-8 h-8 text-slate-600" />
            </div>
            <h2 className="text-white font-semibold mb-2">No bookings yet</h2>
            <p className="text-slate-400 text-sm mb-6">
              When clients submit booking inquiries from your public profile, they'll appear here.
            </p>
            <Link href="/artists">
              <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                View Your Public Profile
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {STAGES.map((stage, stageIdx) => {
              const cards = (board?.[stage.id] ?? []) as Inquiry[];
              return (
                <div key={stage.id} className={`rounded-xl border ${stage.border} ${stage.bg} p-4`}>
                  {/* Column header */}
                  <div className="flex items-center justify-between mb-4">
                    <h2 className={`font-semibold text-sm ${stage.color}`}>{stage.label}</h2>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-slate-800 ${stage.color}`}>
                      {cards.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="space-y-3">
                    {cards.length === 0 ? (
                      <div className="text-center py-8 text-slate-600 text-xs">
                        No bookings here
                      </div>
                    ) : (
                      cards.map(inquiry => (
                        <InquiryCard
                          key={inquiry.id}
                          inquiry={inquiry}
                          onMove={handleMove}
                          onNotesUpdate={handleNotesUpdate}
                          isFirst={stageIdx === 0}
                          isLast={stageIdx === STAGES.length - 1}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
