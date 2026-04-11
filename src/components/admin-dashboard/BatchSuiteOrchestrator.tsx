/**
 * BatchSuiteOrchestrator — Client-side polling loop for generating
 * the full content suite across all chapters, one type at a time.
 * 
 * Instead of calling run-content-suite-batch (which times out),
 * we call generate-chapter-content-suite directly with `only: type`
 * for each content type, keeping each call short (~15s).
 */
import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Layers, Pause, Play, RotateCcw, Check, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "sa_batch_progress";
const CONTENT_TYPES = ["purpose", "key_terms", "exam_mistakes", "accounts", "formulas", "journal_entries"];
const CONTENT_LABELS: Record<string, string> = {
  purpose: "Purpose",
  key_terms: "Key Terms",
  exam_mistakes: "Mistakes",
  accounts: "Accounts",
  formulas: "Formulas",
  journal_entries: "JEs",
};

const INTER_CALL_DELAY_MS = 1500;

// Hardcoded skip list
const SKIP_CHAPTERS: { courseCode: string; chapterNumber: number }[] = [
  { courseCode: "ACCY201", chapterNumber: 1 },
  { courseCode: "ACCY201", chapterNumber: 2 },
];

type ChapterResult = {
  chapterId: string;
  chapterName: string;
  status: "success" | "partial" | "failed" | "skipped";
  completedTypes: string[];
  failedTypes: { type: string; error: string }[];
};

type BatchProgress = {
  completedChapterIds: string[];
  results: ChapterResult[];
  startedAt: string;
};

