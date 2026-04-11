/**
 * BulkAuditOrchestrator — Audits all chapters in a selected course
 * sequentially (all 7 tabs per chapter in parallel), with live progress,
 * pause/resume/stop, and combined findings view.
 *
 * Results persist in localStorage for 24 hours.
 */
import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, Pause, Play, Square, Check, X, AlertTriangle,
  ChevronRight, Search, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ChapterAuditModal } from "./ChapterAuditModal";

// ── Constants ────────────────────────────────────────────────────

const STORAGE_KEY = "sa_bulk_audit_results";
const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

const TAB_KEYS = ["purpose", "key_terms", "accounts", "memory", "formulas", "jes", "mistakes"] as const;
type TabKey = typeof TAB_KEYS[number];

const TAB_LABELS: Record<TabKey, string> = {
  purpose: "Purpose",
  key_terms: "Key Terms",
  accounts: "Accounts",
  memory: "Memory",
  formulas: "Formulas",
  jes: "JEs",
  mistakes: "Mistakes",
};

const COURSE_LABELS: Record<string, string> = {
  ACCY201: "Intro 1",
  ACCY202: "Intro 2",
  ACCY303: "IA1",
  ACCY304: "IA2",
};

// ── Types ────────────────────────────────────────────────────────

type Finding = {
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  tab: TabKey;
};

type ChapterTabResult = {
  status: "done" | "error";
  findings: Finding[];
  overall: string;
  errorMsg: string;
};

type ChapterAuditResult = {
  chapterId: string;
  chapterNumber: number;
  chapterName: string;
  courseCode: string;
  status: "clean" | "has_findings" | "error";
  tabs: Partial<Record<TabKey, ChapterTabResult>>;
  totalFindings: number;
  highFindings: number;
};

type PersistedData = {
  results: ChapterAuditResult[];
  savedAt: number;
};

type RunState = "idle" | "setup" | "running" | "paused" | "stopped" | "done";
type ChapterRunStatus = "pending" | "running" | "done" | "error";

// ── Persistence ──────────────────────────────────────────────────

function loadPersistedResults(): ChapterAuditResult[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: PersistedData = JSON.parse(raw);
    if (Date.now() - parsed.savedAt > EXPIRY_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
    return parsed.results;
  } catch { return []; }
}

