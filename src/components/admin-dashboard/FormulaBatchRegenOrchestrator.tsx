import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FlaskConical, Check, Loader2, Pause, Play, AlertTriangle, X, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Constants ────────────────────────────────────────────────────

const STORAGE_KEY = "sa_formula_regen_progress";
const BATCH_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// ── Types ────────────────────────────────────────────────────────

type ChapterRecord = {
  id: string;
  chapter_number: number;
  chapter_name: string;
  course_id: string;
  courseCode: string;
};

type ChapterResult = {
  chapterId: string;
  chapterName: string;
  status: "success" | "failed";
  formulaCount?: number;
  error?: string;
};

type BatchProgress = {
  completedIds: string[];
  results: ChapterResult[];
  startedAt: string;
  timestamp: string;
};

// ── Helpers ──────────────────────────────────────────────────────

function clearProgress() {
  localStorage.removeItem(STORAGE_KEY);
}

function loadProgress(): BatchProgress | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BatchProgress;
    if (!parsed.timestamp || new Date(parsed.timestamp).getTime() + BATCH_MAX_AGE_MS < Date.now()) {
      clearProgress();
      return null;
    }
    return parsed;
  } catch {
    clearProgress();
    return null;
  }
}

function saveProgress(p: BatchProgress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

function isSkipped(ch: ChapterRecord) {
  const name = ch.chapter_name.trim().toLowerCase();
  return (
    (ch.chapter_number === 1 && name === "accounting in business") ||
    (ch.chapter_number === 2 && name === "journalizing transactions")
  );
}

// ── Component ────────────────────────────────────────────────────

export function FormulaBatchRegenOrchestrator() {
  const qc = useQueryClient();
  const pauseRef = useRef(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [currentName, setCurrentName] = useState("");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [results, setResults] = useState<ChapterResult[]>([]);
  const [savedProgress, setSavedProgress] = useState<BatchProgress | null>(loadProgress);

  // Fetch chapters
  const { data: chapters } = useQuery({
    queryKey: ["formula-regen-chapters"],
    queryFn: async () => {
      const { data } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name, course_id, courses!chapters_course_id_fkey(code)")
        .order("course_id")
        .order("chapter_number");

      return ((data || []) as any[]).map((ch) => ({
        id: ch.id,
        chapter_number: ch.chapter_number,
        chapter_name: ch.chapter_name,
        course_id: ch.course_id,
        courseCode: ch.courses?.code || "UNK",
      })) as ChapterRecord[];
    },
  });

  // Approved counts for summary
  const { data: approvedCounts } = useQuery({
    queryKey: ["formula-regen-approved-counts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("chapter_formulas")
        .select("chapter_id, is_approved");
      let approved = 0;
      (data || []).forEach((r: any) => { if (r.is_approved) approved += 1; });
      return approved;
    },
  });

  const getEligible = useCallback((skipIds: string[] = []) => {
    if (!chapters) return [];
    return chapters.filter((ch) => {
      if (isSkipped(ch)) return false;
      if (skipIds.includes(ch.id)) return false;
      return true;
    });
  }, [chapters]);

  const processChapter = useCallback(async (ch: ChapterRecord): Promise<ChapterResult> => {
    const label = `${ch.courseCode} — Ch ${ch.chapter_number}: ${ch.chapter_name}`;
    try {
      // 1. Delete unapproved formulas
      const { error: delErr } = await supabase
        .from("chapter_formulas")
        .delete()
        .eq("chapter_id", ch.id)
        .eq("is_approved", false);

      if (delErr) throw delErr;

      // 2. Generate new formulas
      const { data, error } = await supabase.functions.invoke("generate-chapter-formulas", {
        body: { chapterId: ch.id },
      });

      if (error) throw error;

      // Count generated
      const count = data?.count ?? data?.formulas?.length ?? 0;

      return { chapterId: ch.id, chapterName: label, status: "success", formulaCount: count };
    } catch (err: any) {
      return { chapterId: ch.id, chapterName: label, status: "failed", error: err?.message || "Unknown error" };
    }
  }, []);

  const runBatch = useCallback(async (resume?: BatchProgress) => {
    setRunning(true);
    setPaused(false);
    setFinished(false);
    pauseRef.current = false;

    const alreadyDone = resume?.completedIds || [];
    const prior = resume?.results || [];
    const eligible = getEligible(alreadyDone);

    setResults(prior);
    setTotalCount(alreadyDone.length + eligible.length);
    setCurrentIdx(alreadyDone.length);

    const progress: BatchProgress = {
      completedIds: [...alreadyDone],
      results: [...prior],
      startedAt: resume?.startedAt || new Date().toISOString(),
      timestamp: new Date().toISOString(),
    };

    for (let i = 0; i < eligible.length; i++) {
      if (pauseRef.current) {
        saveProgress(progress);
        setSavedProgress(progress);
        setRunning(false);
        toast.info("Formula regeneration paused.");
        return;
      }

      const ch = eligible[i];
      setCurrentIdx(alreadyDone.length + i);
      setCurrentName(`${ch.courseCode} — Ch ${ch.chapter_number}: ${ch.chapter_name}`);

      const result = await processChapter(ch);
      progress.results = [...progress.results.filter((r) => r.chapterId !== ch.id), result];

      if (result.status === "success") {
        progress.completedIds.push(ch.id);
      }

      progress.timestamp = new Date().toISOString();
      setResults([...progress.results]);
      saveProgress(progress);
      setSavedProgress(progress);
    }

    setRunning(false);
    setPaused(false);
    setFinished(true);
    setCurrentName("");
    clearProgress();
    setSavedProgress(null);
    qc.invalidateQueries({ queryKey: ["cqa-formulas"] });
    qc.invalidateQueries({ queryKey: ["formula-regen-approved-counts"] });
    toast.success("Formula regeneration complete!");
  }, [getEligible, processChapter, qc]);

  const handlePause = () => { pauseRef.current = true; setPaused(true); };

  const handleResume = () => {
    const p = loadProgress();
    if (!p) { setSavedProgress(null); toast.error("No saved progress found."); return; }
    runBatch(p);
  };

  const handleStartFresh = () => {
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    setConfirmOpen(false);
    clearProgress();
    setSavedProgress(null);
    setResults([]);
    setFinished(false);
    setCurrentName("");
    runBatch();
  };

  const retryChapter = useCallback(async (chapterId: string) => {
    const ch = chapters?.find((c) => c.id === chapterId);
    if (!ch) return;
    const label = `${ch.courseCode} — Ch ${ch.chapter_number}: ${ch.chapter_name}`;
    setResults((prev) => prev.map((r) => r.chapterId === chapterId ? { ...r, status: "success" as const, error: undefined } : r));

    const result = await processChapter(ch);
    setResults((prev) => prev.map((r) => r.chapterId === chapterId ? result : r));
    if (result.status === "success") {
      toast.success(`${label} — regenerated successfully.`);
    } else {
      toast.error(`${label} — still failed.`);
    }
  }, [chapters, processChapter]);

  const successResults = results.filter((r) => r.status === "success");
  const failedResults = results.filter((r) => r.status === "failed");
  const totalNewFormulas = successResults.reduce((s, r) => s + (r.formulaCount || 0), 0);
  const eligibleCount = getEligible().length;

  return (
    <>
      {/* Confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Regenerate All Unapproved Formulas?
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed pt-2">
              This will <strong>delete and regenerate all UNAPPROVED</strong> formula rows across all chapters.
              <br /><br />
              <span className="text-emerald-500 font-medium">Approved formulas are safe and will not be touched.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirm}>Yes, regenerate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <FlaskConical className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold text-foreground">Regenerate Unapproved Formulas</span>
              {!running && !savedProgress && (
                <Badge variant="secondary" className="text-[10px]">
                  {eligibleCount} chapters
                </Badge>
              )}
              {(approvedCounts ?? 0) > 0 && (
                <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
                  {approvedCounts} approved formulas preserved
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              {!running && !savedProgress && (
                <Button size="sm" variant="outline" onClick={handleStartFresh} disabled={eligibleCount === 0}>
                  <FlaskConical className="h-3.5 w-3.5 mr-1" />
                  Regenerate All Unapproved Formulas
                </Button>
              )}

              {!running && !!savedProgress && (
                <>
                  <Button size="sm" onClick={handleResume}>
                    <Play className="h-3.5 w-3.5 mr-1" />
                    Resume previous run? ({savedProgress.completedIds.length} done)
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleStartFresh}>
                    <X className="h-3.5 w-3.5 mr-1" />
                    Start Fresh
                  </Button>
                </>
              )}

              {running && !paused && (
                <Button size="sm" variant="outline" onClick={handlePause}>
                  <Pause className="h-3.5 w-3.5 mr-1" />
                  Pause After This Chapter
                </Button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {running && currentName && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
                Regenerating formulas — Ch {currentIdx + 1} of {totalCount} — {currentName}… ⟳
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div
                  className="bg-amber-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${totalCount ? ((currentIdx + 1) / totalCount) * 100 : 0}%` }}
                />
              </div>
              {paused && (
                <Badge variant="secondary" className="text-[10px] animate-pulse">
                  Pausing after current chapter…
                </Badge>
              )}
            </div>
          )}

          {/* Per-chapter results (scrollable during / after run) */}
          {results.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {results.map((r) => (
                <div
                  key={r.chapterId}
                  className={cn(
                    "flex items-center gap-2 text-[11px] px-2 py-1 rounded border",
                    r.status === "success"
                      ? "bg-emerald-500/5 border-emerald-500/20"
                      : "bg-destructive/5 border-destructive/20",
                  )}
                >
                  {r.status === "success" ? (
                    <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                  ) : (
                    <X className="h-3 w-3 text-destructive shrink-0" />
                  )}
                  <span className="font-medium">{r.chapterName}</span>
                  {r.status === "success" && r.formulaCount != null && (
                    <span className="text-muted-foreground">— {r.formulaCount} formulas generated</span>
                  )}
                  {r.status === "failed" && (
                    <>
                      <span className="text-muted-foreground truncate">{r.error}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 px-1.5 text-[10px] ml-auto shrink-0"
                        onClick={() => retryChapter(r.chapterId)}
                      >
                        <RotateCcw className="h-3 w-3 mr-0.5" /> Retry
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Summary card after finish */}
          {finished && !running && results.length > 0 && (
            <div className="rounded-md border border-border bg-background p-3 space-y-1 text-xs">
              <p className="text-emerald-500">
                <Check className="h-3 w-3 inline mr-1" />
                {successResults.length} chapters regenerated
              </p>
              <p className="text-emerald-500">
                <Check className="h-3 w-3 inline mr-1" />
                {totalNewFormulas} total new formulas generated
              </p>
              <p className="text-emerald-500">
                <Check className="h-3 w-3 inline mr-1" />
                {approvedCounts ?? 0} approved formulas preserved — untouched
              </p>
              {failedResults.length > 0 && (
                <p className="text-destructive">
                  <X className="h-3 w-3 inline mr-1" />
                  {failedResults.length} failed
                </p>
              )}
            </div>
          )}

          <p className="text-[10px] text-muted-foreground">
            Deletes unapproved formulas per chapter and regenerates via AI. Approved formulas are never touched. Skips Ch 1–2 from Intro 1.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
