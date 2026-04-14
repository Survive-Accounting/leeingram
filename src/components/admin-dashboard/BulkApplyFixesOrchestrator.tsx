/**
 * BulkApplyFixesOrchestrator — After a bulk audit, apply AI-generated
 * content fixes for all chapters that have findings. Uses cached audit
 * results from localStorage (same store as BulkAuditOrchestrator).
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Wrench, Loader2, Check, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "sa_bulk_audit_results";
const EXPIRY_MS = 24 * 60 * 60 * 1000;

const TAB_KEYS = ["purpose", "key_terms", "accounts", "memory", "formulas", "jes", "mistakes"] as const;
type TabKey = typeof TAB_KEYS[number];

const TAB_LABELS: Record<TabKey, string> = {
  purpose: "The Why", key_terms: "Key Terms", accounts: "Accounts",
  memory: "Memory", formulas: "Formulas", jes: "JEs", mistakes: "Mistakes",
};

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

type PersistedData = { results: ChapterAuditResult[]; savedAt: number };

function loadPersistedResults(): ChapterAuditResult[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: PersistedData = JSON.parse(raw);
    if (Date.now() - parsed.savedAt > EXPIRY_MS) return [];
    return parsed.results;
  } catch { return []; }
}

type ChapterFixStatus = "pending" | "running" | "done" | "error";
type TabFixStatus = "pending" | "running" | "done" | "error" | "skipped";

type ChapterProgress = {
  chapterId: string;
  status: ChapterFixStatus;
  tabs: Partial<Record<TabKey, TabFixStatus>>;
  insertedCount: number;
  errorMsg?: string;
};

type RunState = "idle" | "setup" | "running" | "done";

export function BulkApplyFixesOrchestrator() {
  const [runState, setRunState] = useState<RunState>("idle");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [skippedChapterIds, setSkippedChapterIds] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<ChapterProgress[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [totalInQueue, setTotalInQueue] = useState(0);

  const { data: courses } = useQuery({
    queryKey: ["cqa-courses"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, code, course_name").order("created_at");
      return data || [];
    },
  });

  const auditResults = useMemo(() => loadPersistedResults(), []);

  // Filter audit results to those with findings for selected course
  const courseResults = useMemo(() => {
    if (!selectedCourseId || !courses) return [];
    const course = courses.find(c => c.id === selectedCourseId);
    if (!course) return [];
    return auditResults.filter(
      r => r.courseCode === course.code && r.status === "has_findings"
    );
  }, [auditResults, selectedCourseId, courses]);

  const selectedResults = courseResults.filter(r => !skippedChapterIds.has(r.chapterId));
  const totalTabs = selectedResults.reduce((sum, r) => {
    return sum + TAB_KEYS.filter(t => {
      const tab = r.tabs[t];
      return tab?.status === "done" && tab.findings.length > 0;
    }).length;
  }, 0);

  const startFixes = async () => {
    if (selectedResults.length === 0) return;

    const course = courses?.find(c => c.id === selectedCourseId);
    if (!course) return;

    setRunState("running");
    setTotalInQueue(selectedResults.length);
    const allProgress: ChapterProgress[] = selectedResults.map(r => ({
      chapterId: r.chapterId,
      status: "pending",
      tabs: {},
      insertedCount: 0,
    }));
    setProgress([...allProgress]);

    for (let i = 0; i < selectedResults.length; i++) {
      const result = selectedResults[i];
      setCurrentIdx(i);
      allProgress[i].status = "running";
      setProgress([...allProgress]);

      // Find tabs with findings
      const tabsToFix = TAB_KEYS.filter(t => {
        const tab = result.tabs[t];
        return tab?.status === "done" && tab.findings.length > 0;
      });

      if (tabsToFix.length === 0) {
        allProgress[i].status = "done";
        setProgress([...allProgress]);
        continue;
      }

      // Mark all tabs
      for (const t of tabsToFix) {
        allProgress[i].tabs[t] = "pending";
      }
      setProgress([...allProgress]);

      // Process tabs sequentially to avoid overwhelming the API
      let chapterError = false;
      for (const tab of tabsToFix) {
        allProgress[i].tabs[tab] = "running";
        setProgress([...allProgress]);

        const tabResult = result.tabs[tab]!;
        const findingsText = tabResult.findings
          .map(f => `[${f.severity.toUpperCase()}] ${f.title}: ${f.description}`)
          .join("\n");

        try {
          const { data, error } = await supabase.functions.invoke("apply-content-fixes", {
            body: {
              chapter_id: result.chapterId,
              chapter_name: result.chapterName,
              course_code: course.code,
              tab,
              findings: findingsText,
              admin_notes: `Bulk fix from audit — ${tabResult.findings.length} finding(s)`,
            },
          });

          if (error) throw error;
          allProgress[i].tabs[tab] = "done";
          allProgress[i].insertedCount += data?.inserted_count || 0;
        } catch (err: any) {
          console.error(`Fix error: Ch${result.chapterNumber} ${tab}:`, err);
          allProgress[i].tabs[tab] = "error";
          chapterError = true;
          allProgress[i].errorMsg = err.message || "Unknown error";
        }

        setProgress([...allProgress]);

        // 1.5s delay between API calls
        if (tabsToFix.indexOf(tab) < tabsToFix.length - 1) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }

      allProgress[i].status = chapterError ? "error" : "done";
      setProgress([...allProgress]);

      // 1s delay between chapters
      if (i < selectedResults.length - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    setRunState("done");
    const doneCount = allProgress.filter(p => p.status === "done").length;
    const errorCount = allProgress.filter(p => p.status === "error").length;
    const totalInserted = allProgress.reduce((s, p) => s + p.insertedCount, 0);
    toast.success(`Applied fixes: ${doneCount} chapters done, ${totalInserted} items inserted${errorCount ? `, ${errorCount} errors` : ""}`);
  };

  const hasAuditData = auditResults.length > 0;

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold">Bulk Apply Fixes — From Audit</span>
          </div>

          {runState === "idle" && (
            <Button
              size="sm" variant="outline"
              className="border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
              onClick={() => setRunState("setup")}
              disabled={!hasAuditData}
            >
              {hasAuditData ? "Apply Fixes →" : "Run Audit First"}
            </Button>
          )}
        </div>

        {!hasAuditData && runState === "idle" && (
          <p className="text-xs text-muted-foreground">
            No audit results found. Run a Bulk Audit first, then come back here to apply fixes.
          </p>
        )}

        {/* Setup */}
        {runState === "setup" && (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Select Course</p>
              <Select value={selectedCourseId} onValueChange={v => { setSelectedCourseId(v); setSkippedChapterIds(new Set()); }}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Choose a course..." />
                </SelectTrigger>
                <SelectContent>
                  {courses?.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.code} — {c.course_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCourseId && courseResults.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No chapters with findings for this course. Either no audit was run, or all chapters were clean.
              </p>
            )}

            {courseResults.length > 0 && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      Chapters with findings ({selectedResults.length} of {courseResults.length})
                    </p>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2"
                        onClick={() => setSkippedChapterIds(new Set())}>Select All</Button>
                      <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2"
                        onClick={() => setSkippedChapterIds(new Set(courseResults.map(r => r.chapterId)))}>Deselect All</Button>
                    </div>
                  </div>
                  <ScrollArea className="max-h-[50vh] md:max-h-[400px] rounded-md border border-border p-2">
                    <div className="space-y-1">
                      {courseResults.map(r => {
                        const isSkipped = skippedChapterIds.has(r.chapterId);
                        const tabsWithFindings = TAB_KEYS.filter(t => {
                          const tab = r.tabs[t];
                          return tab?.status === "done" && tab.findings.length > 0;
                        });
                        return (
                          <label key={r.chapterId} className="flex items-start gap-2 py-1.5 px-1 rounded hover:bg-muted/50 cursor-pointer text-xs">
                            <Checkbox
                              checked={!isSkipped}
                              className="mt-0.5 shrink-0"
                              onCheckedChange={checked => {
                                setSkippedChapterIds(prev => {
                                  const next = new Set(prev);
                                  if (checked) next.delete(r.chapterId);
                                  else next.add(r.chapterId);
                                  return next;
                                });
                              }}
                            />
                            <span className="font-medium shrink-0">Ch {r.chapterNumber}</span>
                            <span className="text-muted-foreground break-words min-w-0">{r.chapterName}</span>
                            <div className="flex gap-1 shrink-0 ml-auto">
                              <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-amber-500/30 text-amber-500">
                                {r.totalFindings} finding{r.totalFindings !== 1 ? "s" : ""}
                              </Badge>
                              {r.highFindings > 0 && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-red-500/30 text-red-400">
                                  {r.highFindings} high
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-muted-foreground">
                                {tabsWithFindings.length} tab{tabsWithFindings.length !== 1 ? "s" : ""}
                              </Badge>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={startFixes} disabled={selectedResults.length === 0}>
                    <Wrench className="h-3.5 w-3.5 mr-1" />
                    Apply Fixes — {selectedResults.length} Chapters · {totalTabs} Tabs
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRunState("idle")}>Cancel</Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Running */}
        {runState === "running" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
              <span className="text-xs font-medium">
                Fixing {currentIdx + 1} of {totalInQueue} — Ch {selectedResults[currentIdx]?.chapterNumber}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div className="bg-amber-500 h-1.5 rounded-full transition-all"
                style={{ width: `${((currentIdx + 1) / totalInQueue) * 100}%` }} />
            </div>

            {/* Per-chapter tab status */}
            {progress.filter(p => p.status === "running").map(p => {
              const result = selectedResults.find(r => r.chapterId === p.chapterId);
              return (
                <div key={p.chapterId} className="flex flex-wrap gap-1 mt-1">
                  {TAB_KEYS.filter(t => p.tabs[t]).map(t => (
                    <Badge key={t} variant="outline" className={`text-[9px] h-4 px-1.5 ${
                      p.tabs[t] === "done" ? "border-emerald-500/30 text-emerald-400" :
                      p.tabs[t] === "running" ? "border-amber-500/30 text-amber-400" :
                      p.tabs[t] === "error" ? "border-red-500/30 text-red-400" :
                      "text-muted-foreground"
                    }`}>
                      {p.tabs[t] === "running" && <Loader2 className="h-2.5 w-2.5 animate-spin mr-0.5" />}
                      {p.tabs[t] === "done" && <Check className="h-2.5 w-2.5 mr-0.5" />}
                      {p.tabs[t] === "error" && <X className="h-2.5 w-2.5 mr-0.5" />}
                      {TAB_LABELS[t]}
                    </Badge>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Done */}
        {runState === "done" && (
          <div className="space-y-2">
            <div className="space-y-1">
              {progress.map(p => {
                const result = selectedResults.find(r => r.chapterId === p.chapterId);
                return (
                  <div key={p.chapterId} className="flex items-center gap-2 text-xs">
                    {p.status === "done" ? (
                      <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />
                    )}
                    <span className="font-medium">Ch {result?.chapterNumber}</span>
                    <span className="text-muted-foreground">{p.insertedCount} items</span>
                    {p.errorMsg && <span className="text-red-400 truncate max-w-[200px]">{p.errorMsg}</span>}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-amber-400">
              <AlertTriangle className="h-3 w-3 inline mr-1" />
              New content inserted as unapproved — review and approve in Chapter QA.
            </p>
            <Button size="sm" variant="ghost" className="text-xs h-7"
              onClick={() => { setRunState("idle"); setProgress([]); }}>
              Done
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
