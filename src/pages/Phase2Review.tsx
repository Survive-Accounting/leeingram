import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { JournalEntryTable } from "@/components/JournalEntryTable";
import { Phase2AllView } from "@/components/phase2/Phase2AllView";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft, ChevronRight, CheckCircle2, Star, Pause,
  Bug, SkipForward, StickyNote, Loader2, LayoutList, CreditCard, Undo2, Search,
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

  const [viewMode, setViewMode] = useState<"review" | "all">(() => {
    try { return (localStorage.getItem("phase2-view-mode") as "review" | "all") || "review"; } catch { return "review"; }
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
            </div>
          </div>
        </div>

        {viewMode === "all" ? (
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

            {/* Asset card */}
            {current && (
              <Card className="bg-card border-border">
                <CardContent className="p-5 space-y-3">
                  {/* Header */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-base font-bold text-foreground font-mono">{current.asset_name}</span>
                    {current.source_ref && <Badge variant="secondary" className="text-[10px]">{current.source_ref}</Badge>}
                    {current.problem_type && <Badge variant="outline" className="text-[10px]">{current.problem_type}</Badge>}
                    {current.difficulty && <Badge variant="outline" className="text-[10px] capitalize">{current.difficulty}</Badge>}
                  </div>

                  {/* Status panel */}
                  <div className="flex flex-col gap-1 p-2 rounded-md bg-muted/30 border border-border/50">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Status</span>
                      <Phase2Badge status={current.phase2_status} rank={current.core_rank} />
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {OUTPUT_FIELDS.map(f => (
                        <OutputPill key={f.key} status={(current as any)[f.key] || "not_started"} label={f.label} />
                      ))}
                    </div>
                  </div>

                  {/* Problem context */}
                  {current.problem_context && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Context</p>
                      <p className="text-sm text-foreground/90 whitespace-pre-wrap">{current.problem_context}</p>
                    </div>
                  )}

                  {/* Problem text */}
                  {current.survive_problem_text && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Problem Text</p>
                      <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{current.survive_problem_text}</p>
                    </div>
                  )}

                  {/* Journal entries */}
                  {current.journal_entry_completed_json && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Journal Entries</p>
                      <JournalEntryTable completedJson={current.journal_entry_completed_json as any} />
                    </div>
                  )}

                  {/* Answer / solution */}
                  {current.survive_solution_text && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Answer Summary</p>
                      <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{current.survive_solution_text}</p>
                    </div>
                  )}

                  {/* Existing admin notes */}
                  {Array.isArray(current.admin_notes) && current.admin_notes.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Notes</p>
                      <div className="space-y-1">
                        {(current.admin_notes as any[]).map((n: any) => (
                          <p key={n.id} className="text-xs text-foreground/70">
                            <span className="text-muted-foreground">{new Date(n.date).toLocaleDateString()}</span> — {n.text}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Action buttons */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button size="lg" className="flex-1 text-sm font-bold" disabled={statusMutation.isPending} onClick={() => handleAction("core_asset", 1)}>
                  <Star className="h-4 w-4 mr-1.5" /> Core Rank 1
                </Button>
                <Button size="default" className="flex-1 text-sm" disabled={statusMutation.isPending} onClick={() => handleAction("core_asset", 2)}>Core Rank 2</Button>
                <Button size="default" className="flex-1 text-sm" disabled={statusMutation.isPending} onClick={() => handleAction("core_asset", 3)}>Core Rank 3</Button>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10" disabled={statusMutation.isPending} onClick={() => handleAction("hold")}>
                  <Pause className="h-3.5 w-3.5 mr-1" /> Hold
                </Button>
                <Button variant="outline" className="flex-1 text-xs border-destructive/40 text-destructive hover:bg-destructive/10" disabled={statusMutation.isPending} onClick={() => handleAction("needs_debugging")}>
                  <Bug className="h-3.5 w-3.5 mr-1" /> Needs Debugging
                </Button>
                <Button variant="ghost" className="flex-1 text-xs text-muted-foreground" disabled={statusMutation.isPending} onClick={() => handleAction("skip")}>
                  <SkipForward className="h-3.5 w-3.5 mr-1" /> Skip
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" disabled={currentIndex <= 0} onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>
                <Button variant="ghost" size="sm" disabled={currentIndex >= total - 1} onClick={() => setCurrentIndex(i => Math.min(total - 1, i + 1))}>
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
                <Button variant="outline" size="sm" className="text-xs" disabled={undoStack.length === 0 || statusMutation.isPending} onClick={handleUndo}>
                  <Undo2 className="h-3.5 w-3.5 mr-1" /> Undo
                </Button>
                <div className="ml-auto">
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setNoteOpen(!noteOpen)}>
                    <StickyNote className="h-3.5 w-3.5 mr-1" /> Add Note
                  </Button>
                </div>
              </div>

              {/* Inline note textarea */}
              {noteOpen && current && (
                <div className="flex gap-2">
                  <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add an admin note…" className="text-sm min-h-[60px]" />
                  <Button size="sm" disabled={!noteText.trim() || noteMutation.isPending} onClick={() => noteMutation.mutate({ assetId: current.id, note: noteText.trim() })}>Save</Button>
                </div>
              )}

              {/* Keyboard shortcut hints */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {[
                  { key: "1", label: "Rank 1" }, { key: "2", label: "Rank 2" }, { key: "3", label: "Rank 3" },
                  { key: "H", label: "Hold" }, { key: "D", label: "Debug" }, { key: "S", label: "Skip" },
                  { key: "Z", label: "Undo" }, { key: "←", label: "" }, { key: "→", label: "" },
                ].map(s => (
                  <span key={s.key} className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
                    <kbd className="px-1 py-0.5 rounded border border-border/50 bg-muted/30 font-mono text-[9px] leading-none">{s.key}</kbd>
                    {s.label && <span>{s.label}</span>}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </SurviveSidebarLayout>
  );
}
