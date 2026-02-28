import { supabase } from "@/integrations/supabase/client";

type ActorType = "user" | "system" | "ai";
type EntityType = "source_problem" | "lw_item" | "export_job" | "topic" | "chapter" | "variant" | "answer_package";
type Severity = "info" | "warn" | "error";

interface LogEntry {
  actor_type: ActorType;
  actor_id?: string | null;
  entity_type: EntityType;
  entity_id: string;
  event_type: string;
  payload_json?: Record<string, any>;
  severity?: Severity;
  /** AI provider name (e.g. "openai", "lovable") */
  provider?: string;
  /** AI model name */
  model?: string;
  /** Duration in milliseconds */
  duration_ms?: number;
  /** Human-readable summary message */
  message?: string;
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
      provider: entry.provider ?? "",
      model: entry.model ?? "",
      duration_ms: entry.duration_ms ?? null,
      message: entry.message ?? "",
    } as any);
  } catch (e) {
    console.error("Activity log failed:", e);
  }
}
