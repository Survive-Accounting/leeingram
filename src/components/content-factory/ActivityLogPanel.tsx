import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, AlertTriangle, Info, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Props {
  entityType: string;
  entityId: string;
}

const SEVERITY_ICON: Record<string, typeof Info> = { info: Info, warn: AlertTriangle, error: AlertCircle };
const SEVERITY_CLASS: Record<string, string> = {
  info: "text-muted-foreground",
  warn: "text-amber-400",
  error: "text-destructive",
};

export function ActivityLogPanel({ entityType, entityId }: Props) {
  const [severityFilter, setSeverityFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");

  const { data: logs, isLoading } = useQuery({
    queryKey: ["activity-log", entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .eq("entity_type", entityType as any)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!entityId,
  });

  const eventTypes = [...new Set(logs?.map((l) => l.event_type) ?? [])];
  const filtered = logs?.filter((l) => {
    if (severityFilter !== "all" && l.severity !== severityFilter) return false;
    if (eventFilter !== "all" && l.event_type !== eventFilter) return false;
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="h-7 text-xs w-28"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warn">Warn</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="Event Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            {eventTypes.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading activity…</p>
      ) : !filtered?.length ? (
        <p className="text-xs text-muted-foreground">No activity logged yet.</p>
      ) : (
        <div className="space-y-1">
          {filtered.map((log) => {
            const Icon = SEVERITY_ICON[log.severity] ?? Info;
            return (
              <Collapsible key={log.id}>
                <CollapsibleTrigger className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 text-left text-xs group">
                  <Icon className={cn("h-3 w-3 flex-shrink-0", SEVERITY_CLASS[log.severity])} />
                  <span className="text-muted-foreground flex-shrink-0 w-28">{format(new Date(log.created_at), "MMM d HH:mm:ss")}</span>
                  <Badge variant="outline" className="text-[9px] h-4 flex-shrink-0">{log.actor_type}</Badge>
                  <span className="font-mono text-foreground truncate">{log.event_type}</span>
                  <ChevronDown className="h-3 w-3 ml-auto text-muted-foreground group-data-[state=open]:rotate-180 transition-transform" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <pre className="text-[10px] text-muted-foreground bg-muted/30 rounded p-2 ml-5 overflow-x-auto max-h-40">
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
