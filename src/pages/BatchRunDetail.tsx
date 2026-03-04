import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Play, Pause, XCircle, Loader2, CheckCircle2, AlertTriangle, Clock, ArrowLeft, Copy, Eye } from "lucide-react";
import { toast } from "sonner";

function formatDuration(ms: number | null): string {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `${m}m ${rem}s` : `${s}s`;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  running: "bg-primary/15 text-primary",
  paused: "bg-warning/15 text-warning",
  completed: "bg-success/15 text-success",
  failed: "bg-destructive/15 text-destructive",
  canceled: "bg-muted text-muted-foreground",
};

const ITEM_STATUS_COLORS: Record<string, string> = {
  queued: "bg-muted text-muted-foreground",
  generating: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  failed: "bg-destructive/15 text-destructive",
  skipped: "bg-muted text-muted-foreground",
};

export default function BatchRunDetail() {
  const { batchRunId } = useParams<{ batchRunId: string }>();
  const qc = useQueryClient();
  const [loopRunning, setLoopRunning] = useState(false);
  const loopRef = useRef(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: run, refetch: refetchRun } = useQuery({
    queryKey: ["batch-run", batchRunId],
    queryFn: async () => {
      const { data, error } = await supabase.from("chapter_batch_runs")
        .select("*").eq("id", batchRunId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!batchRunId,
    refetchInterval: loopRunning ? 2000 : false,
  });

  const { data: items, refetch: refetchItems } = useQuery({
    queryKey: ["batch-run-items", batchRunId],
    queryFn: async () => {
      const { data, error } = await supabase.from("chapter_batch_run_items")
        .select("*, chapter_problems(source_label, title)")
        .eq("batch_run_id", batchRunId!)
        .order("seq");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!batchRunId,
    refetchInterval: loopRunning ? 2000 : false,
  });

  // Live elapsed timer
  useEffect(() => {
    if (loopRunning) {
      const startTime = run?.started_at ? new Date(run.started_at).getTime() : Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      // Show final elapsed if completed
      if (run?.started_at && run?.ended_at) {
        setElapsed(Math.floor((new Date(run.ended_at).getTime() - new Date(run.started_at).getTime()) / 1000));
      }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loopRunning, run?.started_at, run?.ended_at]);

  const runStep = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("run-chapter-batch-step", {
      body: { batch_run_id: batchRunId },
    });
    if (error) throw error;
    return data;
  }, [batchRunId]);

  const startLoop = useCallback(async () => {
    if (loopRef.current) return;
    loopRef.current = true;
    setLoopRunning(true);

    if (run && ["draft", "paused", "failed"].includes(run.status)) {
      await supabase.from("chapter_batch_runs").update({ status: "running", started_at: run.started_at || new Date().toISOString() }).eq("id", batchRunId!);
    }

    try {
      while (loopRef.current) {
        const result = await runStep();
        await refetchRun();
        await refetchItems();

        if (result.done) {
          toast.success("Batch run completed!");
          break;
        }

        await new Promise((r) => setTimeout(r, 500));
      }
    } catch (e: any) {
      toast.error(`Batch step error: ${e.message}`);
    } finally {
      loopRef.current = false;
      setLoopRunning(false);
      refetchRun();
      refetchItems();
    }
  }, [batchRunId, run, runStep, refetchRun, refetchItems]);

  const pauseLoop = useCallback(async () => {
    loopRef.current = false;
    setLoopRunning(false);
    await supabase.from("chapter_batch_runs").update({ status: "paused" }).eq("id", batchRunId!);
    refetchRun();
    toast.info("Batch paused");
  }, [batchRunId, refetchRun]);

  const cancelRun = useCallback(async () => {
    loopRef.current = false;
    setLoopRunning(false);
    await supabase.from("chapter_batch_runs").update({
      status: "canceled",
      ended_at: new Date().toISOString(),
    }).eq("id", batchRunId!);
    refetchRun();
    toast.info("Batch canceled");
  }, [batchRunId, refetchRun]);

  const copyDebugBundle = useCallback(async () => {
    if (!run || !items) return;
    // Fetch generation_runs for all source problems in this batch
    const sourceIds = items.map(i => i.source_problem_id);
    const { data: genRuns } = await supabase.from("generation_runs")
      .select("*")
      .in("source_problem_id", sourceIds)
      .gte("created_at", run.created_at)
      .order("created_at");

    const runIds = (genRuns ?? []).map(r => r.id);
    let genEvents: any[] = [];
    if (runIds.length > 0) {
      const { data } = await supabase.from("generation_events")
        .select("*")
        .in("run_id", runIds)
        .order("created_at");
      genEvents = data ?? [];
    }

    const bundle = {
      batch_run: run,
      items: items.map(i => ({
        seq: i.seq,
        source_label: (i.chapter_problems as any)?.source_label,
        status: i.status,
        attempts: i.attempts,
        duration_ms: i.duration_ms,
        last_error: i.last_error,
        created_variant_ids: i.created_variant_ids,
      })),
      generation_runs: genRuns ?? [],
      generation_events: genEvents,
      summary: {
        total: run.total_sources,
        completed: run.completed_sources,
        failed: run.failed_sources,
        avg_seconds_per_source: run.avg_seconds_per_source,
        elapsed_seconds: elapsed,
      },
    };

    await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
    toast.success("Debug bundle copied to clipboard");
  }, [run, items, elapsed]);

  useEffect(() => {
    return () => { loopRef.current = false; };
  }, []);

  if (!run) {
    return <SurviveSidebarLayout><div className="text-muted-foreground">Loading batch run…</div></SurviveSidebarLayout>;
  }

  const progressPct = run.total_sources > 0 ? ((run.completed_sources + run.failed_sources) / run.total_sources) * 100 : 0;
  const remaining = run.total_sources - run.completed_sources - run.failed_sources;
  const canRun = ["draft", "paused", "failed"].includes(run.status) || (run.status === "running" && !loopRunning);
  const canPause = run.status === "running" && loopRunning;
  const isTerminal = run.status === "completed" || run.status === "canceled";

  return (
    <SurviveSidebarLayout>
      <div className="space-y-4 animate-page-enter">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link to="/problem-bank"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
              <h1 className="text-lg font-bold text-foreground">Batch Run</h1>
              <p className="text-xs text-muted-foreground font-mono">{batchRunId?.slice(0, 8)}</p>
            </div>
            <Badge className={`${STATUS_COLORS[run.status] || "bg-muted"} border-0 text-[10px]`}>
              {run.status}
            </Badge>
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={copyDebugBundle}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Debug Bundle
            </Button>
            {canRun && (
              <Button size="sm" onClick={startLoop} disabled={loopRunning}>
                {loopRunning ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1" />}
                {loopRunning ? "Running…" : "Run / Resume"}
              </Button>
            )}
            {canPause && (
              <Button size="sm" variant="outline" onClick={pauseLoop}>
                <Pause className="h-3.5 w-3.5 mr-1" /> Pause
              </Button>
            )}
            {!isTerminal && (
              <Button size="sm" variant="destructive" onClick={cancelRun}>
                <XCircle className="h-3.5 w-3.5 mr-1" /> Cancel
              </Button>
            )}
          </div>
        </div>

        {/* Live Timer */}
        {(loopRunning || isTerminal) && (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <Clock className={`h-4 w-4 ${loopRunning ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
            <div>
              <span className="text-sm font-bold text-foreground">{formatElapsed(elapsed)}</span>
              <span className="text-xs text-muted-foreground ml-2">
                {loopRunning ? "elapsed" : "total time"}
              </span>
            </div>
            {run.avg_seconds_per_source && (
              <div className="ml-auto text-right">
                <span className="text-sm font-bold text-foreground">{Math.round(Number(run.avg_seconds_per_source))}s</span>
                <span className="text-xs text-muted-foreground ml-1">avg/problem</span>
              </div>
            )}
          </div>
        )}

        {/* Progress card */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress: {run.completed_sources + run.failed_sources} / {run.total_sources}</span>
            <span>{Math.round(progressPct)}%</span>
          </div>
          <Progress value={progressPct} className="h-2 bg-muted" />
          <div className="grid grid-cols-4 gap-4 text-xs">
            <div>
              <div className="text-muted-foreground">Success</div>
              <div className="text-lg font-bold text-success">{run.completed_sources}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Failed</div>
              <div className="text-lg font-bold text-destructive">{run.failed_sources}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Remaining</div>
              <div className="text-lg font-bold text-foreground">{remaining}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Avg/source</div>
              <div className="text-lg font-bold text-foreground">
                {run.avg_seconds_per_source ? `${Math.round(Number(run.avg_seconds_per_source))}s` : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Items table */}
        <div className="rounded-lg overflow-hidden border border-border bg-background/95">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-xs w-12">#</TableHead>
                <TableHead className="text-xs">Source</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Attempts</TableHead>
                <TableHead className="text-xs">Duration</TableHead>
                <TableHead className="text-xs">Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(items ?? []).map((item) => (
                <TableRow key={item.id} className="border-border">
                  <TableCell className="text-xs text-muted-foreground">{item.seq}</TableCell>
                  <TableCell className="text-xs font-mono">
                    {(item.chapter_problems as any)?.source_label || item.source_problem_id.slice(0, 8)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] border-0 ${ITEM_STATUS_COLORS[item.status] || "bg-muted"}`}>
                      {item.status === "generating" && <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />}
                      {item.status === "success" && <CheckCircle2 className="h-2.5 w-2.5 mr-1" />}
                      {item.status === "failed" && <AlertTriangle className="h-2.5 w-2.5 mr-1" />}
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{item.attempts}</TableCell>
                  <TableCell className="text-xs">{formatDuration(item.duration_ms)}</TableCell>
                  <TableCell className="text-xs text-destructive max-w-[200px] truncate">{item.last_error || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Timing info */}
        {run.started_at && (
          <div className="text-xs text-muted-foreground flex items-center gap-4">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Started: {new Date(run.started_at).toLocaleString()}</span>
            {run.ended_at && <span>Ended: {new Date(run.ended_at).toLocaleString()}</span>}
          </div>
        )}
      </div>
    </SurviveSidebarLayout>
  );
}
