import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, Loader2, Zap, ChevronDown, ChevronUp,
  Flag, Check, ArrowRight,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { cn } from "@/lib/utils";

/* ── Types ── */
type BankedQuestion = {
  id: string;
  teaching_asset_id: string | null;
  question_type: string;
  question_text: string;
  answer_a: string;
  answer_b: string;
  answer_c: string;
  answer_d: string;
  answer_e: string;
  correct_answer: string;
  short_explanation: string;
  difficulty: number;
  ai_confidence_score: number;
  review_status: string;
  rating: number | null;
  rejection_notes: string | null;
  teaching_assets: { asset_name: string; course_id: string; chapter_id: string; core_rank: number | null } | null;
};

type MCAsset = {
  id: string;
  asset_name: string;
  source_ref: string | null;
  core_rank: number | null;
  problem_type: string | null;
  survive_problem_text: string;
  survive_solution_text: string;
  journal_entry_block: string | null;
  difficulty: string | null;
};

/* ── Rank badge helper ── */
function RankBadge({ rank }: { rank: number | null }) {
  const r = rank ?? 3;
  return (
    <Badge variant="outline" className={cn(
      "text-[10px] font-bold px-1.5 py-0",
      r === 1 ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
        : r === 2 ? "bg-zinc-400/20 text-zinc-300 border-zinc-400/40"
          : "bg-zinc-600/20 text-zinc-500 border-zinc-600/40"
    )}>
      R{r}
    </Badge>
  );
}

