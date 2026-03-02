/**
 * GenerationLogger — creates a generation_run and logs events with sequential ordering.
 * Used by frontend code to instrument every Generate click end-to-end.
 */

import { supabase } from "@/integrations/supabase/client";

export type EventScope = "frontend" | "backend" | "db" | "ai" | "validator";
export type EventLevel = "debug" | "info" | "warn" | "error";

export interface GenerationRunInit {
  course_id?: string;
  chapter_id?: string;
  source_problem_id?: string;
  provider: string;
  model?: string;
}

export class GenerationLogger {
  public runId: string | null = null;
  private seq = 0;
  private startTime = Date.now();
  private events: Array<{
    seq: number;
    scope: EventScope;
    level: EventLevel;
    event_type: string;
    message: string;
    payload_json?: any;
    created_at: string;
  }> = [];
  private init: GenerationRunInit;

  constructor(init: GenerationRunInit) {
    this.init = init;
  }

  /** Create the run row in DB and return the run_id */
  async start(): Promise<string> {
    this.startTime = Date.now();
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("generation_runs" as any)
      .insert({
        user_id: user?.id ?? null,
        course_id: this.init.course_id ?? null,
        chapter_id: this.init.chapter_id ?? null,
        source_problem_id: this.init.source_problem_id ?? null,
        provider: this.init.provider,
        model: this.init.model ?? null,
        status: "started",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to create generation_run:", error);
      throw new Error(`Failed to create generation run: ${error.message}`);
    }

    this.runId = (data as any).id;
    return this.runId!;
  }

  /** Log a single event */
  async log(
    scope: EventScope,
    level: EventLevel,
    event_type: string,
    message: string,
    payload?: any
  ): Promise<void> {
    this.seq++;
    const evt = {
      seq: this.seq,
      scope,
      level,
      event_type,
      message,
      payload_json: payload ?? null,
      created_at: new Date().toISOString(),
    };
    this.events.push(evt);

    if (this.runId) {
      try {
        await supabase.from("generation_events" as any).insert({
          run_id: this.runId,
          seq: evt.seq,
          scope: evt.scope,
          level: evt.level,
          event_type: evt.event_type,
          message: evt.message,
          payload_json: evt.payload_json,
        });
      } catch (e) {
        console.error("Failed to log generation event:", e);
      }
    }
  }

  /** Convenience: log info */
  async info(scope: EventScope, event_type: string, message: string, payload?: any) {
    return this.log(scope, "info", event_type, message, payload);
  }

  /** Convenience: log error */
  async error(scope: EventScope, event_type: string, message: string, payload?: any) {
    return this.log(scope, "error", event_type, message, payload);
  }

  /** Convenience: log warn */
  async warn(scope: EventScope, event_type: string, message: string, payload?: any) {
    return this.log(scope, "warn", event_type, message, payload);
  }

  /** Finalize run as success or failed, build debug bundle */
  async finalize(status: "success" | "failed", opts?: {
    variant_id?: string;
    error_summary?: string;
  }): Promise<any> {
    const durationMs = Date.now() - this.startTime;

    const debugBundle = {
      run_id: this.runId,
      status,
      provider: this.init.provider,
      model: this.init.model,
      course_id: this.init.course_id,
      chapter_id: this.init.chapter_id,
      source_problem_id: this.init.source_problem_id,
      variant_id: opts?.variant_id ?? null,
      duration_ms: durationMs,
      error_summary: opts?.error_summary ?? null,
      timeline: this.events,
    };

    if (this.runId) {
      try {
        await supabase.from("generation_runs" as any).update({
          status,
          duration_ms: durationMs,
          variant_id: opts?.variant_id ?? null,
          error_summary: opts?.error_summary ?? null,
          debug_bundle_json: debugBundle,
        }).eq("id", this.runId);
      } catch (e) {
        console.error("Failed to finalize generation_run:", e);
      }
    }

    return debugBundle;
  }

  /** Get current events for in-memory access */
  getEvents() {
    return this.events;
  }
}
