import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { saveAs } from "file-saver";
import {
  Download, Loader2, CheckCircle2, ClipboardCopy, Check,
} from "lucide-react";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { cn } from "@/lib/utils";

/* ── Types ── */
type BankedQ = {
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
  survive_problem_text: string;
  problem_context: string | null;
  lw_html_added: boolean;
  lw_csv_exported_at: string | null;
};

/* ── CSV helpers ── */
function escapeCSV(val: string): string {
  if (!val) return "";
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

function letterToNumber(letter: string): string {
  const map: Record<string, string> = { A: "1", B: "2", C: "3", D: "4", E: "5" };
  const upper = (letter || "").trim().toUpperCase();
  // Handle "A", "B", etc.
  if (map[upper]) return map[upper];
  // Handle "1", "2", etc.
  if (/^\d+$/.test(upper)) return upper;
  // Try to extract letter from strings like "Answer A"
  for (const [k, v] of Object.entries(map)) {
    if (upper.includes(k)) return v;
  }
  return "1";
}

function getQuestionLWType(questionType: string): string {
  const upper = questionType.toUpperCase();
  if (upper === "TRUE_FALSE" || upper === "TF" || upper === "TTF") return "TTF";
  return "TMC";
}

function buildLWCSV(questions: BankedQ[], assetNameMap: Map<string, string>): string {
  const header = "Group,Type,Question,CorAns,Answer1,Answer2,Answer3,Answer4,Answer5,Answer6,Answer7,Answer8,Answer9,Answer10,CorrectExplanation,IncorrectExplanation";

  const rows = questions.map(q => {
    const group = assetNameMap.get(q.teaching_asset_id || "") || "UNKNOWN";
    const type = getQuestionLWType(q.question_type);
    const corAns = letterToNumber(q.correct_answer);

    return [
      group,
      type,
      q.question_text,
      corAns,
      q.answer_a || "",
      q.answer_b || "",
      q.answer_c || "",
      q.answer_d || "",
      q.answer_e || "",
      "", "", "", "", "",
      q.short_explanation || "",
      (q as any).incorrect_explanation || "Not quite! Review the problem scenario and try again. Each answer choice reflects a common approach — make sure you're recording the correct accounts, amounts, and debits/credits.",
    ].map(escapeCSV).join(",");
  });

  return header + "\n" + rows.join("\n");
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
  const qc = useQueryClient();
  const { workspace } = useActiveWorkspace();
  const [activeTab, setActiveTab] = useState("csv-export");

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

  /* ── Fetch core assets with mc questions ── */
  const { data: coreAssets = [], isLoading: loadingA } = useQuery<AssetInfo[]>({
    queryKey: ["quiz-ready-assets", workspace?.chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teaching_assets")
        .select("id, asset_name, source_ref, core_rank, mc_status, course_id, survive_problem_text, problem_context, lw_html_added, lw_csv_exported_at")
        .eq("chapter_id", workspace!.chapterId)
        .eq("phase2_status", "core_asset")
        .in("mc_status", ["in_progress", "complete"])
        .order("core_rank", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AssetInfo[];
    },
    enabled: !!workspace?.chapterId,
  });

  /* ── Fetch all banked questions for this chapter ── */
  const { data: allBankedQuestions = [], isLoading: loadingQ } = useQuery({
    queryKey: ["quiz-all-banked", workspace?.chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banked_questions")
        .select(`
          id, teaching_asset_id, question_type, question_text,
          answer_a, answer_b, answer_c, answer_d, answer_e,
          correct_answer, short_explanation, difficulty, review_status,
          teaching_assets!inner ( chapter_id )
        `)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as any[]).filter(q => q.teaching_assets?.chapter_id === workspace!.chapterId) as BankedQ[];
    },
    enabled: !!workspace?.chapterId,
  });

  /* ── Fetch problem_instructions for HTML checklist ── */
  const assetIds = useMemo(() => coreAssets.map(a => a.id), [coreAssets]);
  const { data: problemInstructions = [] } = useQuery({
    queryKey: ["quiz-problem-instructions", assetIds],
    queryFn: async () => {
      if (assetIds.length === 0) return [];
      const { data, error } = await supabase
        .from("problem_instructions")
        .select("teaching_asset_id, instruction_number, instruction_text")
        .in("teaching_asset_id", assetIds)
        .order("instruction_number", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: assetIds.length > 0,
  });

  const isLoading = loadingA || loadingQ;

  const assetNameMap = useMemo(() => new Map(coreAssets.map(a => [a.id, a.asset_name])), [coreAssets]);

  /* ── Per-asset question counts ── */
  const assetRows = useMemo(() => {
    return coreAssets
      .filter(a => allBankedQuestions.some(q => q.teaching_asset_id === a.id))
      .map(a => {
        const qs = allBankedQuestions.filter(q => q.teaching_asset_id === a.id);
        return {
          ...a,
          approvedCount: qs.filter(q => q.review_status === "approved").length,
          pendingCount: qs.filter(q => q.review_status === "pending").length,
          rejectedCount: qs.filter(q => q.review_status === "rejected").length,
          approvedQuestions: qs.filter(q => q.review_status === "approved"),
        };
      });
  }, [coreAssets, allBankedQuestions]);

  const approvedQuestions = useMemo(
    () => allBankedQuestions.filter(q => q.review_status === "approved"),
    [allBankedQuestions]
  );

  /* ── Export timestamp update helper ── */
  const markExported = useCallback(async (ids: string[]) => {
    const now = new Date().toISOString();
    for (const id of ids) {
      await supabase.from("teaching_assets").update({ lw_csv_exported_at: now } as any).eq("id", id);
    }
    qc.invalidateQueries({ queryKey: ["quiz-ready-assets"] });
  }, [qc]);

  /* ── Export handlers ── */
  const exportAssetCSV = useCallback(async (assetId: string) => {
    const assetQuestions = approvedQuestions.filter(q => q.teaching_asset_id === assetId);
    if (assetQuestions.length === 0) { toast.error("No approved questions"); return; }

    const csv = buildLWCSV(assetQuestions, assetNameMap);
    const assetName = assetNameMap.get(assetId) || "asset";
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `${courseCode}-Ch${String(chapterNum).padStart(2, "0")}-${assetName}-questions-${date}.csv`);

    await markExported([assetId]);
    toast.success(`Downloaded ${assetQuestions.length} questions`);
  }, [approvedQuestions, courseCode, chapterNum, assetNameMap, markExported]);

  const exportAllCSV = useCallback(async () => {
    if (approvedQuestions.length === 0) { toast.error("No approved questions"); return; }

    const csv = buildLWCSV(approvedQuestions, assetNameMap);
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `${courseCode}-Ch${String(chapterNum).padStart(2, "0")}-questions-${date}.csv`);

    const exportedIds = [...new Set(approvedQuestions.map(q => q.teaching_asset_id).filter(Boolean))] as string[];
    await markExported(exportedIds);
    toast.success(`Downloaded ${approvedQuestions.length} questions`);
  }, [approvedQuestions, courseCode, chapterNum, assetNameMap, markExported]);

  /* ── HTML copy helpers ── */
  const copyScenarioHTML = useCallback((asset: AssetInfo) => {
    const html = `<div style="background:#f8f9fa;border-left:4px solid #0066cc;padding:16px;margin-bottom:16px;border-radius:4px;font-family:Arial,sans-serif;font-size:14px;line-height:1.6"><strong>Problem Scenario</strong><br><br>${asset.problem_context || ""}<br><br>${asset.survive_problem_text || ""}</div>`;
    navigator.clipboard.writeText(html);
    toast.success("Scenario HTML copied!");
  }, []);

  const copyProblemHTML = useCallback((assetId: string) => {
    const instructions = problemInstructions
      .filter(pi => pi.teaching_asset_id === assetId)
      .sort((a, b) => a.instruction_number - b.instruction_number);

    const listItems = instructions.length > 0
      ? `<ol>${instructions.map(i => `<li>${i.instruction_text}</li>`).join("")}</ol>`
      : "<p>No instructions found.</p>";

    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;padding:8px"><strong>Required:</strong><br>${listItems}</div>`;
    navigator.clipboard.writeText(html);
    toast.success("Problem HTML copied!");
  }, [problemInstructions]);

  /* ── HTML checkbox toggle ── */
  const toggleHtmlAdded = useCallback(async (assetId: string, value: boolean) => {
    await supabase.from("teaching_assets").update({ lw_html_added: value } as any).eq("id", assetId);
    qc.invalidateQueries({ queryKey: ["quiz-ready-assets"] });
  }, [qc]);

  const markAllHtmlComplete = useCallback(async () => {
    const ids = assetRows.filter(a => a.approvedCount > 0).map(a => a.id);
    for (const id of ids) {
      await supabase.from("teaching_assets").update({ lw_html_added: true } as any).eq("id", id);
    }
    qc.invalidateQueries({ queryKey: ["quiz-ready-assets"] });
    toast.success(`Marked ${ids.length} assets as HTML complete`);
  }, [assetRows, qc]);

  /* ── HTML checklist progress ── */
  const htmlAddedCount = assetRows.filter(a => a.lw_html_added && a.approvedCount > 0).length;
  const htmlTotalCount = assetRows.filter(a => a.approvedCount > 0).length;
  const htmlPercent = htmlTotalCount > 0 ? Math.round((htmlAddedCount / htmlTotalCount) * 100) : 0;

  const totalApproved = approvedQuestions.length;

  /* ══════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════ */
  return (
    <SurviveSidebarLayout>
      <div className="space-y-5 pb-12">

        {/* ── HEADER ── */}
        <div>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Quizzes Ready
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Export approved MC questions as LearnWorlds-compatible CSV files.
          </p>
        </div>

        {/* ── EMPTY STATE ── */}
        {!isLoading && totalApproved === 0 && assetRows.length === 0 && (
          <div className="text-center py-20 text-muted-foreground space-y-2">
            <p className="text-base font-medium">No approved questions yet</p>
            <p className="text-sm">Review MC questions first, then come back to export.</p>
          </div>
        )}

        {(isLoading || totalApproved > 0 || assetRows.length > 0) && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start">
              <TabsTrigger value="csv-export">CSV Export</TabsTrigger>
              <TabsTrigger value="html-checklist">HTML Checklist</TabsTrigger>
            </TabsList>

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
               TAB 1 — CSV EXPORT
               ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            <TabsContent value="csv-export" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {totalApproved} approved question{totalApproved !== 1 ? "s" : ""} across {assetRows.length} asset{assetRows.length !== 1 ? "s" : ""}
                </p>
                <Button size="sm" onClick={exportAllCSV} disabled={isLoading || totalApproved === 0}>
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Export All Approved
                </Button>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
                </div>
              ) : (
                <div className="rounded-md border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/30 text-muted-foreground">
                        <th className="px-3 py-2 text-left font-medium">Rank</th>
                        <th className="px-3 py-2 text-left font-medium">Asset Code</th>
                        <th className="px-3 py-2 text-left font-medium">Textbook Ref</th>
                        <th className="px-3 py-2 text-center font-medium">Approved</th>
                        <th className="px-3 py-2 text-center font-medium">Pending</th>
                        <th className="px-3 py-2 text-center font-medium">Rejected</th>
                        <th className="px-3 py-2 text-center font-medium">CSV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assetRows.map(a => (
                        <tr key={a.id} className="border-t border-border/40 hover:bg-muted/10">
                          <td className="px-3 py-2.5"><RankBadge rank={a.core_rank} /></td>
                          <td className="px-3 py-2.5 font-mono font-medium text-foreground">{a.asset_name}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{a.source_ref || "—"}</td>
                          <td className="px-3 py-2.5 text-center text-emerald-400 font-medium">{a.approvedCount}</td>
                          <td className="px-3 py-2.5 text-center text-muted-foreground">{a.pendingCount}</td>
                          <td className="px-3 py-2.5 text-center text-muted-foreground">{a.rejectedCount}</td>
                          <td className="px-3 py-2.5 text-center">
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => exportAssetCSV(a.id)} disabled={a.approvedCount === 0} title="Download CSV">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
               TAB 2 — HTML CHECKLIST
               ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            <TabsContent value="html-checklist" className="space-y-4 mt-4">
              {/* Progress summary */}
              <div className="rounded-lg border border-border bg-card/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {htmlAddedCount} of {htmlTotalCount} assets have HTML added in LearnWorlds
                    </p>
                    <Progress value={htmlPercent} className="h-2 mt-2 w-64" />
                  </div>
                  <Button size="sm" variant="outline" onClick={markAllHtmlComplete} disabled={htmlAddedCount === htmlTotalCount}>
                    <Check className="h-3.5 w-3.5 mr-1.5" /> Mark All Complete
                  </Button>
                </div>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
                </div>
              ) : (
                <div className="rounded-md border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/30 text-muted-foreground">
                        <th className="px-3 py-2 text-left font-medium">Rank</th>
                        <th className="px-3 py-2 text-left font-medium">Asset Code</th>
                        <th className="px-3 py-2 text-center font-medium">Approved</th>
                        <th className="px-3 py-2 text-center font-medium">Copy Scenario</th>
                        <th className="px-3 py-2 text-center font-medium">Copy Problem</th>
                        <th className="px-3 py-2 text-center font-medium">HTML Added</th>
                        <th className="px-3 py-2 text-left font-medium">Exported</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assetRows.filter(a => a.approvedCount > 0).map(a => (
                        <tr key={a.id} className="border-t border-border/40 hover:bg-muted/10">
                          <td className="px-3 py-2.5"><RankBadge rank={a.core_rank} /></td>
                          <td className="px-3 py-2.5 font-mono font-medium text-foreground">{a.asset_name}</td>
                          <td className="px-3 py-2.5 text-center text-emerald-400 font-medium">{a.approvedCount}</td>
                          <td className="px-3 py-2.5 text-center">
                            <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => copyScenarioHTML(a)}>
                              <ClipboardCopy className="h-3 w-3 mr-1" /> Scenario
                            </Button>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => copyProblemHTML(a.id)}>
                              <ClipboardCopy className="h-3 w-3 mr-1" /> Problem
                            </Button>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <Checkbox
                              checked={a.lw_html_added || false}
                              onCheckedChange={(checked) => toggleHtmlAdded(a.id, !!checked)}
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            {a.lw_csv_exported_at ? (
                              <Badge variant="outline" className="text-[9px] bg-emerald-600/10 text-emerald-400 border-emerald-500/30">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                {new Date(a.lw_csv_exported_at).toLocaleDateString()}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </SurviveSidebarLayout>
  );
}
