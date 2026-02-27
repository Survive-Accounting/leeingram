import { supabase } from "@/integrations/supabase/client";

type ActorType = "user" | "system" | "ai";
type EntityType = "source_problem" | "lw_item" | "export_job" | "topic" | "chapter";
type Severity = "info" | "warn" | "error";

interface LogEntry {
  actor_type: ActorType;
  actor_id?: string | null;
  entity_type: EntityType;
  entity_id: string;
  event_type: string;
  payload_json?: Record<string, any>;
  severity?: Severity;
}

export async function logActivity(entry: LogEntry): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("activity_log").insert({
      actor_type: entry.actor_type,
      actor_id: entry.actor_id ?? user?.id ?? null,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      event_type: entry.event_type,
      payload_json: entry.payload_json ?? {},
      severity: entry.severity ?? "info",
    } as any);
  } catch (e) {
    console.error("Activity log failed:", e);
  }
}
