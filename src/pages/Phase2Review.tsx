import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { JournalEntryTable } from "@/components/JournalEntryTable";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronLeft, ChevronRight, CheckCircle2, Star, Pause,
  Bug, SkipForward, StickyNote, Loader2,
} from "lucide-react";
import { toast } from "sonner";

export default function Phase2Review() {
  const { workspace } = useActiveWorkspace();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const chapterId = workspace?.chapterId;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");

  // ── Fetch queue: approved assets not yet reviewed in Phase 2 ───
  const { data: queue = [], isLoading } = useQuery({
    queryKey: ["phase2-review-queue", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teaching_assets")
        .select("id, asset_name, source_ref, survive_problem_text, survive_solution_text, journal_entry_completed_json, journal_entry_template_json, problem_context, source_type, source_number, problem_type, difficulty, admin_notes")
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
    mutationFn: async ({
      assetId,
      phase2_status,
      core_rank,
    }: {
      assetId: string;
      phase2_status: string;
      core_rank: number | null;
    }) => {
      const updates: Record<string, any> = { phase2_status };
      if (core_rank !== null) updates.core_rank = core_rank;
      if (phase2_status === "core_asset") updates.phase2_entered_at = new Date().toISOString();
      const { error } = await supabase
        .from("teaching_assets")
        .update(updates)
        .eq("id", assetId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["phase2-review-queue", chapterId] });
      qc.invalidateQueries({ queryKey: ["phase2-core-count", chapterId] });
    },
    onError: (err: Error) => toast.error(`Failed: ${err.message}`),
  });

  const handleAction = async (phase2_status: string, core_rank: number | null = null) => {
    if (!current) return;
    const label = core_rank ? `Core Rank ${core_rank}` : phase2_status.replace("_", " ");
    await statusMutation.mutateAsync({ assetId: current.id, phase2_status, core_rank });
    toast.success(`Marked as ${label}`);
    // Queue will re-fetch; index stays same (next item slides in)
    // If we were at the end, clamp
    if (currentIndex >= total - 1) {
      setCurrentIndex(Math.max(0, total - 2));
    }
  };

  // ── Add note mutation ──────────────────────────────────────────
  const noteMutation = useMutation({
    mutationFn: async ({ assetId, note }: { assetId: string; note: string }) => {
      const existingNotes = Array.isArray(current?.admin_notes) ? current.admin_notes : [];
      const newNote = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        author: user?.email || "unknown",
        text: note,
      };
      const { error } = await supabase
        .from("teaching_assets")
        .update({ admin_notes: [...existingNotes, newNote] } as any)
        .eq("id", assetId);
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

  // ── Loading ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SurviveSidebarLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </SurviveSidebarLayout>
    );
  }

  // ── Completion state ───────────────────────────────────────────
  if (total === 0) {
    return (
      <SurviveSidebarLayout>
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
          <CheckCircle2 className="h-12 w-12 text-emerald-400" />
          <h2 className="text-xl font-bold text-foreground">Phase 2 Review Complete</h2>
          <p className="text-muted-foreground text-sm">
            <strong className="text-foreground">{coreCount}</strong> assets selected as Core Assets
          </p>
          <Button onClick={() => navigate("/assets-library")} className="mt-2">
            View Core Assets →
          </Button>
        </div>
      </SurviveSidebarLayout>
    );
  }

  // ── Main review UI ─────────────────────────────────────────────
  return (
    <SurviveSidebarLayout>
      <div className="space-y-4 max-w-4xl mx-auto">
        {/* Header + progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-foreground">Phase 2 Review</h1>
            <Badge variant="outline" className="text-xs font-mono">
              {currentIndex + 1} / {total}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {total} asset{total !== 1 ? "s" : ""} ·{" "}
            {workspace?.courseName} · Ch {workspace?.chapterNumber}
          </p>
          <Progress value={progressPct} className="h-1.5" />
        </div>

        {/* Asset card */}
        {current && (
          <Card className="bg-card border-border">
            <CardContent className="p-5 space-y-4">
              {/* Asset header */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-base font-bold text-foreground font-mono">
                  {current.asset_name}
                </span>
                {current.source_ref && (
                  <Badge variant="secondary" className="text-[10px]">
                    {current.source_ref}
                  </Badge>
                )}
                {current.problem_type && (
                  <Badge variant="outline" className="text-[10px]">
                    {current.problem_type}
                  </Badge>
                )}
                {current.difficulty && (
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {current.difficulty}
                  </Badge>
                )}
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
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                    {current.survive_problem_text}
                  </p>
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
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                    {current.survive_solution_text}
                  </p>
                </div>
              )}

              {/* Existing admin notes */}
              {Array.isArray(current.admin_notes) && current.admin_notes.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Notes</p>
                  <div className="space-y-1">
                    {(current.admin_notes as any[]).map((n: any) => (
                      <p key={n.id} className="text-xs text-foreground/70">
                        <span className="text-muted-foreground">{new Date(n.date).toLocaleDateString()}</span>{" "}
                        — {n.text}
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
          {/* Primary: Core ranks */}
          <div className="flex gap-2">
            <Button
              size="lg"
              className="flex-1 text-sm font-bold"
              disabled={statusMutation.isPending}
              onClick={() => handleAction("core_asset", 1)}
            >
              <Star className="h-4 w-4 mr-1.5" /> Core Rank 1
            </Button>
            <Button
              size="default"
              className="flex-1 text-sm"
              disabled={statusMutation.isPending}
              onClick={() => handleAction("core_asset", 2)}
            >
              Core Rank 2
            </Button>
            <Button
              size="default"
              className="flex-1 text-sm"
              disabled={statusMutation.isPending}
              onClick={() => handleAction("core_asset", 3)}
            >
              Core Rank 3
            </Button>
          </div>

          {/* Secondary: Hold / Needs Debugging / Skip */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
              disabled={statusMutation.isPending}
              onClick={() => handleAction("hold")}
            >
              <Pause className="h-3.5 w-3.5 mr-1" /> Hold
            </Button>
            <Button
              variant="outline"
              className="flex-1 text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
              disabled={statusMutation.isPending}
              onClick={() => handleAction("needs_debugging")}
            >
              <Bug className="h-3.5 w-3.5 mr-1" /> Needs Debugging
            </Button>
            <Button
              variant="ghost"
              className="flex-1 text-xs text-muted-foreground"
              disabled={statusMutation.isPending}
              onClick={() => handleAction("skip")}
            >
              <SkipForward className="h-3.5 w-3.5 mr-1" /> Skip
            </Button>
          </div>

          {/* Navigation + Add Note */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={currentIndex <= 0}
              onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={currentIndex >= total - 1}
              onClick={() => setCurrentIndex(i => Math.min(total - 1, i + 1))}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
            <div className="ml-auto">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setNoteOpen(!noteOpen)}
              >
                <StickyNote className="h-3.5 w-3.5 mr-1" /> Add Note
              </Button>
            </div>
          </div>

          {/* Inline note textarea */}
          {noteOpen && current && (
            <div className="flex gap-2">
              <Textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Add an admin note…"
                className="text-sm min-h-[60px]"
              />
              <Button
                size="sm"
                disabled={!noteText.trim() || noteMutation.isPending}
                onClick={() => noteMutation.mutate({ assetId: current.id, note: noteText.trim() })}
              >
                Save
              </Button>
            </div>
          )}
        </div>
      </div>
    </SurviveSidebarLayout>
  );
}
