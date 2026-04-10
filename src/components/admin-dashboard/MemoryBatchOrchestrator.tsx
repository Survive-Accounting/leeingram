/**
 * MemoryBatchOrchestrator — Client-side polling loop that calls
 * run-memory-items-batch for each chapter, one at a time.
 */
import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Brain, Pause, Play, RotateCcw, Check, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "sa_memory_batch_progress";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const SKIP_CHAPTERS: { courseCode: string; chapterNumber: number }[] = [
  { courseCode: "ACCY201", chapterNumber: 1 },
  { courseCode: "ACCY201", chapterNumber: 2 },
];

type ChResult = {
  chapterId: string;
  chapterName: string;
  status: "success" | "skipped" | "failed";
  itemsGenerated: number;
  error?: string;
};

type BatchProgress = {
  completedIds: string[];
  results: ChResult[];
  timestamp: string;
  lastCompletedChapterId: string | null;
};

function loadProgress(): BatchProgress | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as BatchProgress;
    if (Date.now() - new Date(p.timestamp).getTime() > MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return p;
  } catch { return null; }
}

function saveProgress(p: BatchProgress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

function clearProgress() {
  localStorage.removeItem(STORAGE_KEY);
}

export function MemoryBatchOrchestrator() {
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const pauseRef = useRef(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [currentName, setCurrentName] = useState("");
  const [results, setResults] = useState<ChResult[]>([]);
  const [finished, setFinished] = useState(false);
  const [savedProgress, setSavedProgress] = useState<BatchProgress | null>(loadProgress);

  const { data: allChapters } = useQuery({
    queryKey: ["memory-batch-chapters"],
    queryFn: async () => {
      const { data: chapters } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name, course_id")
        .order("course_id")
        .order("chapter_number");
      const { data: courses } = await supabase.from("courses").select("id, code");
      const courseMap = Object.fromEntries((courses || []).map(c => [c.id, c.code]));
      return (chapters || []).map(ch => ({ ...ch, courseCode: courseMap[ch.course_id] || "UNK" }));
    },
  });

  // Check which chapters already have approved memory items
  const { data: approvedMemoryChapterIds } = useQuery({
    queryKey: ["memory-batch-approved"],
    queryFn: async () => {
      const { data } = await supabase
        .from("chapter_memory_items")
        .select("chapter_id")
        .eq("is_approved", true);
      return [...new Set((data || []).map((r: any) => r.chapter_id))];
    },
  });

  const getEligible = useCallback((skipIds: string[] = []) => {
    if (!allChapters) return [];
    return allChapters.filter(ch => {
      if (SKIP_CHAPTERS.some(s => s.courseCode === ch.courseCode && s.chapterNumber === ch.chapter_number)) return false;
      if (skipIds.includes(ch.id)) return false;
      if (approvedMemoryChapterIds?.includes(ch.id)) return false;
      return true;
    });
  }, [allChapters, approvedMemoryChapterIds]);

  const eligibleCount = getEligible().length;

  const runBatch = useCallback(async (resume?: BatchProgress) => {
    setRunning(true);
    setPaused(false);
    pauseRef.current = false;
    setFinished(false);

    const alreadyDone = resume?.completedIds || [];
    const priorResults = resume?.results || [];
    setResults(priorResults);

    const eligible = getEligible(alreadyDone);
    setTotalCount(alreadyDone.length + eligible.length);
    setCurrentIdx(alreadyDone.length);

    const progress: BatchProgress = {
      completedIds: [...alreadyDone],
      results: [...priorResults],
      timestamp: resume?.timestamp || new Date().toISOString(),
      lastCompletedChapterId: resume?.lastCompletedChapterId || null,
    };

    for (let i = 0; i < eligible.length; i++) {
      if (pauseRef.current) {
        saveProgress(progress);
        setSavedProgress(progress);
        setRunning(false);
        toast.info(`Paused — ${progress.completedIds.length} of ${alreadyDone.length + eligible.length} complete`);
        return;
      }

      const ch = eligible[i];
      const globalIdx = alreadyDone.length + i;
      setCurrentIdx(globalIdx);
      setCurrentName(`Ch ${ch.chapter_number} — ${ch.chapter_name}`);

      let result: ChResult;
      try {
        const { data, error } = await supabase.functions.invoke("run-memory-items-batch", {
          body: { chapterId: ch.id },
        });
        if (error) throw error;

        result = {
          chapterId: ch.id,
          chapterName: `Ch ${ch.chapter_number} — ${ch.chapter_name}`,
          status: data?.skipped ? "skipped" : "success",
          itemsGenerated: data?.itemsGenerated || 0,
        };
      } catch (err: any) {
        result = {
          chapterId: ch.id,
          chapterName: `Ch ${ch.chapter_number} — ${ch.chapter_name}`,
          status: "failed",
          itemsGenerated: 0,
          error: err?.message || "Unknown error",
        };
      }

      progress.completedIds.push(ch.id);
      progress.results.push(result);
      progress.lastCompletedChapterId = ch.id;
      setResults([...progress.results]);
      saveProgress(progress);
    }

    setFinished(true);
    setRunning(false);
    setCurrentName("");
    clearProgress();
    setSavedProgress(null);
    toast.success("Memory items batch complete!");
  }, [getEligible]);

  const handlePause = () => { pauseRef.current = true; setPaused(true); };
  const handleResume = () => { const p = loadProgress(); if (p) runBatch(p); };
  const handleClear = () => { clearProgress(); setSavedProgress(null); setResults([]); setFinished(false); };

  const handleRetryOne = async (chapterId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("run-memory-items-batch", {
        body: { chapterId },
      });
      if (error) throw error;
      setResults(prev => prev.map(r =>
        r.chapterId === chapterId
          ? { ...r, status: data?.skipped ? "skipped" : "success", itemsGenerated: data?.itemsGenerated || 0, error: undefined }
          : r
      ));
      toast.success("Retry successful");
    } catch (err: any) {
      toast.error(err?.message || "Retry failed");
    }
  };

  const successCount = results.filter(r => r.status === "success").length;
  const skippedCount = results.filter(r => r.status === "skipped").length;
  const failedCount = results.filter(r => r.status === "failed").length;

  return (
    <Card className="border-purple-500/30 bg-purple-500/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-400" />
            <span className="text-sm font-semibold">Memory Items Batch Generator</span>
            {!running && !finished && (
              <Badge variant="secondary" className="text-[10px]">
                {eligibleCount} chapters eligible
              </Badge>
            )}
          </div>

          <div className="flex gap-2">
            {!running && !finished && !savedProgress && (
              <Button size="sm" onClick={() => runBatch()} disabled={eligibleCount === 0}>
                <Brain className="h-3.5 w-3.5 mr-1" />
                Generate Memory Items — All Chapters
              </Button>
            )}

            {!running && savedProgress && (
              <>
                <Button size="sm" onClick={handleResume}>
                  <Play className="h-3.5 w-3.5 mr-1" />
                  Resume ({savedProgress.completedIds.length} done)
                </Button>
                <Button size="sm" variant="outline" onClick={handleClear}>
                  Start Fresh
                </Button>
              </>
            )}

            {running && !paused && (
              <Button size="sm" variant="outline" onClick={handlePause}>
                <Pause className="h-3.5 w-3.5 mr-1" />
                Pause
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
        {running && currentName && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-400" />
              <span className="text-xs font-medium">
                Processing Ch {currentIdx + 1} of {totalCount} — {currentName}... ⟳ Memory Items
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className="bg-purple-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${((currentIdx + 1) / totalCount) * 100}%` }}
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
                  {successCount} generated
                </span>
              )}
              {skippedCount > 0 && (
                <span className="text-muted-foreground">
                  ⏭ {skippedCount} skipped
                </span>
              )}
              {failedCount > 0 && (
                <span className="text-destructive">
                  <X className="h-3 w-3 inline mr-0.5" />
                  {failedCount} failed
                </span>
              )}
            </div>

            {failedCount > 0 && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {results
                  .filter(r => r.status === "failed")
                  .map(r => (
                    <div key={r.chapterId} className="flex items-center gap-2 text-[11px] px-2 py-1 rounded bg-destructive/5 border border-destructive/20">
                      <X className="h-3 w-3 text-destructive shrink-0" />
                      <span className="font-medium">{r.chapterName}</span>
                      <span className="text-muted-foreground truncate">{r.error?.slice(0, 80)}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-5 text-[9px] px-2 ml-auto shrink-0"
                        onClick={() => handleRetryOne(r.chapterId)}
                      >
                        <RotateCcw className="h-2.5 w-2.5 mr-0.5" />
                        Retry
                      </Button>
                    </div>
                  ))}
              </div>
            )}

            {finished && failedCount === 0 && (
              <p className="text-xs text-emerald-400">✓ All chapters processed!</p>
            )}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground">
          Calls run-memory-items-batch per chapter. Skips chapters with approved memory items. ACCY201 Ch1–2 excluded.
        </p>
      </CardContent>
    </Card>
  );
}
