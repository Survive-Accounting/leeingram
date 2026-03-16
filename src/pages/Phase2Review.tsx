import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Phase2AllView } from "@/components/phase2/Phase2AllView";
import { Phase2DebugNotesTab } from "@/components/phase2/Phase2DebugNotesTab";
import { Phase2SpeedReviewPanel } from "@/components/phase2/Phase2SpeedReviewPanel";
import { InfoTip } from "@/components/InfoTip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft, ChevronRight, CheckCircle2, Star, Pause,
  Bug, SkipForward, StickyNote, Loader2, LayoutList, CreditCard, Undo2, Search, FileWarning,
} from "lucide-react";
import { toast } from "sonner";

type UndoEntry = {
  assetId: string;
  assetName: string;
  previousStatus: string | null;
  previousRank: number | null;
  newStatus: string;
  newRank: number | null;
};

const OUTPUT_FIELDS = [
  { key: "whiteboard_status", label: "Whiteboard" },
  { key: "video_production_status", label: "Video" },
  { key: "mc_status", label: "MC" },
  { key: "ebook_status", label: "Ebook" },
  { key: "qa_status", label: "QA" },
  { key: "deployment_status", label: "Deploy" },
] as const;

function OutputPill({ status, label }: { status: string; label: string }) {
  const cfg: Record<string, { dot: string; text: string }> = {
    not_started: { dot: "bg-muted-foreground/40", text: "text-muted-foreground" },
    in_progress: { dot: "bg-blue-400", text: "text-blue-400" },
    complete: { dot: "bg-emerald-400", text: "text-emerald-400" },
  };
  const c = cfg[status] || cfg.not_started;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] ${c.text}`}>
      {status === "complete" ? <CheckCircle2 className="h-2.5 w-2.5" /> : <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />}
      {label}
    </span>
  );
}

function Phase2Badge({ status, rank }: { status: string | null; rank: number | null }) {
  if (!status) return <Badge variant="outline" className="text-[10px] border-dashed border-muted-foreground/40 text-muted-foreground">Not Reviewed</Badge>;
  if (status === "core_asset") {
    const colors: Record<number, string> = {
      1: "bg-amber-500/20 text-amber-300 border-amber-500/40",
      2: "bg-muted text-muted-foreground border-border",
      3: "bg-muted/50 text-muted-foreground/60 border-border/50",
    };
    return <Badge variant="outline" className={`text-[10px] ${colors[rank ?? 1] || ""}`}>Core R{rank}</Badge>;
  }
  if (status === "hold") return <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400">Hold</Badge>;
  if (status === "needs_debugging") return <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">Needs Debugging</Badge>;
  if (status === "skip") return <Badge variant="outline" className="text-[10px] text-muted-foreground">Skipped</Badge>;
  return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
}

export default function Phase2Review() {
  const { workspace } = useActiveWorkspace();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const chapterId = workspace?.chapterId;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [jumpQuery, setJumpQuery] = useState("");
  const [debugBannerDismissed, setDebugBannerDismissed] = useState(false);

  const [viewMode, setViewMode] = useState<"review" | "all" | "debug">(() => {
    try { return (localStorage.getItem("phase2-view-mode") as "review" | "all" | "debug") || "review"; } catch { return "review"; }
  });
  useEffect(() => { localStorage.setItem("phase2-view-mode", viewMode); }, [viewMode]);

  // ── Fetch queue: approved assets not yet reviewed in Phase 2 ───
  const { data: queue = [], isLoading } = useQuery({
    queryKey: ["phase2-review-queue", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teaching_assets")
        .select("id, asset_name, source_ref, survive_problem_text, survive_solution_text, journal_entry_completed_json, journal_entry_template_json, problem_context, source_type, source_number, problem_type, difficulty, admin_notes, phase2_status, core_rank, whiteboard_status, video_production_status, mc_status, ebook_status, qa_status, deployment_status")
        .eq("chapter_id", chapterId!)
        .not("asset_approved_at", "is", null)
        .is("phase2_status", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!chapterId,
  });

  // ── Count of already-reviewed core assets for completion panel ──
  const { data: coreCount = 0 } = useQuery({
    queryKey: ["phase2-core-count", chapterId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("teaching_assets")
        .select("id", { count: "exact", head: true })
        .eq("chapter_id", chapterId!)
        .eq("phase2_status", "core_asset");
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!chapterId,
  });

  // ── Count of needs_debugging assets for debug session banner ──
  const { data: debugCount = 0 } = useQuery({
    queryKey: ["phase2-debug-count", chapterId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("teaching_assets")
        .select("id", { count: "exact", head: true })
        .eq("chapter_id", chapterId!)
        .eq("phase2_status", "needs_debugging");
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!chapterId,
  });

  const current = queue[currentIndex] ?? null;
  const total = queue.length;
  const progressPct = total > 0 ? ((currentIndex + 1) / total) * 100 : 0;

  // ── Set phase2 status mutation ─────────────────────────────────
  const statusMutation = useMutation({
    mutationFn: async ({ assetId, phase2_status, core_rank }: { assetId: string; phase2_status: string | null; core_rank: number | null }) => {
      const updates: Record<string, any> = { phase2_status, core_rank };
      if (phase2_status === "core_asset") updates.phase2_entered_at = new Date().toISOString();
      const { error } = await supabase.from("teaching_assets").update(updates).eq("id", assetId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["phase2-review-queue", chapterId] });
      qc.invalidateQueries({ queryKey: ["phase2-core-count", chapterId] });
      qc.invalidateQueries({ queryKey: ["phase2-all-assets", chapterId] });
    },
    onError: (err: Error) => toast.error(`Failed: ${err.message}`),
  });

  const handleAction = useCallback(async (phase2_status: string, core_rank: number | null = null) => {
    if (!current) return;
    // Push undo entry
    setUndoStack(prev => [...prev.slice(-9), {
      assetId: current.id,
      assetName: current.asset_name,
      previousStatus: current.phase2_status ?? null,
      previousRank: current.core_rank ?? null,
      newStatus: phase2_status,
      newRank: core_rank,
    }]);
    const label = core_rank ? `Core Rank ${core_rank}` : phase2_status.replace("_", " ");
    await statusMutation.mutateAsync({ assetId: current.id, phase2_status, core_rank });
    toast.success(`Marked as ${label}`);
    if (currentIndex >= total - 1) setCurrentIndex(Math.max(0, total - 2));
  }, [current, currentIndex, total, statusMutation]);

  const handleUndo = useCallback(async () => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    await statusMutation.mutateAsync({ assetId: last.assetId, phase2_status: last.previousStatus, core_rank: last.previousRank });
    toast.success(`Undid: ${last.newRank ? `Core Rank ${last.newRank}` : last.newStatus} on ${last.assetName}`);
  }, [undoStack, statusMutation]);

  // ── Keyboard shortcuts ─────────────────────────────────────────
  useEffect(() => {
    if (viewMode !== "review" || total === 0) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (statusMutation.isPending) return;
      switch (e.key) {
        case "1": e.preventDefault(); handleAction("core_asset", 1); break;
        case "2": e.preventDefault(); handleAction("core_asset", 2); break;
        case "3": e.preventDefault(); handleAction("core_asset", 3); break;
        case "h": case "H": e.preventDefault(); handleAction("hold"); break;
        case "d": case "D": e.preventDefault(); handleAction("needs_debugging"); break;
        case "s": case "S": e.preventDefault(); handleAction("skip"); break;
        case "z": case "Z": e.preventDefault(); handleUndo(); break;
        case "ArrowLeft": e.preventDefault(); setCurrentIndex(i => Math.max(0, i - 1)); break;
        case "ArrowRight": e.preventDefault(); setCurrentIndex(i => Math.min(total - 1, i + 1)); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [viewMode, total, handleAction, handleUndo, statusMutation.isPending]);

  // ── Quick jump ─────────────────────────────────────────────────
  const handleJump = () => {
    if (!jumpQuery.trim()) return;
    const idx = queue.findIndex(a => a.asset_name.toLowerCase().includes(jumpQuery.trim().toLowerCase()));
    if (idx >= 0) { setCurrentIndex(idx); setJumpQuery(""); }
    else toast.error("Asset not found in queue");
  };

  // ── Add note mutation ──────────────────────────────────────────
  const noteMutation = useMutation({
    mutationFn: async ({ assetId, note }: { assetId: string; note: string }) => {
      const existingNotes = Array.isArray(current?.admin_notes) ? current.admin_notes : [];
      const newNote = { id: crypto.randomUUID(), date: new Date().toISOString(), author: user?.email || "unknown", text: note };
      const { error } = await supabase.from("teaching_assets").update({ admin_notes: [...existingNotes, newNote] } as any).eq("id", assetId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Note added");
      setNoteText("");
      setNoteOpen(false);
      qc.invalidateQueries({ queryKey: ["phase2-review-queue", chapterId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── No chapter selected ────────────────────────────────────────
  if (!chapterId) {
    return (
      <SurviveSidebarLayout>
        <div className="text-center py-16">
          <h2 className="text-lg font-semibold text-foreground mb-2">Phase 2 Review</h2>
          <p className="text-muted-foreground text-sm">Select a course and chapter to begin.</p>
        </div>
      </SurviveSidebarLayout>
    );
  }

  if (isLoading) {
    return (
      <SurviveSidebarLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </SurviveSidebarLayout>
    );
  }

  return (
    <SurviveSidebarLayout>
      <div className="space-y-4 max-w-5xl mx-auto">
        {/* Header + view toggle */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h1 className="text-lg font-bold text-foreground">Phase 2 Review</h1>
          <div className="flex items-center gap-2">
            <InfoTip text="WB = Whiteboard · Vid = Video · MC = Multiple Choice · EB = Ebook · QA = Quality Assurance · Dep = Deployment" side="bottom" />
            {viewMode === "review" && total > 0 && (
              <div className="flex items-center gap-1">
                <Input
                  value={jumpQuery}
                  onChange={e => setJumpQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleJump()}
                  placeholder="Jump to asset…"
                  className="h-7 w-36 text-xs"
                />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleJump}>
                  <Search className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            <div className="flex border border-border rounded-lg overflow-hidden">
              <Button
                variant={viewMode === "review" ? "default" : "ghost"}
                size="sm"
                className="rounded-none h-7 text-xs px-2"
                onClick={() => setViewMode("review")}
              >
                <CreditCard className="h-3.5 w-3.5 mr-1" /> Review
              </Button>
              <Button
                variant={viewMode === "all" ? "default" : "ghost"}
                size="sm"
                className="rounded-none h-7 text-xs px-2"
                onClick={() => setViewMode("all")}
              >
                <LayoutList className="h-3.5 w-3.5 mr-1" /> All
              </Button>
              <Button
                variant={viewMode === "debug" ? "default" : "ghost"}
                size="sm"
                className="rounded-none h-7 text-xs px-2"
                onClick={() => setViewMode("debug")}
              >
                <FileWarning className="h-3.5 w-3.5 mr-1" /> Debug Notes
              </Button>
            </div>
          </div>
        </div>

        {viewMode === "debug" ? (
          <Phase2DebugNotesTab chapterId={chapterId} courseName={workspace?.courseName} chapterName={`Ch ${workspace?.chapterNumber}`} />
        ) : viewMode === "all" ? (
          <Phase2AllView chapterId={chapterId} />
        ) : total === 0 ? (
          /* Completion state */
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            <h2 className="text-xl font-bold text-foreground">Phase 2 Review Complete</h2>
            <p className="text-muted-foreground text-sm">
              <strong className="text-foreground">{coreCount}</strong> assets selected as Core Assets
            </p>
            <Button onClick={() => navigate("/assets-library")} className="mt-2">View Core Assets →</Button>

            {/* Debug session banner */}
            {debugCount > 0 && !debugBannerDismissed && (
              <div className="w-full max-w-md mt-6 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-left space-y-3">
                <div className="flex items-start gap-2">
                  <Bug className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      {debugCount} asset{debugCount !== 1 ? "s" : ""} need debugging
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Run the debug session before finishing this chapter
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => navigate(`/debug-session/${chapterId}`)}>
                    Start Debug Session →
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setDebugBannerDismissed(true)}>
                    Skip for now
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Progress */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {total} asset{total !== 1 ? "s" : ""} · {workspace?.courseName} · Ch {workspace?.chapterNumber}
                </p>
                <Badge variant="outline" className="text-xs font-mono">{currentIndex + 1} / {total}</Badge>
              </div>
              <Progress value={progressPct} className="h-1.5" />
            </div>

            {current && (
              <Phase2SpeedReviewPanel
                asset={current}
                assetIndex={currentIndex}
                totalAssets={total}
                isPending={statusMutation.isPending}
                undoCount={undoStack.length}
                noteOpen={noteOpen}
                noteText={noteText}
                onNoteOpenChange={setNoteOpen}
                onNoteTextChange={setNoteText}
                onNoteSave={() => noteMutation.mutate({ assetId: current.id, note: noteText.trim() })}
                noteSaving={noteMutation.isPending}
                onAction={(status, rank) => handleAction(status, rank ?? null)}
                onUndo={handleUndo}
                onPrev={() => setCurrentIndex(i => Math.max(0, i - 1))}
                onNext={() => setCurrentIndex(i => Math.min(total - 1, i + 1))}
                canPrev={currentIndex > 0}
                canNext={currentIndex < total - 1}
              />
            )}
          </>
        )}
      </div>
    </SurviveSidebarLayout>
  );
}
