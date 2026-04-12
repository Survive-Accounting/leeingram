/**
 * BulkApproveOrchestrator — Approve all chapter content (JEs, Formulas,
 * Accounts, Key Terms, Mistakes, Memory Items, Purpose) for selected
 * chapters in a course. UI mirrors BulkAuditOrchestrator.
 */
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Check, Loader2, CheckCheck } from "lucide-react";
import { toast } from "sonner";

const CONTENT_TABLES = [
  "chapter_journal_entries",
  "chapter_formulas",
  "chapter_accounts",
  "chapter_key_terms",
  "chapter_exam_mistakes",
  "chapter_memory_items",
  "chapter_purpose",
] as const;

type RunState = "idle" | "setup" | "running" | "done";

export function BulkApproveOrchestrator() {
  const qc = useQueryClient();
  const [runState, setRunState] = useState<RunState>("idle");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [skippedChapterIds, setSkippedChapterIds] = useState<Set<string>>(new Set());
  const [currentChapterName, setCurrentChapterName] = useState("");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [totalInQueue, setTotalInQueue] = useState(0);
  const [approvedChapters, setApprovedChapters] = useState<string[]>([]);

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

  const selectedCount = courseChapters.length - skippedChapterIds.size;

  const startApproval = async () => {
    const queue = courseChapters.filter(ch => !skippedChapterIds.has(ch.id));
    if (queue.length === 0) return;

    setRunState("running");
    setTotalInQueue(queue.length);
    setApprovedChapters([]);
    const completed: string[] = [];

    for (let i = 0; i < queue.length; i++) {
      const ch = queue[i];
      setCurrentIdx(i);
      setCurrentChapterName(`Ch ${ch.chapter_number} — ${ch.chapter_name}`);

      // Approve all content tables in parallel for this chapter
      await Promise.all(
        CONTENT_TABLES.map(table =>
          supabase
            .from(table)
            .update({ is_approved: true } as any)
            .eq("chapter_id", ch.id)
        )
      );

      completed.push(ch.id);
      setApprovedChapters([...completed]);
    }

    setRunState("done");
    setCurrentChapterName("");
    toast.success(`Approved all content for ${completed.length} chapters`);
    qc.invalidateQueries({ queryKey: ["cqa-je-counts"] });
    qc.invalidateQueries({ queryKey: ["cqa-formula-counts"] });
  };

  return (
    <Card className="border-emerald-500/30 bg-emerald-500/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CheckCheck className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-semibold">Bulk Approve — All Content</span>
          </div>

          {runState === "idle" && (
            <Button size="sm" variant="outline" className="border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
              onClick={() => setRunState("setup")}>
              Approve Chapters →
            </Button>
          )}
        </div>

        {/* Done summary */}
        {runState === "done" && (
          <div className="space-y-2">
            <p className="text-xs text-emerald-400">
              <Check className="h-3 w-3 inline mr-1" />
              {approvedChapters.length} chapters fully approved
            </p>
            <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => { setRunState("idle"); setApprovedChapters([]); }}>
              Done
            </Button>
          </div>
        )}

        {/* Setup: course selector + chapter checkboxes */}
        {runState === "setup" && (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Select Course</p>
              <Select value={selectedCourseId} onValueChange={(v) => { setSelectedCourseId(v); setSkippedChapterIds(new Set()); }}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Choose a course..." />
                </SelectTrigger>
                <SelectContent>
                  {courses?.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code} — {c.course_name}
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
                      Chapters to approve ({selectedCount} of {courseChapters.length})
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
                  <ScrollArea className="max-h-[50vh] md:max-h-64 rounded-md border border-border p-2">
                    <div className="space-y-1">
                      {courseChapters.map(ch => {
                        const isSkipped = skippedChapterIds.has(ch.id);
                        const wasApproved = approvedChapters.includes(ch.id);
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
                            {wasApproved && (
                              <Badge className="text-[9px] h-4 px-1.5 shrink-0 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                Approved ✓
                              </Badge>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={startApproval} disabled={selectedCount === 0}>
                    <CheckCheck className="h-3.5 w-3.5 mr-1" />
                    Approve All Content — {selectedCount} Chapters
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRunState("idle")}>Cancel</Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Running progress */}
        {runState === "running" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500" />
              <span className="text-xs font-medium">
                Approving {currentIdx + 1} of {totalInQueue} — {currentChapterName}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all"
                style={{ width: `${((currentIdx + 1) / totalInQueue) * 100}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
