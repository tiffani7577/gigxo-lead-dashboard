import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Zap, TrendingUp, Calendar, RefreshCw, ChevronDown, ChevronUp, Bot } from "lucide-react";
import { toast } from "sonner";

const CATEGORY_COLORS: Record<string, string> = {
  launch: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  seo: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  growth: "bg-green-500/10 text-green-400 border-green-500/20",
};

const FREQ_COLORS: Record<string, string> = {
  daily: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  weekly: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  monthly: "bg-violet-500/10 text-violet-400 border-violet-500/20",
};

export default function GrowthWorksheet() {
  const [activeFreq, setActiveFreq] = useState<"daily" | "weekly" | "monthly">("daily");
  const [expandedTask, setExpandedTask] = useState<number | null>(null);
  const [editingNotes, setEditingNotes] = useState<Record<number, string>>({});

  const { data: checklist = [], refetch: refetchChecklist } = trpc.worksheet.getChecklist.useQuery();
  const { data: growthTasks = [], refetch: refetchTasks } = trpc.worksheet.getGrowthTasks.useQuery();

  const toggleChecklist = trpc.worksheet.toggleChecklist.useMutation({
    onSuccess: () => refetchChecklist(),
  });

  const updateTask = trpc.worksheet.updateGrowthTask.useMutation({
    onSuccess: () => refetchTasks(),
  });

  const completedCount = checklist.filter(i => i.isCompleted).length;
  const totalCount = checklist.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const filteredTasks = growthTasks.filter(t => t.frequency === activeFreq);
  const doneTodayCount = filteredTasks.filter(t => t.status === "done").length;

  const handleToggleChecklist = (itemKey: string, current: boolean) => {
    toggleChecklist.mutate({ itemKey, isCompleted: !current });
  };

  const handleMarkDone = (id: number) => {
    updateTask.mutate({ id, status: "done", lastDoneAt: true });
    toast.success("Task marked as done!");
  };

  const handleMarkPending = (id: number) => {
    updateTask.mutate({ id, status: "pending" });
  };

  const handleSaveNotes = (id: number) => {
    const notes = editingNotes[id];
    if (notes !== undefined) {
      updateTask.mutate({ id, notes });
      setEditingNotes(prev => { const n = { ...prev }; delete n[id]; return n; });
      toast.success("Notes saved!");
    }
  };

  const launchItems = checklist.filter(i => i.category === "launch");
  const seoItems = checklist.filter(i => i.category === "seo");
  const growthItems = checklist.filter(i => i.category === "growth");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Growth Worksheet</h2>
        <p className="text-zinc-400 mt-1">Your personalized roadmap to launch and monetize Gigxo.</p>
      </div>

      {/* Launch Checklist */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              Launch Checklist
            </CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-sm text-zinc-400">{completedCount}/{totalCount} done</span>
              <Badge className={progress === 100 ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-zinc-800 text-zinc-300 border-zinc-700"}>
                {progress}%
              </Badge>
            </div>
          </div>
          <Progress value={progress} className="mt-3 h-2 bg-zinc-800" />
        </CardHeader>
        <CardContent className="space-y-6">
          {[
            { label: "Launch Steps", items: launchItems, color: "blue" },
            { label: "SEO Setup", items: seoItems, color: "purple" },
            { label: "Growth Milestones", items: growthItems, color: "green" },
          ].map(group => group.items.length > 0 && (
            <div key={group.label}>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">{group.label}</h3>
              <div className="space-y-2">
                {group.items.map(item => (
                  <div
                    key={item.itemKey}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      item.isCompleted
                        ? "bg-green-500/5 border-green-500/20 opacity-75"
                        : "bg-zinc-800/50 border-zinc-700/50 hover:border-zinc-600"
                    }`}
                    onClick={() => handleToggleChecklist(item.itemKey, item.isCompleted)}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {item.isCompleted
                        ? <CheckCircle2 className="w-5 h-5 text-green-400" />
                        : <Circle className="w-5 h-5 text-zinc-500" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm ${item.isCompleted ? "line-through text-zinc-500" : "text-white"}`}>
                        {item.label}
                      </p>
                      {item.description && (
                        <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{item.description}</p>
                      )}
                    </div>
                    <Badge className={`text-xs flex-shrink-0 ${CATEGORY_COLORS[item.category] || "bg-zinc-700 text-zinc-300"}`}>
                      {item.category}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Growth Tasks Worksheet */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              Monetization Playbook
            </CardTitle>
            <span className="text-sm text-zinc-400">{doneTodayCount}/{filteredTasks.length} done</span>
          </div>
          {/* Frequency tabs */}
          <div className="flex gap-2 mt-3">
            {(["daily", "weekly", "monthly"] as const).map(freq => (
              <button
                key={freq}
                onClick={() => setActiveFreq(freq)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  activeFreq === freq
                    ? freq === "daily" ? "bg-orange-500 text-white"
                      : freq === "weekly" ? "bg-cyan-500 text-white"
                      : "bg-violet-500 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {freq === "daily" ? "📅 Daily" : freq === "weekly" ? "📆 Weekly" : "🗓️ Monthly"}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredTasks.length === 0 && (
            <p className="text-zinc-500 text-sm text-center py-8">Loading tasks...</p>
          )}
          {filteredTasks.map(task => {
            const isExpanded = expandedTask === task.id;
            const isDone = task.status === "done";
            const isEditingNotes = editingNotes[task.id] !== undefined;

            return (
              <div
                key={task.id}
                className={`rounded-lg border transition-all ${
                  isDone
                    ? "bg-green-500/5 border-green-500/20"
                    : "bg-zinc-800/50 border-zinc-700/50"
                }`}
              >
                {/* Task header row */}
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer"
                  onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                >
                  <div className="flex-shrink-0">
                    {isDone
                      ? <CheckCircle2 className="w-5 h-5 text-green-400" />
                      : <Circle className="w-5 h-5 text-zinc-500" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-medium text-sm ${isDone ? "line-through text-zinc-500" : "text-white"}`}>
                        {task.title}
                      </p>
                      {task.isAutomated && (
                        <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs flex items-center gap-1">
                          <Bot className="w-3 h-3" /> Automated
                        </Badge>
                      )}
                    </div>
                    {task.estimatedRevenue && (
                      <p className="text-xs text-green-400 mt-0.5 flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        {task.estimatedRevenue}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge className={`text-xs ${FREQ_COLORS[task.frequency] || ""}`}>
                      {task.frequency}
                    </Badge>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-zinc-700/50 pt-3">
                    <p className="text-sm text-zinc-300 leading-relaxed">{task.description}</p>

                    {/* Notes */}
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Your notes</label>
                      {isEditingNotes ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editingNotes[task.id]}
                            onChange={e => setEditingNotes(prev => ({ ...prev, [task.id]: e.target.value }))}
                            placeholder="Add notes, links, or results..."
                            className="bg-zinc-900 border-zinc-700 text-white text-sm min-h-[80px]"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleSaveNotes(task.id)} className="bg-cyan-600 hover:bg-cyan-700 text-white">
                              Save Notes
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingNotes(prev => { const n = { ...prev }; delete n[task.id]; return n; })} className="text-zinc-400">
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="text-sm text-zinc-400 bg-zinc-900/50 rounded p-2 cursor-pointer hover:bg-zinc-900 min-h-[40px] border border-zinc-700/50"
                          onClick={() => setEditingNotes(prev => ({ ...prev, [task.id]: task.notes || "" }))}
                        >
                          {task.notes || <span className="text-zinc-600 italic">Click to add notes...</span>}
                        </div>
                      )}
                    </div>

                    {/* Last done */}
                    {task.lastDoneAt && (
                      <p className="text-xs text-zinc-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Last done: {new Date(task.lastDoneAt).toLocaleDateString()}
                      </p>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-1">
                      {isDone ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMarkPending(task.id)}
                          className="border-zinc-700 text-zinc-400 hover:text-white bg-transparent"
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Reset
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleMarkDone(task.id)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Mark Done
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
