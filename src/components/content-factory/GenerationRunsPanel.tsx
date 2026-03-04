import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ChevronDown, Copy, CheckCircle2, XCircle, Clock, Cpu, RefreshCw,
  AlertTriangle, Info, AlertCircle, Bug, Layers, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Props {
  chapterId: string;
  courseId?: string;
}

const LEVEL_ICON: Record<string, typeof Info> = {
  debug: Bug, info: Info, warn: AlertTriangle, error: AlertCircle,
};
const LEVEL_CLASS: Record<string, string> = {
  debug: "text-muted-foreground",
  info: "text-muted-foreground",
  warn: "text-amber-400",
  error: "text-destructive",
};
const STATUS_CLASS: Record<string, string> = {
  started: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  success: "bg-green-500/20 text-green-400 border-green-500/30",
  failed: "bg-destructive/20 text-destructive border-destructive/30",
};
const SCOPE_CLASS: Record<string, string> = {
  frontend: "bg-blue-500/10 text-blue-400",
  backend: "bg-purple-500/10 text-purple-400",
  db: "bg-emerald-500/10 text-emerald-400",
  ai: "bg-amber-500/10 text-amber-400",
  validator: "bg-cyan-500/10 text-cyan-400",
};

export function GenerationRunsPanel({ chapterId, courseId }: Props) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
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

  // Fetch runs for this chapter
  const { data: runs, isLoading: runsLoading, refetch } = useQuery({
    queryKey: ["generation-runs", chapterId],
    queryFn: async () => {
      // Get source problem IDs for this chapter
      const { data: problems } = await supabase
        .from("chapter_problems")
        .select("id")
        .eq("chapter_id", chapterId);
      const problemIds = problems?.map(p => p.id) ?? [];

      if (problemIds.length === 0) return [];

      const { data, error } = await supabase
        .from("generation_runs" as any)
        .select("*")
        .in("source_problem_id", problemIds)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!chapterId,
  });

  // Fetch events for selected run
  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ["generation-events", selectedRunId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generation_events" as any)
        .select("*")
        .eq("run_id", selectedRunId!)
        .order("seq", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!selectedRunId,
  });

  const selectedRun = runs?.find((r: any) => r.id === selectedRunId);

  const filteredEvents = events?.filter((e: any) => {
    if (scopeFilter !== "all" && e.scope !== scopeFilter) return false;
    if (levelFilter !== "all" && e.level !== levelFilter) return false;
    return true;
  });

  const handleCopyBundle = async () => {
    if (!selectedRun) return;
    const bundle = selectedRun.debug_bundle_json ?? {
      run_id: selectedRun.id,
      status: selectedRun.status,
      provider: selectedRun.provider,
      model: selectedRun.model,
      duration_ms: selectedRun.duration_ms,
      error_summary: selectedRun.error_summary,
      timeline: events ?? [],
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
      toast.success("Debug bundle copied to clipboard");
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = JSON.stringify(bundle, null, 2);
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast.success("Debug bundle copied to clipboard");
    }
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
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      <div className="flex gap-3">
        {/* Runs list (left) */}
        <div className="w-72 flex-shrink-0 space-y-1 max-h-[600px] overflow-y-auto">
          {runsLoading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : !runs?.length ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No generation runs yet.</p>
          ) : runs.map((run: any) => (
            <button
              key={run.id}
              onClick={() => setSelectedRunId(run.id)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md border text-xs transition-colors",
                selectedRunId === run.id
                  ? "border-primary/50 bg-primary/5"
                  : "border-border hover:bg-muted/50"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className={cn("text-[9px] h-4", STATUS_CLASS[run.status])}>
                  {run.status}
                </Badge>
                <span className="text-muted-foreground">{format(new Date(run.created_at), "MMM d HH:mm:ss")}</span>
              </div>
              <div className="flex items-center gap-2">
                {run.provider && (
                  <Badge variant="secondary" className="text-[9px] h-4">
                    <Cpu className="h-2.5 w-2.5 mr-0.5" />{run.provider}
                  </Badge>
                )}
                {run.duration_ms != null && (
                  <Badge variant="outline" className="text-[9px] h-4">
                    <Clock className="h-2.5 w-2.5 mr-0.5" />{run.duration_ms >= 1000 ? `${(run.duration_ms / 1000).toFixed(1)}s` : `${run.duration_ms}ms`}
                  </Badge>
                )}
              </div>
              {run.error_summary && (
                <p className="text-destructive truncate mt-1">{run.error_summary}</p>
              )}
            </button>
          ))}
        </div>

        {/* Events detail (right) */}
        <div className="flex-1 min-w-0 space-y-3">
          {!selectedRunId ? (
            <p className="text-xs text-muted-foreground py-8 text-center">Select a run to view its events.</p>
          ) : (
            <>
              {/* Run header */}
              {selectedRun && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={cn("text-[10px]", STATUS_CLASS[selectedRun.status])}>
                    {selectedRun.status === "success" ? <CheckCircle2 className="h-3 w-3 mr-1" /> :
                     selectedRun.status === "failed" ? <XCircle className="h-3 w-3 mr-1" /> : null}
                    {selectedRun.status}
                  </Badge>
                  {selectedRun.provider && (
                    <Badge variant="secondary" className="text-[9px]">
                      {selectedRun.provider}{selectedRun.model ? `/${selectedRun.model.split("/").pop()}` : ""}
                    </Badge>
                  )}
                  {selectedRun.duration_ms != null && (
                    <Badge variant="outline" className="text-[9px]">
                      <Clock className="h-2.5 w-2.5 mr-0.5" />{selectedRun.duration_ms}ms
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground">{events?.length ?? 0} events</span>
                  <Button variant="outline" size="sm" className="h-7 text-xs ml-auto" onClick={handleCopyBundle}>
                    <Copy className="h-3 w-3 mr-1" /> Copy Debug Bundle
                  </Button>
                </div>
              )}

              {selectedRun?.error_summary && (
                <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2">
                  <p className="text-xs text-destructive">{selectedRun.error_summary}</p>
                </div>
              )}

              {/* Filters */}
              <div className="flex gap-2">
                <Select value={scopeFilter} onValueChange={setScopeFilter}>
                  <SelectTrigger className="h-7 text-xs w-28"><SelectValue placeholder="Scope" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Scopes</SelectItem>
                    <SelectItem value="frontend">Frontend</SelectItem>
                    <SelectItem value="backend">Backend</SelectItem>
                    <SelectItem value="db">DB</SelectItem>
                    <SelectItem value="ai">AI</SelectItem>
                    <SelectItem value="validator">Validator</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={levelFilter} onValueChange={setLevelFilter}>
                  <SelectTrigger className="h-7 text-xs w-28"><SelectValue placeholder="Level" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="debug">Debug</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warn">Warn</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Event timeline */}
              {eventsLoading ? (
                <p className="text-xs text-muted-foreground">Loading events…</p>
              ) : !filteredEvents?.length ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No events found.</p>
              ) : (
                <div className="space-y-0.5 max-h-[500px] overflow-y-auto">
                  {filteredEvents.map((evt: any) => {
                    const Icon = LEVEL_ICON[evt.level] ?? Info;
                    return (
                      <Collapsible key={evt.id}>
                        <CollapsibleTrigger className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 text-left text-xs group">
                          <span className="text-muted-foreground font-mono flex-shrink-0 w-6 text-right">{evt.seq}</span>
                          <Icon className={cn("h-3 w-3 flex-shrink-0", LEVEL_CLASS[evt.level])} />
                          <Badge variant="outline" className={cn("text-[9px] h-4 flex-shrink-0", SCOPE_CLASS[evt.scope])}>
                            {evt.scope}
                          </Badge>
                          <span className="font-mono text-foreground truncate">{evt.event_type}</span>
                          <span className="text-muted-foreground truncate flex-1">{evt.message}</span>
                          <span className="text-muted-foreground flex-shrink-0 text-[10px]">
                            {format(new Date(evt.created_at), "HH:mm:ss.SSS")}
                          </span>
                          <ChevronDown className="h-3 w-3 flex-shrink-0 text-muted-foreground group-data-[state=open]:rotate-180 transition-transform" />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="ml-10 py-1.5">
                            <p className="text-xs text-foreground/80 px-2 mb-1">{evt.message}</p>
                            {evt.payload_json && (
                              <pre className="text-[10px] text-muted-foreground bg-muted/30 rounded p-2 overflow-x-auto max-h-60 whitespace-pre-wrap">
                                {JSON.stringify(evt.payload_json, null, 2)}
                              </pre>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