/* ══════════════════════════════════════════ */
export default function BankedQuestionReview() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { workspace } = useActiveWorkspace();

  /* ── Speed mode ── */
  const [speedMode, setSpeedMode] = useState(() => localStorage.getItem("qr-speed-mode") !== "false");
  const toggleSpeed = (v: boolean) => { setSpeedMode(v); localStorage.setItem("qr-speed-mode", String(v)); };

  /* ── Review filters ── */
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [focusedIdx, setFocusedIdx] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showSummary, setShowSummary] = useState(false);

  /* ── Generation state ── */
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [generatingAll, setGeneratingAll] = useState(false);
  const [genProgress, setGenProgress] = useState({ current: 0, total: 0 });

  /* ══════════════════════════════════════════
     SECTION 1 — GENERATION QUEUE
     ══════════════════════════════════════════ */
  const { data: readyForMC = [] } = useQuery<MCAsset[]>({
    queryKey: ["mc-ready-assets", workspace?.chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teaching_assets")
        .select("id, asset_name, source_ref, core_rank, problem_type, survive_problem_text, survive_solution_text, journal_entry_block, difficulty")
        .eq("chapter_id", workspace!.chapterId)
        .eq("phase2_status", "core_asset")
        .eq("mc_status", "not_started")
        .order("core_rank", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MCAsset[];
    },
    enabled: !!workspace?.chapterId,
  });

  // Check if ALL core assets have been generated (for the green pill)
  const { data: allCoreAssets = [] } = useQuery({
    queryKey: ["all-core-assets-mc", workspace?.chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teaching_assets")
        .select("id, asset_name, core_rank, mc_status")
        .eq("chapter_id", workspace!.chapterId)
        .eq("phase2_status", "core_asset")
        .order("core_rank", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!workspace?.chapterId,
  });

  const allGenerated = allCoreAssets.length > 0 && readyForMC.length === 0;

  const generateMC = async (asset: MCAsset) => {
    setGeneratingIds(prev => new Set(prev).add(asset.id));
    try {
      const { data, error } = await supabase.functions.invoke("bank-teaching-asset", {
        body: {
          teaching_asset_id: asset.id,
          asset_name: asset.asset_name,
          problem_text: asset.survive_problem_text,
          solution_text: asset.survive_solution_text,
          journal_entry_block: asset.journal_entry_block,
          difficulty: asset.difficulty,
        },
      });
      if (error) {
        const msg = data?.error || error.message || "Unknown error";
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      await supabase.from("teaching_assets").update({ mc_status: "in_progress" } as any).eq("id", asset.id);
      toast.success(`Generated MC for ${asset.asset_name}`, { description: `${data.questions_generated || 0} questions` });
      qc.invalidateQueries({ queryKey: ["mc-ready-assets"] });
      qc.invalidateQueries({ queryKey: ["all-core-assets-mc"] });
      qc.invalidateQueries({ queryKey: ["banked-questions-review"] });
      qc.invalidateQueries({ queryKey: ["core-assets"] });
    } catch (e: any) {
      toast.error(`MC generation failed: ${asset.asset_name}`, { description: e.message });
    } finally {
      setGeneratingIds(prev => { const s = new Set(prev); s.delete(asset.id); return s; });
    }
  };

  const generateAllMC = async () => {
    setGeneratingAll(true);
    setGenProgress({ current: 0, total: readyForMC.length });
    for (let i = 0; i < readyForMC.length; i++) {
      setGenProgress({ current: i + 1, total: readyForMC.length });
      await generateMC(readyForMC[i]);
    }
    setGeneratingAll(false);
  };

  /* ══════════════════════════════════════════
     SECTION 2 — QUESTION REVIEW
     ══════════════════════════════════════════ */
  const { data: allQuestions = [], isLoading } = useQuery({
    queryKey: ["banked-questions-review", workspace?.chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banked_questions")
        .select(`
          id, teaching_asset_id, question_type, question_text,
          answer_a, answer_b, answer_c, answer_d, answer_e,
          correct_answer, short_explanation, difficulty,
          ai_confidence_score, review_status, rating, rejection_notes,
          teaching_assets ( asset_name, course_id, chapter_id, core_rank )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      let results = data as unknown as BankedQuestion[];
      if (workspace?.chapterId) {
        results = results.filter(q => q.teaching_assets?.chapter_id === workspace.chapterId);
      }
      return results;
    },
  });

  const statusCounts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0, all: 0 };
    for (const q of allQuestions) {
      c.all++;
      if (q.review_status === "pending") c.pending++;
      else if (q.review_status === "approved") c.approved++;
      else if (q.review_status === "rejected") c.rejected++;
    }
    return c;
  }, [allQuestions]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return allQuestions;
    return allQuestions.filter(q => q.review_status === statusFilter);
  }, [allQuestions, statusFilter]);

  // Reset focus when filter changes
  useEffect(() => { setFocusedIdx(0); setSelectedIds(new Set()); }, [statusFilter]);
  useEffect(() => {
    if (focusedIdx >= filtered.length && filtered.length > 0) setFocusedIdx(filtered.length - 1);
  }, [filtered.length, focusedIdx]);

  /* ── Mutations ── */
  const updateQuestion = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("banked_questions").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["banked-questions-review"] });
      qc.invalidateQueries({ queryKey: ["all-core-assets-mc"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // After approving/rejecting, auto-update mc_status
  const checkAssetComplete = useCallback(async (teachingAssetId: string | null) => {
    if (!teachingAssetId) return;
    // Ensure mc_status is at least 'in_progress' when any question is approved
    await supabase.from("teaching_assets").update({ mc_status: "in_progress" } as any).eq("id", teachingAssetId).eq("mc_status", "not_started");
    
    const { data } = await supabase
      .from("banked_questions")
      .select("id, review_status")
      .eq("teaching_asset_id", teachingAssetId);
    if (!data || data.length === 0) return;
    const nonePending = data.every(q => q.review_status === "approved" || q.review_status === "rejected");
    if (nonePending) {
      await supabase.from("teaching_assets").update({ mc_status: "complete" } as any).eq("id", teachingAssetId);
      qc.invalidateQueries({ queryKey: ["all-core-assets-mc"] });
      qc.invalidateQueries({ queryKey: ["core-assets"] });
      toast.success("All questions reviewed — MC status set to complete");
    }
  }, [qc]);

  const approveQuestion = useCallback((q: BankedQuestion) => {
    updateQuestion.mutate({ id: q.id, updates: { review_status: "approved" } }, {
      onSuccess: () => checkAssetComplete(q.teaching_asset_id),
    });
  }, [updateQuestion, checkAssetComplete]);

  const rejectQuestion = useCallback((q: BankedQuestion) => {
    updateQuestion.mutate({ id: q.id, updates: { review_status: "rejected" } });
  }, [updateQuestion]);

  const flagQuestion = useCallback((q: BankedQuestion) => {
    updateQuestion.mutate({ id: q.id, updates: { review_status: "pending", rejection_notes: "Flagged for later review" } });
    toast.info("Flagged for later");
  }, [updateQuestion]);

  /* ── Row expand/collapse ── */
  const toggleRow = useCallback((id: string) => {
    setExpandedRows(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }, []);

  /* ── Selection ── */
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(q => q.id)));
  };

  const bulkApprove = async () => {
    const toApprove = filtered.filter(q => selectedIds.has(q.id));
    for (const q of toApprove) {
      await supabase.from("banked_questions").update({ review_status: "approved" }).eq("id", q.id);
    }
    // Check each unique asset
    const assetIds = new Set(toApprove.map(q => q.teaching_asset_id).filter(Boolean));
    qc.invalidateQueries({ queryKey: ["banked-questions-review"] });
    for (const aid of assetIds) {
      await checkAssetComplete(aid as string);
    }
    setSelectedIds(new Set());
    toast.success(`Approved ${toApprove.length} questions`);
  };

  const bulkReject = async () => {
    const toReject = filtered.filter(q => selectedIds.has(q.id));
    for (const q of toReject) {
      await supabase.from("banked_questions").update({ review_status: "rejected" }).eq("id", q.id);
    }
    const assetIds = new Set(toReject.map(q => q.teaching_asset_id).filter(Boolean));
    qc.invalidateQueries({ queryKey: ["banked-questions-review"] });
    for (const aid of assetIds) {
      await checkAssetComplete(aid as string);
    }
    setSelectedIds(new Set());
    toast.success(`Rejected ${toReject.length} questions`);
  };

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const q = filtered[focusedIdx];
      switch (e.key.toLowerCase()) {
        case "a":
          if (q) { approveQuestion(q); toast.success("Approved"); }
          break;
        case "r":
          if (q) { rejectQuestion(q); toast.success("Rejected"); }
          break;
        case "f":
          if (q) flagQuestion(q);
          break;
        case "j":
        case "arrowdown":
          e.preventDefault();
          setFocusedIdx(i => Math.min(filtered.length - 1, i + 1));
          break;
        case "k":
        case "arrowup":
          e.preventDefault();
          setFocusedIdx(i => Math.max(0, i - 1));
          break;
        case " ":
          e.preventDefault();
          if (q) toggleRow(q.id);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filtered, focusedIdx, approveQuestion, rejectQuestion, flagQuestion, toggleRow]);

  /* ══════════════════════════════════════════
     SECTION 3 — CHAPTER SUMMARY
     ══════════════════════════════════════════ */
  const summaryData = useMemo(() => {
    const map = new Map<string, { asset_name: string; rank: number | null; total: number; approved: number; rejected: number; pending: number; mc_status: string }>();
    // Build from allQuestions
    for (const q of allQuestions) {
      const aid = q.teaching_asset_id || "unknown";
      if (!map.has(aid)) {
        const coreAsset = allCoreAssets.find(a => a.id === aid);
        map.set(aid, {
          asset_name: q.teaching_assets?.asset_name || "Unknown",
          rank: q.teaching_assets?.core_rank ?? null,
          total: 0, approved: 0, rejected: 0, pending: 0,
          mc_status: coreAsset?.mc_status || "unknown",
        });
      }
      const entry = map.get(aid)!;
      entry.total++;
      if (q.review_status === "approved") entry.approved++;
      else if (q.review_status === "rejected") entry.rejected++;
      else entry.pending++;
    }
    return Array.from(map.values()).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  }, [allQuestions, allCoreAssets]);

  const hasCompleteAsset = summaryData.some(s => s.mc_status === "complete");

  /* ── Answer helper ── */
  const getAnswers = (q: BankedQuestion) =>
    [
      { label: "A", text: q.answer_a },
      { label: "B", text: q.answer_b },
      { label: "C", text: q.answer_c },
      { label: "D", text: q.answer_d },
      { label: "E", text: q.answer_e },
    ].filter(a => a.text?.trim());

  /* ══════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════ */
  const noCore = allCoreAssets.length === 0;

  return (
    <SurviveSidebarLayout>
      <div className="space-y-5 pb-12">

        {/* ── EMPTY STATE: No core assets ── */}
        {noCore && !isLoading && (
          <div className="text-center py-20 text-muted-foreground space-y-2">
            <p className="text-base font-medium">No Core Assets selected for this chapter.</p>
            <p className="text-sm">Run Phase 2 Review first to tag core assets.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/phase2-review")}>
              Go to Phase 2 Review <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        )}

        {!noCore && (
          <>
            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
               SECTION 1 — GENERATION QUEUE
               ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {readyForMC.length > 0 ? (
              <div className="rounded-lg border border-border bg-card/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-foreground">Ready to Generate</h2>
                    <Badge variant="outline" className="text-[10px]">{readyForMC.length}</Badge>
                  </div>
                  <Button size="sm" onClick={generateAllMC} disabled={generatingAll}>
                    {generatingAll
                      ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Generating {genProgress.current} of {genProgress.total}…</>
                      : <><Zap className="h-3 w-3 mr-1" /> Generate All Ready</>}
                  </Button>
                </div>

                {/* Compact table */}
                <div className="rounded-md border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/30 text-muted-foreground">
                        <th className="px-3 py-1.5 text-left font-medium">Rank</th>
                        <th className="px-3 py-1.5 text-left font-medium">Asset Code</th>
                        <th className="px-3 py-1.5 text-left font-medium">Textbook Ref</th>
                        <th className="px-3 py-1.5 text-left font-medium">Type</th>
                        <th className="px-3 py-1.5 text-right font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {readyForMC.map(a => (
                        <tr key={a.id} className="border-t border-border/40 hover:bg-muted/10">
                          <td className="px-3 py-2"><RankBadge rank={a.core_rank} /></td>
                          <td className="px-3 py-2 font-mono font-medium text-foreground">{a.asset_name}</td>
                          <td className="px-3 py-2 text-muted-foreground">{a.source_ref || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{a.problem_type || "—"}</td>
                          <td className="px-3 py-2 text-right">
                            {generatingIds.has(a.id) ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary inline-block" />
                            ) : (
                              <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => generateMC(a)}>
                                Generate MC
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : allGenerated ? (
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-500/30 text-xs">
                  <Check className="h-3 w-3 mr-1" /> All generated ✓
                </Badge>
              </div>
            ) : null}

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
               SECTION 2 — QUESTION REVIEW
               ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-foreground">Question Review</h2>
                  <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">{statusCounts.pending} pending</Badge>
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap className={cn("h-3.5 w-3.5", speedMode ? "text-primary" : "text-muted-foreground")} />
                  <Label className="text-[11px] text-muted-foreground cursor-pointer" htmlFor="speed-toggle">Speed</Label>
                  <Switch id="speed-toggle" checked={speedMode} onCheckedChange={toggleSpeed} className="scale-75" />
                </div>
              </div>

              {/* Filter tabs */}
              <div className="flex items-center gap-1">
                {(["pending", "approved", "rejected", "all"] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-[11px] capitalize transition-colors",
                      statusFilter === s
                        ? "bg-primary/20 text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    )}
                  >
                    {s}
                    <span className="ml-1 text-[10px] opacity-60">{statusCounts[s]}</span>
                  </button>
                ))}
              </div>

              {/* Shortcut hints */}
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                {[
                  { key: "A", label: "Approve" },
                  { key: "R", label: "Reject" },
                  { key: "F", label: "Flag" },
                  { key: "↑↓", label: "Navigate" },
                  { key: "Space", label: "Expand" },
                ].map(s => (
                  <span key={s.key} className="flex items-center gap-0.5">
                    <kbd className="px-1 py-0.5 rounded bg-muted text-foreground font-mono text-[9px]">{s.key}</kbd>
                    <span>{s.label}</span>
                  </span>
                ))}
              </div>

              {/* Bulk actions */}
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 rounded-md border border-border bg-card/50 px-3 py-2">
                  <span className="text-xs text-muted-foreground">{selectedIds.size} of {filtered.length} selected</span>
                  <Button size="sm" variant="outline" className="h-7 text-[11px] text-emerald-400 border-emerald-500/40" onClick={bulkApprove}>
                    Approve Selected
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-[11px] text-destructive border-destructive/40" onClick={bulkReject}>
                    Reject Selected
                  </Button>
                </div>
              )}

              {/* Empty states */}
              {!isLoading && allQuestions.length === 0 && allGenerated && (
                <div className="text-center py-16 text-muted-foreground space-y-2">
                  <p className="text-base font-medium">All questions reviewed ✓</p>
                  <p className="text-sm">Head to Quizzes Ready to export.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/quizzes-ready")}>
                    Go to Quizzes Ready <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              )}

              {isLoading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
                </div>
              ) : filtered.length > 0 && (
                /* ── Question table ── */
                <div className="rounded-md border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/30 text-muted-foreground">
                        <th className="px-2 py-1.5 w-8">
                          <Checkbox
                            checked={selectedIds.size === filtered.length && filtered.length > 0}
                            onCheckedChange={toggleSelectAll}
                          />
                        </th>
                        <th className="px-2 py-1.5 text-left font-medium">Asset</th>
                        <th className="px-2 py-1.5 text-left font-medium">Type</th>
                        <th className="px-3 py-1.5 text-left font-medium flex-1">Question</th>
                        <th className="px-2 py-1.5 text-left font-medium">Choices</th>
                        <th className="px-2 py-1.5 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((q, idx) => {
                        const isExpanded = expandedRows.has(q.id);
                        const isFocused = idx === focusedIdx;
                        const answers = getAnswers(q);

                        return (
                          <QuestionRow
                            key={q.id}
                            q={q}
                            idx={idx}
                            isFocused={isFocused}
                            isExpanded={isExpanded}
                            isSelected={selectedIds.has(q.id)}
                            speedMode={speedMode}
                            answers={answers}
                            onToggleExpand={() => toggleRow(q.id)}
                            onToggleSelect={() => toggleSelect(q.id)}
                            onFocus={() => setFocusedIdx(idx)}
                            onApprove={() => { approveQuestion(q); toast.success("Approved"); }}
                            onReject={() => { rejectQuestion(q); toast.success("Rejected"); }}
                            onFlag={() => flagQuestion(q)}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
               SECTION 3 — CHAPTER SUMMARY
               ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {summaryData.length > 0 && (
              <Collapsible open={showSummary} onOpenChange={setShowSummary}>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
                    {showSummary ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    <span className="font-medium">Chapter Summary</span>
                    <span className="text-[10px] opacity-60">({summaryData.length} assets)</span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <div className="rounded-md border border-border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/30 text-muted-foreground">
                          <th className="px-3 py-1.5 text-left font-medium">Asset</th>
                          <th className="px-3 py-1.5 text-left font-medium">Rank</th>
                          <th className="px-3 py-1.5 text-center font-medium">Total</th>
                          <th className="px-3 py-1.5 text-center font-medium">Approved</th>
                          <th className="px-3 py-1.5 text-center font-medium">Rejected</th>
                          <th className="px-3 py-1.5 text-center font-medium">Pending</th>
                          <th className="px-3 py-1.5 text-left font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summaryData.map((s, i) => (
                          <tr key={i} className="border-t border-border/40">
                            <td className="px-3 py-2 font-mono font-medium text-foreground">{s.asset_name}</td>
                            <td className="px-3 py-2"><RankBadge rank={s.rank} /></td>
                            <td className="px-3 py-2 text-center text-foreground">{s.total}</td>
                            <td className="px-3 py-2 text-center text-emerald-400">{s.approved}</td>
                            <td className="px-3 py-2 text-center text-destructive">{s.rejected}</td>
                            <td className="px-3 py-2 text-center text-muted-foreground">{s.pending}</td>
                            <td className="px-3 py-2">
                              <Badge variant="outline" className={cn("text-[10px]",
                                s.mc_status === "complete" ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/30"
                                  : s.mc_status === "in_progress" ? "bg-primary/20 text-primary border-primary/30"
                                    : "bg-muted text-muted-foreground"
                              )}>
                                {s.mc_status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {hasCompleteAsset && (
                    <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => navigate("/quizzes-ready")}>
                      Go to Quizzes Ready <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        )}
      </div>
    </SurviveSidebarLayout>
  );
}

/* ══════════════════════════════════════════
   QuestionRow component
   ══════════════════════════════════════════ */
function QuestionRow({
  q, idx, isFocused, isExpanded, isSelected, speedMode, answers,
  onToggleExpand, onToggleSelect, onFocus, onApprove, onReject, onFlag,
}: {
  q: BankedQuestion;
  idx: number;
  isFocused: boolean;
  isExpanded: boolean;
  isSelected: boolean;
  speedMode: boolean;
  answers: { label: string; text: string }[];
  onToggleExpand: () => void;
  onToggleSelect: () => void;
  onFocus: () => void;
  onApprove: () => void;
  onReject: () => void;
  onFlag: () => void;
}) {
  const rowRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (isFocused && rowRef.current) {
      rowRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [isFocused]);

  const stem = speedMode && !isExpanded
    ? (q.question_text.length > 120 ? q.question_text.slice(0, 120) + "…" : q.question_text)
    : q.question_text;

  return (
    <>
      <tr
        ref={rowRef}
        onClick={() => { onFocus(); onToggleExpand(); }}
        className={cn(
          "border-t border-border/40 cursor-pointer transition-colors",
          isFocused ? "bg-primary/10 ring-1 ring-inset ring-primary/30" : "hover:bg-muted/10",
        )}
      >
        <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
          <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
        </td>
        <td className="px-2 py-2">
          <div className="flex items-center gap-1.5">
            <RankBadge rank={q.teaching_assets?.core_rank ?? null} />
            <span className="font-mono text-[10px] text-foreground/70">{q.teaching_assets?.asset_name || "—"}</span>
          </div>
        </td>
        <td className="px-2 py-2">
          <Badge variant="outline" className="text-[9px]">{q.question_type}</Badge>
        </td>
        <td className="px-3 py-2 text-foreground/80 max-w-[400px]">
          <span className="leading-relaxed">{stem}</span>
        </td>
        <td className="px-2 py-2">
          <button
            onClick={e => { e.stopPropagation(); onFocus(); onToggleExpand(); }}
            className="text-[10px] text-primary hover:underline"
          >
            {isExpanded ? "hide" : `${answers.length} choices`}
          </button>
        </td>
        <td className="px-2 py-2 text-right" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1 justify-end">
            <Button size="sm" variant="outline" className="h-6 w-6 p-0 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10" onClick={onApprove} title="Approve">
              <CheckCircle2 className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="outline" className="h-6 w-6 p-0 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={onReject} title="Reject">
              <XCircle className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="outline" className="h-6 w-6 p-0 text-amber-400 border-amber-500/30 hover:bg-amber-500/10" onClick={onFlag} title="Flag">
              <Flag className="h-3 w-3" />
            </Button>
          </div>
        </td>
      </tr>

      {/* Expanded detail row */}
      {isExpanded && (
        <tr className="bg-card/30">
          <td colSpan={6} className="px-4 py-4">
            <div className="space-y-3 max-w-2xl">
              {/* Full question */}
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{q.question_text}</p>

              {/* Answer choices */}
              <div className="space-y-1.5">
                {answers.map(a => {
                  const isCorrect = q.correct_answer?.toUpperCase().includes(a.label);
                  return (
                    <div key={a.label} className={cn(
                      "rounded-md border px-3 py-2 flex items-start gap-2 text-sm",
                      isCorrect
                        ? "border-emerald-500/40 bg-emerald-500/10"
                        : "border-border bg-background/50"
                    )}>
                      <span className={cn("font-mono font-bold text-xs mt-0.5", isCorrect ? "text-emerald-400" : "text-muted-foreground")}>
                        {a.label}.
                      </span>
                      <span className={cn(isCorrect ? "text-foreground font-medium" : "text-foreground/80")}>{a.text}</span>
                      {isCorrect && <Badge className="ml-auto text-[9px] bg-emerald-600/20 text-emerald-400 border-emerald-500/30 shrink-0">✓ Correct</Badge>}
                    </div>
                  );
                })}
              </div>

              {/* Explanation */}
              {q.short_explanation && (
                <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-0.5">Explanation</p>
                  <p className="text-xs text-foreground/70 leading-relaxed">{q.short_explanation}</p>
                </div>
              )}

              {/* Larger action buttons */}
              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" variant="outline" className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10" onClick={onApprove}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                </Button>
                <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={onReject}>
                  <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                </Button>
                <Button size="sm" variant="outline" className="text-amber-400 border-amber-500/30 hover:bg-amber-500/10" onClick={onFlag}>
                  <Flag className="h-3.5 w-3.5 mr-1" /> Flag
                </Button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
