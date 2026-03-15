import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { saveAs } from "file-saver";
import {
  Download, Eye, EyeOff, ArrowRight, Loader2, CheckCircle2,
} from "lucide-react";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { cn } from "@/lib/utils";

/* ── Types ── */
type ApprovedQuestion = {
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
  review_status: string;
};

type AssetInfo = {
  id: string;
  asset_name: string;
  source_ref: string | null;
  core_rank: number | null;
  mc_status: string;
  course_id: string;
};

/* ── CSV helpers (matching existing QuestionBankExport format) ── */
function escapeCSV(val: string): string {
  if (!val) return "";
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

function padChapter(n: number): string {
  return String(n).padStart(2, "0");
}

function buildGroup(courseCode: string, chapterNum: number, questionType: string): string {
  return `${courseCode}_CH${padChapter(chapterNum)}_${questionType}`;
}

function buildCSV(
  questions: ApprovedQuestion[],
  courseCode: string,
  chapterNum: number,
  assetNameMap: Map<string, string>,
): string {
  const header = "Group,Question Text,Answer 1,Answer 2,Answer 3,Answer 4,Answer 5,Correct Answer,Explanation";
  const seqCounters: Record<string, number> = {};

  const rows = questions.map(q => {
    const assetName = assetNameMap.get(q.teaching_asset_id || "") || "UNKNOWN";
    const seqKey = `${q.teaching_asset_id}_${q.question_type}`;
    seqCounters[seqKey] = (seqCounters[seqKey] || 0) + 1;
    const seq = seqCounters[seqKey];

    const group = buildGroup(courseCode, chapterNum, q.question_type);
    const qId = `[${courseCode}_CH${padChapter(chapterNum)}_${assetName}_${q.question_type}_${String(seq).padStart(2, "0")}]`;
    const questionText = `${qId}\n\n${q.question_text}`;

    return [
      group,
      questionText,
      q.answer_a,
      q.answer_b,
      q.answer_c,
      q.answer_d,
      q.answer_e,
      q.correct_answer,
      q.short_explanation || "Walkthrough video coming soon.",
    ].map(escapeCSV).join(",");
  });

  return header + "\n" + rows.join("\n");
}

/* ── localStorage key for export timestamps ── */
function getExportKey(chapterId: string) {
  return `quiz-export-${chapterId}`;
}

function getExportTimestamps(chapterId: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(getExportKey(chapterId)) || "{}");
  } catch { return {}; }
}

function setExportTimestamp(chapterId: string, assetId: string | "all") {
  const existing = getExportTimestamps(chapterId);
  existing[assetId] = new Date().toISOString();
  localStorage.setItem(getExportKey(chapterId), JSON.stringify(existing));
}

