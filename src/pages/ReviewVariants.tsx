import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SpeedReviewPanel } from "@/components/content-factory/SpeedReviewPanel";
import { VariantReviewContent } from "@/components/content-factory/VariantReviewDrawer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Inbox, Loader2, ChevronRight, Check, Zap } from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";

export default function ReviewVariants() {
  const { workspace } = useActiveWorkspace();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const chapterId = workspace?.chapterId;
  const courseId = workspace?.courseId;

  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewStarted, setReviewStarted] = useState(false);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [speedMode, setSpeedMode] = useState(true);
  const [speedIdx, setSpeedIdx] = useState(0);
  const autoStarted = useRef(false);
  const approveInFlight = useRef(false);

  // Query generated problems for this chapter
  const { data: generatedProblems = [], isLoading: problemsLoading } = useQuery({
    queryKey: ["review-generated-problems", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_problems")
        .select("*")
        .eq("chapter_id", chapterId!)
        .eq("status", "generated")
        .order("source_label", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!chapterId,
  });

  // Auto-start review when generated problems are available
  useEffect(() => {
    if (!autoStarted.current && generatedProblems.length > 0 && !reviewStarted) {
      autoStarted.current = true;
      startReviewSkippingEmpty(0);
    }
  }, [generatedProblems.length]);

  // Reset autoStarted when chapter changes
  useEffect(() => {
    autoStarted.current = false;
    setReviewStarted(false);
    setCandidates([]);
    setReviewIndex(0);
  }, [chapterId]);

  const loadCandidates = async (problemId: string) => {
    setLoading(true);
    setCandidates([]);
    const { data, error } = await supabase
      .from("problem_variants")
      .select("*")
      .eq("base_problem_id", problemId)
      .neq("variant_status", "archived")
      .order("created_at", { ascending: true });
    const mapped = (!error && data) ? data.map((v: any) => {
      const cd = v.candidate_data || {};
      return {
        ...cd,
        _variantId: v.id,
        _variantStatus: v.variant_status || "draft",
        survive_problem_text: cd.survive_problem_text || v.variant_problem_text,
        survive_solution_text: cd.survive_solution_text || v.variant_solution_text,
        journal_entry_completed_json: v.journal_entry_completed_json || cd.je_structured || cd.journal_entry_completed_json || null,
        journal_entry_template_json: v.journal_entry_template_json || cd.journal_entry_template_json || null,
        highlight_key_json: v.highlight_key_json,
        parts_json: v.parts_json,
        confidence_score: v.confidence_score,
        difficulty_estimate: v.difficulty_estimate,
      };
    }) : [];
    setCandidates(mapped);
    setSpeedIdx(0);
    setLoading(false);
    return mapped;
  };

  // Start review, skipping problems that have no active variants
  const startReviewSkippingEmpty = async (startIdx: number) => {
    for (let i = startIdx; i < generatedProblems.length; i++) {
      const { count } = await supabase
        .from("problem_variants")
        .select("id", { count: "exact", head: true })
        .eq("base_problem_id", generatedProblems[i].id)
        .neq("variant_status", "archived");
      if ((count ?? 0) > 0) {
        setReviewStarted(true);
        setReviewIndex(i);
        await loadCandidates(generatedProblems[i].id);
        return;
      }
    }
    // No problems with variants found
    toast.success("All variants reviewed! 🎉");
    navigate("/assets");
  };

  const startReview = async (idx: number) => {
    if (generatedProblems.length === 0) return;
    setReviewStarted(true);
    setReviewIndex(idx);
    await loadCandidates(generatedProblems[idx].id);
  };

  const navigateReview = async (direction: "next" | "prev") => {
    const newIdx = direction === "next" ? reviewIndex + 1 : reviewIndex - 1;
    if (newIdx < 0 || newIdx >= generatedProblems.length) return;
    setReviewIndex(newIdx);
    await loadCandidates(generatedProblems[newIdx].id);
  };

  const approveMutation = useMutation({
    mutationFn: async ({ candidate, problem }: { candidate: any; problem: any }) => {
      // Idempotency: check if this variant is already approved
      const { data: existingVariant } = await supabase
        .from("problem_variants")
        .select("variant_status")
        .eq("id", candidate._variantId)
        .single();
      if (existingVariant?.variant_status === "approved") {
        throw new Error("ALREADY_APPROVED");
      }

      // Generate proper asset code: {COURSE_CODE}_CH{NUM}_P{SEQ}_A
      const { data: courseData } = await supabase
        .from("courses")
        .select("code")
        .eq("id", courseId!)
        .single();
      const { data: chapterData } = await supabase
        .from("chapters")
        .select("chapter_number")
        .eq("id", chapterId!)
        .single();

      // Count existing teaching assets in this chapter for sequential numbering
      const { count } = await supabase
        .from("teaching_assets")
        .select("id", { count: "exact", head: true })
        .eq("chapter_id", chapterId!);

      const courseCode = courseData?.code || "COURSE";
      const chNum = String(chapterData?.chapter_number ?? 0).padStart(2, "0");
      const seqNum = String((count ?? 0) + 1).padStart(3, "0");
      const assetCode = `${courseCode}_CH${chNum}_P${seqNum}_A`;

      // Update variant status FIRST to prevent duplicates
      const { error: vsErr } = await supabase
        .from("problem_variants")
        .update({ variant_status: "approved" } as any)
        .eq("id", candidate._variantId)
        .eq("variant_status", "draft"); // Only approve if still draft
      if (vsErr) throw vsErr;

      // Create teaching asset from variant
      const { data: taData, error: taErr } = await supabase.from("teaching_assets").insert({
        course_id: courseId!,
        chapter_id: chapterId!,
        base_raw_problem_id: problem.id,
        asset_name: assetCode,
        source_ref: problem.source_label || null,
        survive_problem_text: candidate.survive_problem_text || "",
        survive_solution_text: candidate.survive_solution_text || "",
        journal_entry_completed_json: candidate.journal_entry_completed_json,
        journal_entry_template_json: candidate.journal_entry_template_json,
        journal_entry_block: candidate.journal_entry_block || null,
        difficulty: candidate.difficulty_estimate ? (candidate.difficulty_estimate <= 3 ? "easy" : candidate.difficulty_estimate <= 7 ? "medium" : "hard") : null,
        source_type: problem.source_type || null,
        source_number: problem.source_label || null,
        problem_type: problem.problem_type || null,
        tags: [],
      } as any).select("id").single();
      if (taErr) throw taErr;

      // Update source problem pipeline status
      const { error: spErr } = await supabase
        .from("chapter_problems")
        .update({ status: "approved", pipeline_status: "approved" } as any)
        .eq("id", problem.id);
      if (spErr) throw spErr;

      await logActivity({
        actor_type: "user",
        entity_type: "variant",
        entity_id: candidate._variantId,
        event_type: "variant_approved",
        message: `Approved variant ${assetCode} for ${problem.source_label || problem.title}`,
        payload_json: { source_problem_id: problem.id, asset_code: assetCode },
      });

      // Google Sheet creation moved to admin-only batch action in Assets Library
    },
    onSuccess: () => {
      toast.success("Variant approved ✓");
      qc.invalidateQueries({ queryKey: ["review-generated-problems", chapterId] });
      qc.invalidateQueries({ queryKey: ["chapter-problems", chapterId] });
      qc.invalidateQueries({ queryKey: ["teaching-assets"] });
      qc.invalidateQueries({ queryKey: ["pipeline-counts"] });
    },
    onError: (err: any) => {
      if (err.message === "ALREADY_APPROVED") return; // silent skip
      toast.error(`Approve failed: ${err.message}`);
    },
  });

  const handleApprove = async () => {
    // Use ref-based lock to prevent rapid double-fires from keyboard/clicks
    if (approveInFlight.current) return;
    approveInFlight.current = true;

    const activeVariants = candidates.filter(c => c._variantStatus !== "archived");
    const current = activeVariants[speedIdx] || activeVariants[0];
    const problem = generatedProblems[reviewIndex];
    if (!current || !problem) {
      approveInFlight.current = false;
      return;
    }

    try {
      await approveMutation.mutateAsync({ candidate: current, problem });

      // Auto-advance after mutation completes
      if (speedIdx < activeVariants.length - 1) {
        setSpeedIdx(prev => prev + 1);
      } else if (reviewIndex < generatedProblems.length - 1) {
        navigateReview("next");
      } else {
        toast.success("All variants reviewed! 🎉");
        navigate("/assets");
      }
    } catch {
      // error toast already handled by mutation onError
    } finally {
      approveInFlight.current = false;
    }
  };

  const handleRegenerate = async () => {
    const activeVariants = candidates.filter(c => c._variantStatus !== "archived");
    const current = activeVariants[speedIdx];
    if (!current) return;
    const { error } = await supabase
      .from("problem_variants")
      .update({ variant_status: "needs_fix" } as any)
      .eq("id", current._variantId);
    if (error) { toast.error("Failed to flag"); return; }
    toast.success("Flagged for regeneration");
    await loadCandidates(generatedProblems[reviewIndex].id);
    // Auto-advance
    const remaining = candidates.filter(c => c._variantStatus !== "archived" && c._variantId !== current._variantId);
    if (remaining.length === 0 && reviewIndex < generatedProblems.length - 1) {
      navigateReview("next");
    }
  };

  const handleFlag = async () => {
    const activeVariants = candidates.filter(c => c._variantStatus !== "archived");
    const current = activeVariants[speedIdx];
    if (!current) return;
    const { error } = await supabase
      .from("problem_variants")
      .update({ variant_status: "needs_fix" } as any)
      .eq("id", current._variantId);
    if (error) { toast.error("Failed to flag"); return; }
    toast.success("Flagged for deep review");
    await loadCandidates(generatedProblems[reviewIndex].id);
    if (speedIdx < activeVariants.length - 1) {
      setSpeedIdx(prev => prev + 1);
    } else if (reviewIndex < generatedProblems.length - 1) {
      navigateReview("next");
    }
  };

  // ─── Empty states ───
  if (!chapterId || !courseId) {
    return (
      <SurviveSidebarLayout>
        <Card>
          <CardContent className="py-12 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-foreground font-medium">Select a chapter to begin reviewing.</p>
          </CardContent>
        </Card>
      </SurviveSidebarLayout>
    );
  }

  if (problemsLoading) {
    return (
      <SurviveSidebarLayout>
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      </SurviveSidebarLayout>
    );
  }

  if (generatedProblems.length === 0) {
    return (
      <SurviveSidebarLayout>
        <Card>
          <CardContent className="py-12 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-foreground font-medium">No generated variants to review.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Generate variants from imported sources first — they'll appear here for approval.
            </p>
          </CardContent>
        </Card>
      </SurviveSidebarLayout>
    );
  }

  // ─── Not yet started / button to begin ───
  if (!reviewStarted) {
    return (
      <SurviveSidebarLayout>
        <Card>
          <CardContent className="py-8 text-center space-y-4">
            <Badge variant="outline" className="text-xs">
              {generatedProblems.length} {generatedProblems.length === 1 ? "problem" : "problems"} with variants ready
            </Badge>
            <div>
              <Button onClick={() => startReview(0)}>
                <Zap className="h-4 w-4 mr-1" /> Start Review
              </Button>
            </div>
          </CardContent>
        </Card>
      </SurviveSidebarLayout>
    );
  }

  // ─── Active review ───
  const problem = generatedProblems[reviewIndex];
  const activeVariants = candidates.filter(c => c._variantStatus !== "archived");
  const currentVariant = activeVariants[speedIdx] || activeVariants[0];

  return (
    <SurviveSidebarLayout>
      <div className="space-y-3">
        {/* ── Nav bar ── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] font-mono">
              {problem?.source_label || problem?.title || `Problem ${reviewIndex + 1}`}
            </Badge>
            <span className="text-xs text-foreground/70 font-medium">
              {reviewIndex + 1} / {generatedProblems.length}
            </span>
            <Button size="sm" variant="outline" disabled={reviewIndex === 0} onClick={() => navigateReview("prev")} className="h-7 px-2">
              <ChevronRight className="h-3 w-3 rotate-180" />
            </Button>
            <Button size="sm" variant="outline" disabled={reviewIndex >= generatedProblems.length - 1} onClick={() => navigateReview("next")} className="h-7 px-2">
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Switch checked={speedMode} onCheckedChange={setSpeedMode} className="h-5 w-9" />
              <span className="text-[10px] text-muted-foreground font-medium">
                {speedMode ? "Speed" : "Full"}
              </span>
            </div>
            <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setReviewStarted(false); setCandidates([]); }}>
              <Check className="h-3 w-3 mr-1" /> Done
            </Button>
          </div>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading variants…
          </div>
        ) : activeVariants.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center">
              <p className="text-sm text-muted-foreground">No active variants for this problem.</p>
              {reviewIndex < generatedProblems.length - 1 && (
                <Button size="sm" variant="outline" className="mt-3" onClick={() => navigateReview("next")}>
                  Next Problem <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              )}
            </CardContent>
          </Card>
        ) : speedMode && currentVariant ? (
          <SpeedReviewPanel
            variant={currentVariant}
            problem={problem}
            variantIndex={speedIdx}
            totalVariants={activeVariants.length}
            isApproving={approveMutation.isPending}
            onApprove={handleApprove}
            onReject={handleRegenerate}
            onRegenerate={handleRegenerate}
            onFlagForDeepReview={handleFlag}
            onNext={() => {
              if (speedIdx < activeVariants.length - 1) {
                setSpeedIdx(prev => prev + 1);
              } else if (reviewIndex < generatedProblems.length - 1) {
                navigateReview("next");
              }
            }}
            onBack={speedIdx > 0 ? () => setSpeedIdx(prev => prev - 1) : reviewIndex > 0 ? () => navigateReview("prev") : undefined}
            onOpenFullReview={() => setSpeedMode(false)}
          />
        ) : currentVariant ? (
          <VariantReviewContent
            variant={currentVariant}
            problem={problem}
            chapterId={chapterId}
            onApproved={handleApprove}
            onRejected={handleRegenerate}
            onNeedsFix={handleFlag}
            onApproveAndNext={handleApprove}
          />
        ) : null}
      </div>
    </SurviveSidebarLayout>
  );
}
