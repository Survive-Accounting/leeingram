import { useState, useCallback } from "react";
import { InfoTip } from "@/components/InfoTip";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ChevronRight, Copy, CheckCircle2, XCircle, Clock, Cpu, RefreshCw,
  AlertTriangle, Layers, Loader2, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Props {
  chapterId: string;
  courseId?: string;
}

const STATUS_CLASS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  running: "bg-primary/15 text-primary",
  paused: "bg-amber-500/15 text-amber-400",
  completed: "bg-green-500/15 text-green-400",
  failed: "bg-destructive/15 text-destructive",
  canceled: "bg-muted text-muted-foreground",
};

const ITEM_STATUS_CLASS: Record<string, string> = {
  queued: "text-muted-foreground",
  generating: "text-primary",
  success: "text-green-400",
  failed: "text-destructive",
  skipped: "text-muted-foreground",
};

export function GenerationRunsPanel({ chapterId, courseId }: Props) {
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [batchCreating, setBatchCreating] = useState(false);
  const navigate = useNavigate();

  // Fetch source problems for batch generate
  const { data: sourceProblems } = useQuery({
    queryKey: ["chapter-problems-ids", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_problems")
        .select("id, source_label, status")
        .eq("chapter_id", chapterId)
        .in("status", ["ready", "imported", "generated"]);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!chapterId,
  });

  // Fetch batch runs for this chapter
  const { data: runs, isLoading: runsLoading, refetch } = useQuery({
    queryKey: ["chapter-batch-runs", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_batch_runs")
        .select("*")
        .eq("chapter_id", chapterId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!chapterId,
  });

  // Fetch items for expanded run
  const { data: expandedItems, isLoading: itemsLoading } = useQuery({
    queryKey: ["batch-run-items-panel", expandedRunId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_batch_run_items")
        .select("*, chapter_problems(source_label)")
        .eq("batch_run_id", expandedRunId!)
        .order("seq");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!expandedRunId,
  });

  const handleBatchGenerate = async () => {
    if (!courseId || !sourceProblems?.length) return;
    setBatchCreating(true);
    try {
      const ids = sourceProblems.map(p => p.id);
      const { data, error } = await supabase.functions.invoke("start-chapter-batch-run", {
        body: {
          course_id: courseId,
          chapter_id: chapterId,
          source_problem_ids: ids,
          variant_count: 1,
          provider: "lovable",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Batch created with ${ids.length} sources`);
      navigate(`/batch-run/${data.batch_run_id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBatchCreating(false);
    }
  };

  const copyDebugBundle = useCallback(async (run: any) => {
    try {
      const { data: items } = await supabase
        .from("chapter_batch_run_items")
        .select("*, chapter_problems(source_label)")
        .eq("batch_run_id", run.id)
        .order("seq");

      const sourceIds = (items ?? []).map((i: any) => i.source_problem_id);

      // Fetch answer packages created during this run's timeframe
      let answerPackages: any[] = [];
      if (sourceIds.length > 0 && run.started_at) {
        const { data: ap } = await supabase
          .from("answer_packages")
          .select("id, source_problem_id, version, status, generator, created_at, answer_payload, validation_results")
          .in("source_problem_id", sourceIds)
          .gte("created_at", run.created_at)
          .order("created_at");
        answerPackages = ap ?? [];
      }

      const bundle = {
        batch_run: run,
        items: (items ?? []).map((i: any) => ({
          seq: i.seq,
          source_label: (i.chapter_problems as any)?.source_label,
          source_problem_id: i.source_problem_id,
          status: i.status,
          attempts: i.attempts,
          duration_ms: i.duration_ms,
          last_error: i.last_error,
          created_variant_ids: i.created_variant_ids,
        })),
        answer_packages: answerPackages.map((ap: any) => ({
          id: ap.id,
          source_problem_id: ap.source_problem_id,
          version: ap.version,
          status: ap.status,
          generator: ap.generator,
          created_at: ap.created_at,
          validation_results: ap.validation_results,
          answer_payload_preview: JSON.stringify(ap.answer_payload).slice(0, 500),
        })),
        summary: {
          total: run.total_sources,
          completed: run.completed_sources,
          failed: run.failed_sources,
          avg_seconds_per_source: run.avg_seconds_per_source,
        },
      };

      await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
      toast.success("Debug bundle copied to clipboard");
    } catch {
      toast.error("Failed to copy debug bundle");
    }
  }, []);

  const formatDuration = (ms: number | null) => {
    if (!ms) return "—";
    const s = Math.round(ms / 1000);
    return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
  };

  const getRunDuration = (run: any) => {
    if (!run.started_at) return "—";
    const end = run.ended_at ? new Date(run.ended_at).getTime() : Date.now();
    const ms = end - new Date(run.started_at).getTime();
    const s = Math.round(ms / 1000);
    return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-xs">
        <span className="font-semibold text-sm">Generation Runs</span>
        <span className="text-muted-foreground">{runs?.length ?? 0} runs</span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] px-2.5"
            onClick={handleBatchGenerate}
            disabled={batchCreating || !sourceProblems?.length}
          >
            {batchCreating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Layers className="h-3 w-3 mr-1" />}
            Batch Generate{sourceProblems?.length ? ` (${sourceProblems.length})` : ""}
          </Button>
          <InfoTip text="Generates Survive Teaching Assets for all selected Ready source problems at once. Each problem is processed sequentially." />
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* Runs list */}
      {runsLoading ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Loading…</p>
      ) : !runs?.length ? (
        <p className="text-xs text-muted-foreground py-8 text-center">No generation runs yet.</p>
      ) : (
        <div className="space-y-1.5">
          {runs.map((run) => {
            const isExpanded = expandedRunId === run.id;
            return (
              <Collapsible
                key={run.id}
                open={isExpanded}
                onOpenChange={(open) => setExpandedRunId(open ? run.id : null)}
              >
                <div className={cn(
                  "rounded-lg border transition-colors",
                  isExpanded ? "border-primary/30 bg-primary/5" : "border-border hover:bg-muted/30"
                )}>
                  {/* Run summary row */}
                  <CollapsibleTrigger className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-xs group">
                    <ChevronRight className={cn(
                      "h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition-transform",
                      isExpanded && "rotate-90"
                    )} />
                    <Badge variant="outline" className={cn("text-[10px] h-5 border-0", STATUS_CLASS[run.status])}>
                      {run.status === "completed" && <CheckCircle2 className="h-2.5 w-2.5 mr-1" />}
                      {run.status === "failed" && <XCircle className="h-2.5 w-2.5 mr-1" />}
                      {run.status === "running" && <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />}
                      {run.status}
                    </Badge>
                    <span className="text-muted-foreground">
                      {format(new Date(run.created_at), "MMM d HH:mm")}
                    </span>
                    <span className="font-medium text-foreground">
                      {run.completed_sources}/{run.total_sources} sources
                    </span>
                    {run.failed_sources > 0 && (
                      <span className="text-destructive">
                        <AlertTriangle className="h-3 w-3 inline mr-0.5" />{run.failed_sources} failed
                      </span>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px] h-4">
                        <Cpu className="h-2.5 w-2.5 mr-0.5" />{run.provider}
                      </Badge>
                      <Badge variant="outline" className="text-[9px] h-4">
                        <Clock className="h-2.5 w-2.5 mr-0.5" />{getRunDuration(run)}
                      </Badge>
                      {run.avg_seconds_per_source && (
                        <span className="text-[10px] text-muted-foreground">
                          ~{Math.round(Number(run.avg_seconds_per_source))}s/src
                        </span>
                      )}
                    </div>
                  </CollapsibleTrigger>

                  {/* Expanded details */}
                  <CollapsibleContent>
                    <div className="border-t border-border px-3 pb-3 pt-2 space-y-3">
                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] px-2"
                          onClick={(e) => { e.stopPropagation(); copyDebugBundle(run); }}
                        >
                          <Copy className="h-3 w-3 mr-1" /> Copy Debug Bundle
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] px-2"
                          onClick={(e) => { e.stopPropagation(); navigate(`/batch-run/${run.id}`); }}
                        >
                          <Eye className="h-3 w-3 mr-1" /> Open Full View
                        </Button>
                        <span className="text-[10px] text-muted-foreground font-mono ml-auto">{run.id.slice(0, 8)}</span>
                      </div>

                      {/* Items table */}
                      {itemsLoading ? (
                        <p className="text-[10px] text-muted-foreground">Loading items…</p>
                      ) : (
                        <div className="rounded border border-border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="border-border">
                                <TableHead className="text-[10px] py-1 w-8">#</TableHead>
                                <TableHead className="text-[10px] py-1">Source</TableHead>
                                <TableHead className="text-[10px] py-1">Status</TableHead>
                                <TableHead className="text-[10px] py-1">Attempts</TableHead>
                                <TableHead className="text-[10px] py-1">Duration</TableHead>
                                <TableHead className="text-[10px] py-1">Error</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(expandedItems ?? []).map((item: any) => (
                                <TableRow key={item.id} className="border-border">
                                  <TableCell className="text-[10px] py-1 text-muted-foreground">{item.seq}</TableCell>
                                  <TableCell className="text-[10px] py-1 font-mono font-medium">
                                    {(item.chapter_problems as any)?.source_label || item.source_problem_id.slice(0, 8)}
                                  </TableCell>
                                  <TableCell className="py-1">
                                    <span className={cn("text-[10px] font-medium", ITEM_STATUS_CLASS[item.status])}>
                                      {item.status === "success" && <CheckCircle2 className="h-2.5 w-2.5 inline mr-0.5" />}
                                      {item.status === "failed" && <XCircle className="h-2.5 w-2.5 inline mr-0.5" />}
                                      {item.status}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-[10px] py-1">{item.attempts}</TableCell>
                                  <TableCell className="text-[10px] py-1">{formatDuration(item.duration_ms)}</TableCell>
                                  <TableCell className="text-[10px] py-1 text-destructive max-w-[200px] truncate">
                                    {item.last_error || "—"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}