/* ── Rank badge ── */
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
export default function QuizzesReady() {
  const navigate = useNavigate();
  const { workspace } = useActiveWorkspace();
  const [previewAssetId, setPreviewAssetId] = useState<string | null>(null);
  const [exportTimestamps, setExportTimestampsState] = useState<Record<string, string>>(() =>
    workspace?.chapterId ? getExportTimestamps(workspace.chapterId) : {}
  );

  /* ── Fetch approved questions for this chapter ── */
  const { data: approvedQuestions = [], isLoading: loadingQ } = useQuery({
    queryKey: ["quiz-ready-questions", workspace?.chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banked_questions")
        .select(`
          id, teaching_asset_id, question_type, question_text,
          answer_a, answer_b, answer_c, answer_d, answer_e,
          correct_answer, short_explanation, difficulty, review_status,
          teaching_assets!inner ( chapter_id )
        `)
        .eq("review_status", "approved")
        .order("created_at", { ascending: true });
      if (error) throw error;
      // Filter to workspace chapter
      return (data as any[]).filter(q => q.teaching_assets?.chapter_id === workspace!.chapterId) as ApprovedQuestion[];
    },
    enabled: !!workspace?.chapterId,
  });

  /* ── Fetch all questions (for rejected counts) ── */
  const { data: allQuestions = [] } = useQuery({
    queryKey: ["quiz-all-questions", workspace?.chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banked_questions")
        .select(`
          id, teaching_asset_id, review_status,
          teaching_assets!inner ( chapter_id )
        `)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as any[]).filter(q => q.teaching_assets?.chapter_id === workspace!.chapterId);
    },
    enabled: !!workspace?.chapterId,
  });

  /* ── Fetch core assets with mc questions ── */
  const { data: coreAssets = [], isLoading: loadingA } = useQuery<AssetInfo[]>({
    queryKey: ["quiz-ready-assets", workspace?.chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teaching_assets")
        .select("id, asset_name, source_ref, core_rank, mc_status, course_id")
        .eq("chapter_id", workspace!.chapterId)
        .eq("phase2_status", "core_asset")
        .order("core_rank", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AssetInfo[];
    },
    enabled: !!workspace?.chapterId,
  });

  /* ── Fetch chapter + course info ── */
  const { data: chapterInfo } = useQuery({
    queryKey: ["quiz-chapter-info", workspace?.chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("chapter_number, chapter_name, course_id, courses ( code )")
        .eq("id", workspace!.chapterId)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!workspace?.chapterId,
  });

  const courseCode = chapterInfo?.courses?.code || "COURSE";
  const chapterNum = chapterInfo?.chapter_number || 0;

  /* ── Build per-asset summary ── */
  const assetRows = useMemo(() => {
    const assetNameMap = new Map(coreAssets.map(a => [a.id, a.asset_name]));

    return coreAssets
      .filter(a => {
        // Show if has any questions at all
        return allQuestions.some(q => q.teaching_asset_id === a.id);
      })
      .map(a => {
        const approved = approvedQuestions.filter(q => q.teaching_asset_id === a.id);
        const rejected = allQuestions.filter(q => q.teaching_asset_id === a.id && q.review_status === "rejected");
        return {
          ...a,
          approvedCount: approved.length,
          rejectedCount: rejected.length,
          questions: approved,
        };
      });
  }, [coreAssets, approvedQuestions, allQuestions]);

  const assetNameMap = useMemo(() => new Map(coreAssets.map(a => [a.id, a.asset_name])), [coreAssets]);

  const totalApproved = approvedQuestions.length;
  const totalAssets = assetRows.length;

  /* ── Export handlers ── */
  const exportAssetCSV = useCallback((assetId: string) => {
    const assetQuestions = approvedQuestions.filter(q => q.teaching_asset_id === assetId);
    if (assetQuestions.length === 0) { toast.error("No approved questions"); return; }

    const csv = buildCSV(assetQuestions, courseCode, chapterNum, assetNameMap);
    const assetName = assetNameMap.get(assetId) || "asset";
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `${courseCode}-Ch${padChapter(chapterNum)}-${assetName}-quiz-${date}.csv`);

    setExportTimestamp(workspace!.chapterId, assetId);
    setExportTimestampsState(getExportTimestamps(workspace!.chapterId));
    toast.success(`Downloaded ${assetQuestions.length} questions`);
  }, [approvedQuestions, courseCode, chapterNum, assetNameMap, workspace]);

  const exportAllCSV = useCallback(() => {
    if (approvedQuestions.length === 0) { toast.error("No approved questions"); return; }

    const csv = buildCSV(approvedQuestions, courseCode, chapterNum, assetNameMap);
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `${courseCode}-Ch${padChapter(chapterNum)}-quiz-${date}.csv`);

    setExportTimestamp(workspace!.chapterId, "all");
    setExportTimestampsState(getExportTimestamps(workspace!.chapterId));
    toast.success(`Downloaded ${approvedQuestions.length} questions`);
  }, [approvedQuestions, courseCode, chapterNum, assetNameMap, workspace]);

  /* ── Answer helper ── */
  const getAnswers = (q: ApprovedQuestion) =>
    [
      { label: "A", text: q.answer_a },
      { label: "B", text: q.answer_b },
      { label: "C", text: q.answer_c },
      { label: "D", text: q.answer_d },
      { label: "E", text: q.answer_e },
    ].filter(a => a.text?.trim());

  const isLoading = loadingQ || loadingA;

  /* ══════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════ */

  return (
    <SurviveSidebarLayout>
      <div className="space-y-5 pb-12">

        {/* ── EMPTY STATE ── */}
        {!isLoading && totalApproved === 0 && (
          <div className="text-center py-20 text-muted-foreground space-y-2">
            <p className="text-base font-medium">No approved questions yet</p>
            <p className="text-sm">Review MC questions first, then come back to export.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/question-review")}>
              Go to Question Review <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        )}

        {(isLoading || totalApproved > 0) && (
          <>
            {/* ── HEADER ── */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Download className="h-5 w-5 text-primary" />
                  Quizzes Ready
                </h1>
                {!isLoading && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {totalApproved} question{totalApproved !== 1 ? "s" : ""} approved across {totalAssets} asset{totalAssets !== 1 ? "s" : ""} in this chapter
                  </p>
                )}
              </div>
              <Button size="sm" onClick={exportAllCSV} disabled={isLoading || totalApproved === 0}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> Export All to CSV
              </Button>
            </div>

            {/* Export all timestamp */}
            {exportTimestamps["all"] && (
              <Badge variant="outline" className="text-[10px] bg-emerald-600/10 text-emerald-400 border-emerald-500/30">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Last exported {new Date(exportTimestamps["all"]).toLocaleDateString()}
              </Badge>
            )}

            {/* ── LOADING ── */}
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
              </div>
            ) : (
              /* ── ASSET TABLE ── */
              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/30 text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Rank</th>
                      <th className="px-3 py-2 text-left font-medium">Asset Code</th>
                      <th className="px-3 py-2 text-left font-medium">Textbook Ref</th>
                      <th className="px-3 py-2 text-center font-medium">Approved</th>
                      <th className="px-3 py-2 text-center font-medium">Rejected</th>
                      <th className="px-3 py-2 text-center font-medium">CSV</th>
                      <th className="px-3 py-2 text-center font-medium">Preview</th>
                      <th className="px-3 py-2 text-left font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {assetRows.map(a => {
                      const isPreviewing = previewAssetId === a.id;
                      const exported = exportTimestamps[a.id];

                      return (
                        <AssetRow
                          key={a.id}
                          asset={a}
                          isPreviewing={isPreviewing}
                          exported={exported}
                          onTogglePreview={() => setPreviewAssetId(isPreviewing ? null : a.id)}
                          onExport={() => exportAssetCSV(a.id)}
                          getAnswers={getAnswers}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </SurviveSidebarLayout>
  );
}

/* ══════════════════════════════════════════
   AssetRow component
   ══════════════════════════════════════════ */
function AssetRow({
  asset, isPreviewing, exported, onTogglePreview, onExport, getAnswers,
}: {
  asset: { id: string; asset_name: string; source_ref: string | null; core_rank: number | null; approvedCount: number; rejectedCount: number; questions: ApprovedQuestion[] };
  isPreviewing: boolean;
  exported: string | undefined;
  onTogglePreview: () => void;
  onExport: () => void;
  getAnswers: (q: ApprovedQuestion) => { label: string; text: string }[];
}) {
  return (
    <>
      <tr className="border-t border-border/40 hover:bg-muted/10">
        <td className="px-3 py-2.5"><RankBadge rank={asset.core_rank} /></td>
        <td className="px-3 py-2.5 font-mono font-medium text-foreground">{asset.asset_name}</td>
        <td className="px-3 py-2.5 text-muted-foreground">{asset.source_ref || "—"}</td>
        <td className="px-3 py-2.5 text-center text-emerald-400 font-medium">{asset.approvedCount}</td>
        <td className="px-3 py-2.5 text-center text-muted-foreground">{asset.rejectedCount}</td>
        <td className="px-3 py-2.5 text-center">
          <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={onExport} disabled={asset.approvedCount === 0} title="Download CSV">
            <Download className="h-3.5 w-3.5" />
          </Button>
        </td>
        <td className="px-3 py-2.5 text-center">
          <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={onTogglePreview} disabled={asset.approvedCount === 0} title="Preview questions">
            {isPreviewing ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
        </td>
        <td className="px-3 py-2.5">
          {exported && (
            <Badge variant="outline" className="text-[9px] bg-emerald-600/10 text-emerald-400 border-emerald-500/30">
              Exported {new Date(exported).toLocaleDateString()}
            </Badge>
          )}
        </td>
      </tr>

      {/* Preview rows */}
      {isPreviewing && asset.questions.map(q => {
        const answers = getAnswers(q);
        return (
          <tr key={q.id} className="bg-card/30">
            <td colSpan={8} className="px-6 py-3">
              <div className="max-w-2xl space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px]">{q.question_type}</Badge>
                  <span className="text-[10px] text-muted-foreground">Difficulty {q.difficulty}/10</span>
                </div>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{q.question_text}</p>
                <div className="space-y-1">
                  {answers.map(a => {
                    const isCorrect = q.correct_answer?.toUpperCase().includes(a.label);
                    return (
                      <div key={a.label} className={cn(
                        "rounded-md border px-3 py-1.5 flex items-start gap-2 text-xs",
                        isCorrect
                          ? "border-emerald-500/40 bg-emerald-500/10"
                          : "border-border bg-background/50"
                      )}>
                        <span className={cn("font-mono font-bold", isCorrect ? "text-emerald-400" : "text-muted-foreground")}>
                          {a.label}.
                        </span>
                        <span className={cn(isCorrect ? "text-foreground font-medium" : "text-foreground/80")}>{a.text}</span>
                        {isCorrect && <Badge className="ml-auto text-[8px] bg-emerald-600/20 text-emerald-400 border-emerald-500/30">✓</Badge>}
                      </div>
                    );
                  })}
                </div>
                {q.short_explanation && (
                  <p className="text-[11px] text-muted-foreground italic">{q.short_explanation}</p>
                )}
              </div>
            </td>
          </tr>
        );
      })}
    </>
  );
}
