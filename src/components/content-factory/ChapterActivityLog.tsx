import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, AlertTriangle, Info, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Props {
  chapterId: string;
}

const SEVERITY_ICON: Record<string, typeof Info> = { info: Info, warn: AlertTriangle, error: AlertCircle };
const SEVERITY_CLASS: Record<string, string> = {
  info: "text-muted-foreground",
  warn: "text-amber-400",
  error: "text-destructive",
};

export function ChapterActivityLog({ chapterId }: Props) {
  const [severityFilter, setSeverityFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");

  // First get all source problem IDs for this chapter
  const { data: problemIds } = useQuery({
    queryKey: ["chapter-problem-ids", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_problems")
        .select("id, source_label")
        .eq("chapter_id", chapterId);
      if (error) throw error;
      return data;
    },
    enabled: !!chapterId,
  });

  // Then fetch logs for all those entity IDs + the chapter itself
  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["chapter-activity-log", chapterId, problemIds?.map(p => p.id)],
    queryFn: async () => {
      const entityIds = [chapterId, ...(problemIds?.map(p => p.id) ?? [])];
      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .in("entity_id", entityIds)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!chapterId && !!problemIds,
  });

  const problemLabelMap = new Map(problemIds?.map(p => [p.id, p.source_label]) ?? []);

  const eventTypes = [...new Set(logs?.map(l => l.event_type) ?? [])];
  const entityTypes = [...new Set(logs?.map(l => l.entity_type) ?? [])];

  const filtered = logs?.filter(l => {
    if (severityFilter !== "all" && l.severity !== severityFilter) return false;
    if (eventFilter !== "all" && l.event_type !== eventFilter) return false;
    if (entityFilter !== "all" && l.entity_type !== entityFilter) return false;
    return true;
  });

  const errorCount = logs?.filter(l => l.severity === "error").length ?? 0;
  const warnCount = logs?.filter(l => l.severity === "warn").length ?? 0;

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="flex items-center gap-3 text-xs">
        <span className="text-muted-foreground">{logs?.length ?? 0} events</span>
        {errorCount > 0 && (
          <Badge variant="destructive" className="text-[10px] h-5">
            <AlertCircle className="h-3 w-3 mr-1" /> {errorCount} errors
          </Badge>
        )}
        {warnCount > 0 && (
          <Badge variant="outline" className="text-[10px] h-5 text-amber-400 border-amber-400/30">
            <AlertTriangle className="h-3 w-3 mr-1" /> {warnCount} warnings
          </Badge>
        )}
        <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => refetch()}>
          <RefreshCw className="h-3 w-3 mr-1" /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="h-7 text-xs w-28"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warn">Warn</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="Entity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            {entityTypes.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className="h-7 text-xs w-44"><SelectValue placeholder="Event Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            {eventTypes.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Log entries */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading activity…</p>
      ) : !filtered?.length ? (
        <p className="text-xs text-muted-foreground py-8 text-center">No activity logged yet for this chapter.</p>
      ) : (
        <div className="space-y-0.5">
          {filtered.map(log => {
            const Icon = SEVERITY_ICON[log.severity] ?? Info;
            const label = problemLabelMap.get(log.entity_id);
            return (
              <Collapsible key={log.id}>
                <CollapsibleTrigger className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 text-left text-xs group">
                  <Icon className={cn("h-3 w-3 flex-shrink-0", SEVERITY_CLASS[log.severity])} />
                  <span className="text-muted-foreground flex-shrink-0 w-32">{format(new Date(log.created_at), "MMM d HH:mm:ss")}</span>
                  <Badge variant="outline" className="text-[9px] h-4 flex-shrink-0">{log.actor_type}</Badge>
                  {label && <Badge variant="secondary" className="text-[9px] h-4 flex-shrink-0 max-w-[80px] truncate">{label}</Badge>}
                  <span className="font-mono text-foreground truncate">{log.event_type}</span>
                  <ChevronDown className="h-3 w-3 ml-auto text-muted-foreground group-data-[state=open]:rotate-180 transition-transform" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <pre className="text-[10px] text-muted-foreground bg-muted/30 rounded p-2 ml-5 overflow-x-auto max-h-60 whitespace-pre-wrap">
                    {JSON.stringify(log.payload_json, null, 2)}
                  </pre>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}