function loadProgress(): BatchProgress | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function saveProgress(progress: BatchProgress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function clearProgress() {
  localStorage.removeItem(STORAGE_KEY);
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function BatchSuiteOrchestrator() {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const pauseRef = useRef(false);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [totalChapters, setTotalChapters] = useState(0);
  const [currentChapterName, setCurrentChapterName] = useState("");
  const [currentType, setCurrentType] = useState("");
  const [completedTypesInCurrent, setCompletedTypesInCurrent] = useState<string[]>([]);
  const [results, setResults] = useState<ChapterResult[]>([]);
  const [finished, setFinished] = useState(false);
  const [savedProgress, setSavedProgress] = useState<BatchProgress | null>(loadProgress);

  // Fetch all chapters with course info
  const { data: allChapters } = useQuery({
    queryKey: ["batch-suite-chapters"],
    queryFn: async () => {
      const { data: chapters } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name, course_id")
        .order("chapter_number");
      const { data: courses } = await supabase
        .from("courses")
        .select("id, code");
      const courseMap = Object.fromEntries((courses || []).map(c => [c.id, c.code]));
      return (chapters || []).map(ch => ({
        ...ch,
        courseCode: courseMap[ch.course_id] || "UNK",
      }));
    },
  });

  // Check which chapters already have data in all 6 content tables (skip populated)
  const { data: populationStatus } = useQuery({
    queryKey: ["batch-suite-population-status"],
    queryFn: async () => {
      const [
        { data: purposes },
        { data: accounts },
        { data: terms },
        { data: formulas },
        { data: jes },
        { data: mistakes },
      ] = await Promise.all([
        supabase.from("chapter_purpose").select("chapter_id"),
        supabase.from("chapter_accounts").select("chapter_id"),
        supabase.from("chapter_key_terms").select("chapter_id"),
        supabase.from("chapter_formulas").select("chapter_id"),
        supabase.from("chapter_journal_entries").select("chapter_id"),
        supabase.from("chapter_exam_mistakes").select("chapter_id"),
      ]);

      const toSet = (rows: any[] | null) =>
        new Set((rows || []).map(r => r.chapter_id));

      return {
        purposes: toSet(purposes),
        accounts: toSet(accounts),
        terms: toSet(terms),
        formulas: toSet(formulas),
        jes: toSet(jes),
        mistakes: toSet(mistakes),
      };
    },
  });

  const isFullyPopulated = useCallback((chapterId: string) => {
    if (!populationStatus) return false;
    const { purposes, accounts, terms, formulas, jes, mistakes } = populationStatus;
    return (
      purposes.has(chapterId) &&
      accounts.has(chapterId) &&
      terms.has(chapterId) &&
      formulas.has(chapterId) &&
      jes.has(chapterId) &&
      mistakes.has(chapterId)
    );
  }, [populationStatus]);

  const getEligibleChapters = useCallback((skipCompleted: string[] = []) => {
    if (!allChapters) return [];
    return allChapters.filter(ch => {
      if (SKIP_CHAPTERS.some(s => s.courseCode === ch.courseCode && s.chapterNumber === ch.chapter_number)) {
        return false;
      }
      if (skipCompleted.includes(ch.id)) return false;
      if (isFullyPopulated(ch.id)) return false;
      return true;
    });
  }, [allChapters, isFullyPopulated]);

  /**
   * Process a single chapter by calling generate-chapter-content-suite
   * once per content type from the CLIENT side (avoids edge function timeout).
   */
  const processChapter = async (chapterId: string, chapterName: string, courseCode: string): Promise<ChapterResult> => {
    const completedTypes: string[] = [];
    const failedTypes: { type: string; error: string }[] = [];

    for (let i = 0; i < CONTENT_TYPES.length; i++) {
      const contentType = CONTENT_TYPES[i];
      setCurrentType(CONTENT_LABELS[contentType]);

      // Delay between calls (not before first)
      if (i > 0) await delay(INTER_CALL_DELAY_MS);

      try {
        const { data, error } = await supabase.functions.invoke("generate-chapter-content-suite", {
          body: {
            chapterId,
            chapterName,
            courseCode,
            only: contentType,
          },
        });

        if (error) throw error;
        if (data?.errors?.length) throw new Error(data.errors.join("; "));

        completedTypes.push(contentType);
        setCompletedTypesInCurrent(prev => [...prev, contentType]);
      } catch (err: any) {
        failedTypes.push({ type: contentType, error: err?.message || "Unknown error" });
      }
    }

    setCurrentType("");

    return {
      chapterId,
      chapterName,
      status: failedTypes.length === 0 ? "success" : completedTypes.length > 0 ? "partial" : "failed",
      completedTypes,
      failedTypes,
    };
  };

  const runBatch = useCallback(async (resumeFrom?: BatchProgress) => {
    setRunning(true);
    setPaused(false);
    pauseRef.current = false;
    setFinished(false);

    const alreadyDone = resumeFrom?.completedChapterIds || [];
    const priorResults = resumeFrom?.results || [];
    setResults(priorResults);

    const eligible = getEligibleChapters(alreadyDone);
    setTotalChapters(alreadyDone.length + eligible.length);
    setCurrentChapterIndex(alreadyDone.length);

    // Need course info for chapter calls
    const { data: courses } = await supabase.from("courses").select("id, code");
    const courseMap = Object.fromEntries((courses || []).map(c => [c.id, c.code]));

    const progress: BatchProgress = {
      completedChapterIds: [...alreadyDone],
      results: [...priorResults],
      startedAt: resumeFrom?.startedAt || new Date().toISOString(),
    };

    for (let i = 0; i < eligible.length; i++) {
      if (pauseRef.current) {
        saveProgress(progress);
        setSavedProgress(progress);
        setRunning(false);
        toast.info("Batch paused. Click Resume to continue.");
        return;
      }

      const ch = eligible[i];
      const globalIdx = alreadyDone.length + i;
      setCurrentChapterIndex(globalIdx);
      setCurrentChapterName(`Ch ${ch.chapter_number} — ${ch.chapter_name}`);
      setCompletedTypesInCurrent([]);

      const courseCode = courseMap[ch.course_id] || "UNK";
      const result = await processChapter(ch.id, ch.chapter_name, courseCode);
      result.chapterName = `Ch ${ch.chapter_number} — ${ch.chapter_name}`;

      progress.completedChapterIds.push(ch.id);
      progress.results.push(result);
      setResults([...progress.results]);
      saveProgress(progress);
    }

    setFinished(true);
    setRunning(false);
    setCurrentChapterName("");
    clearProgress();
    setSavedProgress(null);
    qc.invalidateQueries({ queryKey: ["cqa-je-counts"] });
    qc.invalidateQueries({ queryKey: ["cqa-formula-counts"] });
    toast.success("Batch suite generation complete!");
  }, [getEligibleChapters, qc]);

  const handlePause = () => {
    pauseRef.current = true;
    setPaused(true);
  };

  const handleResume = () => {
    const progress = loadProgress();
    if (progress) {
      runBatch(progress);
    }
  };

  const handleRetryFailed = async () => {
    const failedChapters = results.filter(r => r.status === "failed" || r.status === "partial");
    if (!failedChapters.length) return;

    setRunning(true);
    setFinished(false);
    setPaused(false);
    pauseRef.current = false;

    const { data: courses } = await supabase.from("courses").select("id, code");
    const courseMap = Object.fromEntries((courses || []).map(c => [c.id, c.code]));

    // Find chapter details for retries
    const { data: chapters } = await supabase
      .from("chapters")
      .select("id, chapter_number, chapter_name, course_id")
      .in("id", failedChapters.map(f => f.chapterId));
    const chapterMap = Object.fromEntries((chapters || []).map(c => [c.id, c]));

    const retryResults: ChapterResult[] = results.filter(r => r.status === "success" || r.status === "skipped");
    setResults([...retryResults]);
    setTotalChapters(failedChapters.length);

    for (let i = 0; i < failedChapters.length; i++) {
      if (pauseRef.current) break;

      const ch = failedChapters[i];
      const chData = chapterMap[ch.chapterId];
      setCurrentChapterIndex(i);
      setCurrentChapterName(ch.chapterName);
      setCompletedTypesInCurrent([]);

      const courseCode = chData ? courseMap[chData.course_id] || "UNK" : "UNK";
      const chapterName = chData?.chapter_name || ch.chapterName;
      const result = await processChapter(ch.chapterId, chapterName, courseCode);
      result.chapterName = ch.chapterName;

      retryResults.push(result);
      setResults([...retryResults]);
    }

    setFinished(true);
    setRunning(false);
    toast.success("Retry complete!");
  };

  const handleClearAndReset = () => {
    clearProgress();
    setSavedProgress(null);
    setResults([]);
    setFinished(false);
    setRunning(false);
    setCurrentChapterName("");
  };

  const successCount = results.filter(r => r.status === "success").length;
  const partialCount = results.filter(r => r.status === "partial").length;
  const failedCount = results.filter(r => r.status === "failed").length;

  const eligibleCount = getEligibleChapters().length;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Full Suite Batch Generator</span>
            {!running && !finished && (
              <Badge variant="secondary" className="text-[10px]">
                {eligibleCount} chapters eligible
              </Badge>
            )}
          </div>

          <div className="flex gap-2">
            {!running && !finished && !savedProgress && (
              <Button
                size="sm"
                onClick={() => runBatch()}
                disabled={eligibleCount === 0}
              >
                <Layers className="h-3.5 w-3.5 mr-1" />
                Generate All — {eligibleCount} Chapters
              </Button>
            )}

            {!running && savedProgress && (
              <>
                <Button size="sm" onClick={handleResume}>
                  <Play className="h-3.5 w-3.5 mr-1" />
                  Resume ({savedProgress.completedChapterIds.length} done)
                </Button>
                <Button size="sm" variant="outline" onClick={handleClearAndReset}>
                  <X className="h-3.5 w-3.5 mr-1" />
                  Clear
                </Button>
              </>
            )}

            {running && !paused && (
              <Button size="sm" variant="outline" onClick={handlePause}>
                <Pause className="h-3.5 w-3.5 mr-1" />
                Pause After This Chapter
              </Button>
            )}

            {running && paused && (
              <Badge variant="secondary" className="text-xs animate-pulse">
                Pausing after current chapter...
              </Badge>
            )}
          </div>
        </div>

        {/* Live progress */}
        {running && currentChapterName && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span className="text-xs font-medium">
                Processing {currentChapterIndex + 1} of {totalChapters} — {currentChapterName}
              </span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {CONTENT_TYPES.map(type => {
                const isDone = completedTypesInCurrent.includes(type);
                const isCurrent = currentType === CONTENT_LABELS[type];
                return (
                  <Badge
                    key={type}
                    variant="secondary"
                    className={cn(
                      "text-[10px] transition-colors",
                      isDone && "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
                      isCurrent && "bg-primary/20 text-primary animate-pulse border-primary/30",
                    )}
                  >
                    {isDone ? "✓" : isCurrent ? "⟳" : "○"} {CONTENT_LABELS[type]}
                  </Badge>
                );
              })}
            </div>
            {/* Progress bar */}
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className="bg-primary h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${((currentChapterIndex + 1) / totalChapters) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Summary */}
        {(finished || results.length > 0) && !running && (
          <div className="space-y-2">
            <div className="flex gap-3 text-xs">
              {successCount > 0 && (
                <span className="text-emerald-400">
                  <Check className="h-3 w-3 inline mr-0.5" />
                  {successCount} complete
                </span>
              )}
              {partialCount > 0 && (
                <span className="text-amber-400">
                  <AlertTriangle className="h-3 w-3 inline mr-0.5" />
                  {partialCount} partial
                </span>
              )}
              {failedCount > 0 && (
                <span className="text-destructive">
                  <X className="h-3 w-3 inline mr-0.5" />
                  {failedCount} failed
                </span>
              )}
            </div>

            {/* Failed chapter list */}
            {(failedCount > 0 || partialCount > 0) && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {results
                  .filter(r => r.status === "failed" || r.status === "partial")
                  .map(r => (
                    <div key={r.chapterId} className="flex items-center gap-2 text-[11px] px-2 py-1 rounded bg-destructive/5 border border-destructive/20">
                      <X className="h-3 w-3 text-destructive shrink-0" />
                      <span className="font-medium">{r.chapterName}</span>
                      <span className="text-muted-foreground truncate">
                        {r.failedTypes.map(f => `${f.type}: ${f.error.slice(0, 60)}`).join("; ")}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            {finished && (failedCount > 0 || partialCount > 0) && (
              <Button size="sm" variant="outline" onClick={handleRetryFailed}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Retry {failedCount + partialCount} Failed Chapters
              </Button>
            )}

            {finished && failedCount === 0 && partialCount === 0 && (
              <p className="text-xs text-emerald-400">✓ All chapters generated successfully!</p>
            )}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground">
          Processes one chapter at a time, one content type per call (no timeout risk). 1.5s delay between AI calls.
          Skips chapters with all content types approved. ACCY201 Ch1–2 excluded.
        </p>
      </CardContent>
    </Card>
  );
}