function persistResults(results: ChapterAuditResult[]) {
  const data: PersistedData = { results, savedAt: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ── Component ────────────────────────────────────────────────────

export function BulkAuditOrchestrator() {
  const [runState, setRunState] = useState<RunState>("idle");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [skippedChapterIds, setSkippedChapterIds] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<ChapterAuditResult[]>(loadPersistedResults);
  const [currentChapterIdx, setCurrentChapterIdx] = useState(0);
  const [currentChapterName, setCurrentChapterName] = useState("");
  const [completedTabs, setCompletedTabs] = useState<Set<TabKey>>(new Set());
  const [runningTabs, setRunningTabs] = useState<Set<TabKey>>(new Set());
  const [chapterQueue, setChapterQueue] = useState<Array<{ id: string; chapter_number: number; chapter_name: string; course_id: string }>>([]);
  const [totalInQueue, setTotalInQueue] = useState(0);

  // For opening single chapter audit modal with pre-populated data
  const [viewChapterId, setViewChapterId] = useState<string | null>(null);
  const [combinedViewOpen, setCombinedViewOpen] = useState(false);

  const pauseRef = useRef(false);
  const stopRef = useRef(false);

  // ── Data ───────────────────────────────────────────────────────

  const { data: courses } = useQuery({
    queryKey: ["cqa-courses"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, code, course_name").order("created_at");
      return data || [];
    },
  });

  const { data: allChapters } = useQuery({
    queryKey: ["cqa-chapters"],
    queryFn: async () => {
      const { data } = await supabase.from("chapters").select("id, chapter_number, chapter_name, course_id").order("chapter_number");
      return data || [];
    },
  });

  const courseChapters = useMemo(() => {
    if (!allChapters || !selectedCourseId) return [];
    return allChapters.filter(ch => ch.course_id === selectedCourseId);
  }, [allChapters, selectedCourseId]);

  const selectedCourse = courses?.find(c => c.id === selectedCourseId);
  const courseCode = selectedCourse?.code || "";

  // Pre-check chapters already audited this session
  const alreadyAuditedIds = useMemo(() => new Set(results.map(r => r.chapterId)), [results]);

  useEffect(() => {
    if (runState === "setup") {
      setSkippedChapterIds(new Set(alreadyAuditedIds));
    }
  }, [runState, alreadyAuditedIds]);

  // ── Audit logic ────────────────────────────────────────────────

  const auditChapter = useCallback(async (
    chapter: { id: string; chapter_number: number; chapter_name: string },
  ): Promise<ChapterAuditResult> => {
    const chapterLabel = `Ch ${chapter.chapter_number} — ${chapter.chapter_name}`;
    const tabResults: Partial<Record<TabKey, ChapterTabResult>> = {};
    let totalFindings = 0;
    let highFindings = 0;
    let hasError = false;

    setCompletedTabs(new Set());
    setRunningTabs(new Set(TAB_KEYS));

    // Fire all 7 tabs in parallel
    const promises = TAB_KEYS.map(async (tabKey) => {
      try {
        const { data, error } = await supabase.functions.invoke("audit-chapter-tab", {
          body: {
            chapter_id: chapter.id,
            tab: tabKey,
            chapter_name: chapterLabel,
            course_code: courseCode,
          },
        });

        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);

        const findings: Finding[] = (data.findings || []).map((f: any) => ({
          severity: f.severity || "low",
          title: f.title || "Untitled",
          description: f.description || "",
          tab: tabKey,
        }));

        tabResults[tabKey] = {
          status: "done",
          findings,
          overall: data.overall || "",
          errorMsg: "",
        };

        totalFindings += findings.length;
        highFindings += findings.filter(f => f.severity === "high").length;
      } catch (err: any) {
        tabResults[tabKey] = {
          status: "error",
          findings: [],
          overall: "",
          errorMsg: err.message || "Unknown error",
        };
        hasError = true;
      } finally {
        setRunningTabs(prev => { const s = new Set(prev); s.delete(tabKey); return s; });
        setCompletedTabs(prev => new Set(prev).add(tabKey));
      }
    });

    await Promise.allSettled(promises);

    const allTabsErrored = TAB_KEYS.every(k => tabResults[k]?.status === "error");

    return {
      chapterId: chapter.id,
      chapterNumber: chapter.chapter_number,
      chapterName: chapter.chapter_name,
      courseCode,
      status: allTabsErrored ? "error" : highFindings > 0 ? "has_findings" : totalFindings > 0 ? "has_findings" : "clean",
      tabs: tabResults,
      totalFindings,
      highFindings,
    };
  }, [courseCode]);

  const startAudit = useCallback(async () => {
    const queue = courseChapters.filter(ch => !skippedChapterIds.has(ch.id));
    if (queue.length === 0) {
      toast.error("No chapters to audit.");
      return;
    }

    setChapterQueue(queue);
    setTotalInQueue(queue.length);
    setRunState("running");
    pauseRef.current = false;
    stopRef.current = false;

    const newResults = [...results];

    for (let i = 0; i < queue.length; i++) {
      if (stopRef.current) {
        setRunState("stopped");
        persistResults(newResults);
        return;
      }
      if (pauseRef.current) {
        setRunState("paused");
        setChapterQueue(queue.slice(i));
        persistResults(newResults);
        return;
      }

      const ch = queue[i];
      setCurrentChapterIdx(i);
      setCurrentChapterName(`Ch ${ch.chapter_number} — ${ch.chapter_name}`);

      const result = await auditChapter(ch);

      // Replace existing result for this chapter if re-running
      const existingIdx = newResults.findIndex(r => r.chapterId === ch.id);
      if (existingIdx >= 0) {
        newResults[existingIdx] = result;
      } else {
        newResults.push(result);
      }

      setResults([...newResults]);
      persistResults(newResults);
    }

    setRunState("done");
    setCurrentChapterName("");
    toast.success(`Bulk audit complete — ${queue.length} chapters audited.`);
  }, [courseChapters, skippedChapterIds, results, auditChapter]);

  const handleResume = useCallback(() => {
    pauseRef.current = false;
    stopRef.current = false;
    setRunState("running");

    const remaining = chapterQueue;
    const newResults = [...results];

    (async () => {
      for (let i = 0; i < remaining.length; i++) {
        if (stopRef.current) { setRunState("stopped"); persistResults(newResults); return; }
        if (pauseRef.current) {
          setRunState("paused");
          setChapterQueue(remaining.slice(i));
          persistResults(newResults);
          return;
        }

        const ch = remaining[i];
        setCurrentChapterIdx(i);
        setCurrentChapterName(`Ch ${ch.chapter_number} — ${ch.chapter_name}`);

        const result = await auditChapter(ch);
        const existingIdx = newResults.findIndex(r => r.chapterId === ch.id);
        if (existingIdx >= 0) newResults[existingIdx] = result;
        else newResults.push(result);

        setResults([...newResults]);
        persistResults(newResults);
      }

      setRunState("done");
      setCurrentChapterName("");
      toast.success("Bulk audit resumed and completed.");
    })();
  }, [chapterQueue, results, auditChapter]);

  // ── Computed ───────────────────────────────────────────────────

  const courseResults = useMemo(() => {
    if (!selectedCourseId) return results;
    return results.filter(r => r.courseCode === courseCode);
  }, [results, selectedCourseId, courseCode]);

  const cleanCount = courseResults.filter(r => r.status === "clean").length;
  const findingsCount = courseResults.filter(r => r.status === "has_findings").length;
  const errorCount = courseResults.filter(r => r.status === "error").length;

  const allFindings = useMemo(() => {
    const all: (Finding & { chapterName: string; chapterNumber: number; chapterId: string })[] = [];
    courseResults.forEach(r => {
      TAB_KEYS.forEach(tab => {
        const tr = r.tabs[tab];
        if (tr?.findings) {
          tr.findings.forEach(f => {
            all.push({ ...f, chapterName: r.chapterName, chapterNumber: r.chapterNumber, chapterId: r.chapterId });
          });
        }
      });
    });
    // Sort: high → medium → low, grouped by chapter
    const sevOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    all.sort((a, b) => {
      if (a.chapterNumber !== b.chapterNumber) return a.chapterNumber - b.chapterNumber;
      return (sevOrder[a.severity] || 2) - (sevOrder[b.severity] || 2);
    });
    return all;
  }, [courseResults]);

  // ── View chapter modal ─────────────────────────────────────────

  const viewResult = viewChapterId ? results.find(r => r.chapterId === viewChapterId) : null;

  // ── Render ─────────────────────────────────────────────────────

  const isActive = runState === "running" || runState === "paused";

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Bulk Audit — All Chapters</span>
          </div>

          {runState === "idle" && (
            <Button size="sm" onClick={() => setRunState("setup")}>
              Audit All Chapters →
            </Button>
          )}
        </div>

        {/* Persisted results summary (when idle) */}
        {runState === "idle" && results.length > 0 && (
          <div className="space-y-2">
            <div className="flex gap-3 text-xs flex-wrap">
              <span className="text-muted-foreground">{results.length} chapters audited (cached)</span>
              {results.filter(r => r.status === "clean").length > 0 && (
                <span className="text-emerald-400"><Check className="h-3 w-3 inline mr-0.5" />{results.filter(r => r.status === "clean").length} clean</span>
              )}
              {results.filter(r => r.status === "has_findings").length > 0 && (
                <span className="text-amber-400"><AlertTriangle className="h-3 w-3 inline mr-0.5" />{results.filter(r => r.status === "has_findings").length} with findings</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setCombinedViewOpen(true)}>
                View All Findings →
              </Button>
              <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => { setResults([]); localStorage.removeItem(STORAGE_KEY); }}>
                Clear Cache
              </Button>
            </div>
          </div>
        )}

        {/* Setup: course selector + skip list */}
        {runState === "setup" && (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Select Course</p>
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Choose a course..." />
                </SelectTrigger>
                <SelectContent>
                  {courses?.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {COURSE_LABELS[c.code] || c.code} — {c.course_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCourseId && courseChapters.length > 0 && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      Chapters to audit ({courseChapters.length - skippedChapterIds.size} of {courseChapters.length})
                    </p>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2"
                        onClick={() => setSkippedChapterIds(new Set())}>
                        Select All
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2"
                        onClick={() => setSkippedChapterIds(new Set(courseChapters.map(c => c.id)))}>
                        Deselect All
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="max-h-48 rounded-md border border-border p-2">
                    <div className="space-y-1">
                      {courseChapters.map(ch => {
                        const isSkipped = skippedChapterIds.has(ch.id);
                        const wasAudited = alreadyAuditedIds.has(ch.id);
                        return (
                          <label key={ch.id} className="flex items-start gap-2 py-1.5 px-1 rounded hover:bg-muted/50 cursor-pointer text-xs">
                            <Checkbox
                              checked={!isSkipped}
                              className="mt-0.5 shrink-0"
                              onCheckedChange={(checked) => {
                                setSkippedChapterIds(prev => {
                                  const next = new Set(prev);
                                  if (checked) next.delete(ch.id);
                                  else next.add(ch.id);
                                  return next;
                                });
                              }}
                            />
                            <span className="font-medium shrink-0">Ch {ch.chapter_number}</span>
                            <span className="text-muted-foreground break-words min-w-0">{ch.chapter_name}</span>
                            {wasAudited && (
                              <Badge variant="secondary" className="text-[9px] h-4 px-1.5 shrink-0 whitespace-nowrap">
                                Audited
                              </Badge>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" onClick={startAudit}
                    disabled={courseChapters.length - skippedChapterIds.size === 0}>
                    <Search className="h-3.5 w-3.5 mr-1" />
                    Start Audit — {courseChapters.length - skippedChapterIds.size} Chapters
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRunState("idle")}>Cancel</Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Live progress */}
        {isActive && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span className="text-xs font-medium">
                Auditing {COURSE_LABELS[courseCode] || courseCode} — Ch {currentChapterIdx + 1} of {totalInQueue} — {currentChapterName}
              </span>
            </div>

            {/* Tab progress pills */}
            <div className="flex gap-1.5 flex-wrap">
              {TAB_KEYS.map(tab => {
                const isDone = completedTabs.has(tab);
                const isRunning = runningTabs.has(tab) && !isDone;
                return (
                  <Badge
                    key={tab}
                    variant="secondary"
                    className={cn(
                      "text-[10px] transition-colors",
                      isDone && "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
                      isRunning && "bg-primary/20 text-primary animate-pulse border-primary/30",
                    )}
                  >
                    {isDone ? "✓" : isRunning ? "⟳" : "○"} {TAB_LABELS[tab]}
                  </Badge>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className="bg-primary h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${((currentChapterIdx + 1) / totalInQueue) * 100}%` }}
              />
            </div>

            {/* Controls */}
            <div className="flex gap-2">
              {runState === "running" && (
                <Button size="sm" variant="outline" className="text-xs h-7"
                  onClick={() => { pauseRef.current = true; }}>
                  <Pause className="h-3 w-3 mr-1" /> Pause
                </Button>
              )}
              {runState === "paused" && (
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={handleResume}>
                  <Play className="h-3 w-3 mr-1" /> Resume
                </Button>
              )}
              <Button size="sm" variant="outline" className="text-xs h-7 border-destructive/30 text-destructive"
                onClick={() => { stopRef.current = true; pauseRef.current = true; }}>
                <Square className="h-3 w-3 mr-1" /> Stop
              </Button>
            </div>
          </div>
        )}

        {/* Chapter result rows */}
        {(isActive || runState === "done" || runState === "stopped") && courseResults.length > 0 && (
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {courseResults.map(r => (
              <button
                key={r.chapterId}
                className={cn(
                  "flex items-center gap-2 text-[11px] px-2 py-1.5 rounded w-full text-left hover:bg-muted/50 transition-colors border",
                  r.status === "clean" && "border-emerald-500/20 bg-emerald-500/5",
                  r.status === "has_findings" && "border-amber-500/20 bg-amber-500/5",
                  r.status === "error" && "border-destructive/20 bg-destructive/5",
                )}
                onClick={() => setViewChapterId(r.chapterId)}
              >
                {r.status === "clean" && <Check className="h-3 w-3 text-emerald-400 shrink-0" />}
                {r.status === "has_findings" && <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />}
                {r.status === "error" && <X className="h-3 w-3 text-destructive shrink-0" />}
                <span className="font-medium">Ch {r.chapterNumber} — {r.chapterName}</span>
                <span className="ml-auto shrink-0">
                  {r.status === "clean" && <Badge className="text-[9px] h-4 px-1.5 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">✓ Clean</Badge>}
                  {r.status === "has_findings" && (
                    <Badge className={cn(
                      "text-[9px] h-4 px-1.5",
                      r.highFindings > 0
                        ? "bg-destructive/20 text-destructive border-destructive/30"
                        : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                    )}>
                      {r.totalFindings} finding{r.totalFindings !== 1 ? "s" : ""}
                    </Badge>
                  )}
                  {r.status === "error" && <Badge className="text-[9px] h-4 px-1.5 bg-destructive/20 text-destructive border-destructive/30">Failed</Badge>}
                </span>
                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* Summary card on finish */}
        {(runState === "done" || runState === "stopped") && courseResults.length > 0 && (
          <div className="rounded-lg border border-border p-3 space-y-2 bg-card">
            <p className="text-xs font-bold text-foreground">Audit Summary</p>
            <div className="flex gap-4 text-xs">
              <span className="text-muted-foreground">{courseResults.length} chapters audited</span>
              {findingsCount > 0 && (
                <span className="text-amber-400 font-medium">{findingsCount} with findings</span>
              )}
              {cleanCount > 0 && (
                <span className="text-emerald-400 font-medium">{cleanCount} clean</span>
              )}
              {errorCount > 0 && (
                <span className="text-destructive font-medium">{errorCount} failed</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setCombinedViewOpen(true)}>
                View All Findings →
              </Button>
              <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => {
                setRunState("idle");
                setCurrentChapterName("");
              }}>
                Done
              </Button>
            </div>
          </div>
        )}

        {/* Combined findings dialog */}
        <Dialog open={combinedViewOpen} onOpenChange={setCombinedViewOpen}>
          <DialogContent className="max-w-[95vw] w-full h-[100dvh] md:h-[85vh] flex flex-col p-0 gap-0 rounded-none md:rounded-lg">
            <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border shrink-0">
              <h2 className="text-base font-bold text-foreground">
                All Findings — {allFindings.length} across {courseResults.length} chapters
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setCombinedViewOpen(false)} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="px-4 md:px-6 py-4 space-y-1">
                {allFindings.length === 0 && (
                  <p className="text-sm text-muted-foreground py-8 text-center">All chapters are clean — no findings.</p>
                )}
                {(() => {
                  let lastChapter = "";
                  return allFindings.map((f, i) => {
                    const chapterHeader = f.chapterName !== lastChapter;
                    lastChapter = f.chapterName;
                    return (
                      <div key={i}>
                        {chapterHeader && (
                          <div className="flex items-center justify-between pt-4 pb-1.5 first:pt-0">
                            <p className="text-xs font-bold text-foreground">Ch {f.chapterNumber} — {f.chapterName}</p>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-[10px] h-6 px-2 text-primary"
                              onClick={() => { setCombinedViewOpen(false); setViewChapterId(f.chapterId); }}
                            >
                              Open Chapter →
                            </Button>
                          </div>
                        )}
                        <div className="flex items-start gap-2 px-2 py-1.5 rounded border border-border/50 bg-card/50 text-xs">
                          <Badge className={cn(
                            "text-[9px] shrink-0 mt-0.5",
                            f.severity === "high" && "bg-destructive/20 text-destructive border-destructive/30",
                            f.severity === "medium" && "bg-amber-500/20 text-amber-500 border-amber-500/30",
                            f.severity === "low" && "bg-muted text-muted-foreground border-border",
                          )}>
                            {f.severity}
                          </Badge>
                          <Badge variant="secondary" className="text-[9px] shrink-0 mt-0.5">{TAB_LABELS[f.tab]}</Badge>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">{f.title}</p>
                            <p className="text-muted-foreground mt-0.5">{f.description}</p>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Single chapter audit modal (pre-populated) */}
        {viewResult && (
          <ChapterAuditModal
            open={!!viewChapterId}
            onClose={() => setViewChapterId(null)}
            chapterNumber={viewResult.chapterNumber}
            chapterName={viewResult.chapterName}
            chapterId={viewResult.chapterId}
            courseCode={viewResult.courseCode}
            preloadedFindings={viewResult.tabs}
          />
        )}
      </CardContent>
    </Card>
  );
}
