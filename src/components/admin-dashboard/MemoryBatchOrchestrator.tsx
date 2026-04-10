import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Check, Loader2, Pause, Play, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "sa_memory_batch_progress";
const BATCH_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const INTER_CALL_DELAY_MS = 1500;

type ChapterRecord = {
  id: string;
  chapter_number: number;
  chapter_name: string;
  course_id: string;
  courseCode: string;
  courseName: string;
};

type MemoryCountMap = Record<string, { total: number; approved: number }>;

type ChapterBatchResult = {
  chapterId: string;
  chapterName: string;
  status: "success" | "failed";
  error?: string;
};

type MemoryBatchProgress = {
  completedChapterIds: string[];
  results: ChapterBatchResult[];
  startedAt: string;
  expiresAt: string;
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clearProgress() {
  localStorage.removeItem(STORAGE_KEY);
}

function loadProgress(): MemoryBatchProgress | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MemoryBatchProgress;
    if (!parsed.expiresAt || new Date(parsed.expiresAt).getTime() < Date.now()) {
      clearProgress();
      return null;
    }
    return parsed;
  } catch {
    clearProgress();
    return null;
  }
}

function saveProgress(progress: MemoryBatchProgress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function isSkippedMemoryChapter(chapter: ChapterRecord) {
  const name = chapter.chapter_name.trim().toLowerCase();
  return (
    (chapter.chapter_number === 1 && name === "accounting in business") ||
    (chapter.chapter_number === 2 && name === "journalizing transactions")
  );
}

export function MemoryBatchOrchestrator() {
  const qc = useQueryClient();
  const pauseRef = useRef(false);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [currentChapterName, setCurrentChapterName] = useState("");
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [totalChapters, setTotalChapters] = useState(0);
  const [results, setResults] = useState<ChapterBatchResult[]>([]);
  const [savedProgress, setSavedProgress] = useState<MemoryBatchProgress | null>(loadProgress);

  const { data: chapters } = useQuery({
    queryKey: ["memory-batch-chapters"],
    queryFn: async () => {
      const { data } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name, course_id, courses!chapters_course_id_fkey(code, course_name)")
        .order("course_id")
        .order("chapter_number");

      return ((data || []) as any[]).map((chapter) => ({
        id: chapter.id,
        chapter_number: chapter.chapter_number,
        chapter_name: chapter.chapter_name,
        course_id: chapter.course_id,
        courseCode: chapter.courses?.code || "UNK",
        courseName: chapter.courses?.course_name || "Unknown Course",
      })) as ChapterRecord[];
    },
  });

  const { data: memoryCounts } = useQuery({
    queryKey: ["cqa-memory-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("chapter_memory_items").select("chapter_id, is_approved");
      const byChapter: MemoryCountMap = {};
      (data || []).forEach((row: any) => {
        if (!row.chapter_id) return;
        if (!byChapter[row.chapter_id]) byChapter[row.chapter_id] = { total: 0, approved: 0 };
        byChapter[row.chapter_id].total += 1;
        if (row.is_approved) byChapter[row.chapter_id].approved += 1;
      });
      return byChapter;
    },
  });

  const getEligibleChapters = useCallback((skipCompletedIds: string[] = []) => {
    if (!chapters) return [];
    return chapters.filter((chapter) => {
      if (isSkippedMemoryChapter(chapter)) return false;
      if (skipCompletedIds.includes(chapter.id)) return false;
      if ((memoryCounts?.[chapter.id]?.total || 0) > 0) return false;
      return true;
    });
  }, [chapters, memoryCounts]);

  const processChapter = useCallback(async (chapter: ChapterRecord): Promise<ChapterBatchResult> => {
    try {
      const { data, error } = await supabase.functions.invoke("generate-chapter-content-suite", {
        body: {
          chapterId: chapter.id,
          chapterName: chapter.chapter_name,
          courseCode: chapter.courseCode,
          only: "memory_items",
        },
      });

      if (error) throw error;
      if (data?.errors?.length) throw new Error(data.errors.join("; "));

      return {
        chapterId: chapter.id,
        chapterName: `${chapter.courseCode} — Ch ${chapter.chapter_number}: ${chapter.chapter_name}`,
        status: "success",
      };
    } catch (err: any) {
      return {
        chapterId: chapter.id,
        chapterName: `${chapter.courseCode} — Ch ${chapter.chapter_number}: ${chapter.chapter_name}`,
        status: "failed",
        error: err?.message || "Unknown error",
      };
    }
  }, []);

  const runBatch = useCallback(async (resumeFrom?: MemoryBatchProgress) => {
    setRunning(true);
    setPaused(false);
    setFinished(false);
    pauseRef.current = false;

    const alreadyDone = resumeFrom?.completedChapterIds || [];
    const priorResults = resumeFrom?.results || [];
    const eligible = getEligibleChapters(alreadyDone);

    setResults(priorResults);
    setTotalChapters(alreadyDone.length + eligible.length);
    setCurrentChapterIndex(alreadyDone.length);

    const progress: MemoryBatchProgress = {
      completedChapterIds: [...alreadyDone],
      results: [...priorResults],
      startedAt: resumeFrom?.startedAt || new Date().toISOString(),
      expiresAt: new Date(Date.now() + BATCH_MAX_AGE_MS).toISOString(),
    };

    for (let index = 0; index < eligible.length; index += 1) {
      if (pauseRef.current) {
        saveProgress(progress);
        setSavedProgress(progress);
        setRunning(false);
        toast.info("Memory items batch paused.");
        return;
      }

      const chapter = eligible[index];
      setCurrentChapterIndex(alreadyDone.length + index);
      setCurrentChapterName(`${chapter.courseCode} — Ch ${chapter.chapter_number}: ${chapter.chapter_name}`);

      const result = await processChapter(chapter);
      progress.results = [
        ...progress.results.filter((entry) => entry.chapterId !== chapter.id),
        result,
      ];

      if (result.status === "success") {
        progress.completedChapterIds.push(chapter.id);
      }

      setResults([...progress.results]);
      saveProgress(progress);
      setSavedProgress(progress);

      if (index < eligible.length - 1) {
        await delay(INTER_CALL_DELAY_MS);
      }
    }

    setRunning(false);
    setPaused(false);
    setFinished(true);
    setCurrentChapterName("");
    clearProgress();
    setSavedProgress(null);
    qc.invalidateQueries({ queryKey: ["cqa-memory-counts"] });
    qc.invalidateQueries({ queryKey: ["cqa-memory-items"] });
    toast.success("Memory items batch complete!");
  }, [getEligibleChapters, processChapter, qc]);

  const handlePause = () => {
    pauseRef.current = true;
    setPaused(true);
  };

  const handleResume = () => {
    const progress = loadProgress();
    if (!progress) {
      setSavedProgress(null);
      toast.error("No saved memory batch found.");
      return;
    }
    runBatch(progress);
  };

  const handleStartFresh = () => {
    clearProgress();
    setSavedProgress(null);
    setResults([]);
    setFinished(false);
    setCurrentChapterName("");
    runBatch();
  };

  const successCount = results.filter((result) => result.status === "success").length;
  const failedResults = results.filter((result) => result.status === "failed");
  const eligibleCount = getEligibleChapters().length;
  const populatedChapterCount = Object.keys(memoryCounts || {}).length;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Brain className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Memory Items Batch Generator</span>
            {!running && !savedProgress && (
              <Badge variant="secondary" className="text-[10px]">
                {eligibleCount} chapters eligible
              </Badge>
            )}
            {populatedChapterCount > 0 && (
              <Badge variant="outline" className="text-[10px]">
                {populatedChapterCount} chapters already populated
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {!running && !savedProgress && (
              <Button size="sm" onClick={handleStartFresh} disabled={eligibleCount === 0}>
                <Brain className="h-3.5 w-3.5 mr-1" />
                Generate Memory Items — All Chapters
              </Button>
            )}

            {!running && !!savedProgress && (
              <>
                <Button size="sm" onClick={handleResume}>
                  <Play className="h-3.5 w-3.5 mr-1" />
                  Resume previous batch? ({savedProgress.completedChapterIds.length} done)
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

        {running && currentChapterName && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              Processing {currentChapterIndex + 1} of {totalChapters} — {currentChapterName}
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className="bg-primary h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${totalChapters ? ((currentChapterIndex + 1) / totalChapters) * 100 : 0}%` }}
              />
            </div>
            {paused && (
              <Badge variant="secondary" className="text-[10px] animate-pulse">
                Pausing after current chapter...
              </Badge>
            )}
          </div>
        )}

        {(finished || results.length > 0) && !running && (
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-xs">
              {successCount > 0 && (
                <span className="text-emerald-400">
                  <Check className="h-3 w-3 inline mr-0.5" />
                  {successCount} complete
                </span>
              )}
              {failedResults.length > 0 && (
                <span className="text-destructive">
                  <AlertTriangle className="h-3 w-3 inline mr-0.5" />
                  {failedResults.length} failed
                </span>
              )}
            </div>

            {failedResults.length > 0 && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {failedResults.map((result) => (
                  <div
                    key={result.chapterId}
                    className={cn(
                      "flex items-center gap-2 text-[11px] px-2 py-1 rounded border",
                      "bg-destructive/5 border-destructive/20"
                    )}
                  >
                    <X className="h-3 w-3 text-destructive shrink-0" />
                    <span className="font-medium">{result.chapterName}</span>
                    <span className="text-muted-foreground truncate">{result.error}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground">
          Runs one chapter at a time with a 1.5s delay between calls, skips chapters that already have memory items, and excludes Ch 1–2 from Intro 1.
        </p>
      </CardContent>
    </Card>
  );
}
