import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BATCH_SIZE = 5;
const ASSET_REQUEST_TIMEOUT_MS = 35000;
const MAX_INVOCATION_MS = 50000;
const INTER_ASSET_DELAY_MS = 500;

type QueueHandler = {
  fn: string;
  bodyFn: (assetId: string, model?: string) => Record<string, unknown>;
  skipCheck?: (sb: any, assetId: string) => Promise<boolean>;
};

type DelegatedOperationResult = {
  ok: boolean;
  status: number;
  skipped?: boolean;
  error?: string;
};

/** Operations that delegate to existing edge functions (need only asset id) */
const DELEGATED_OPS: Record<string, QueueHandler> = {
  rewrite_je_reasons: {
    fn: "rewrite-je-tooltips",
    bodyFn: (id) => ({ teaching_asset_id: id, mode: "rewrite_reasons" }),
  },
  rewrite_je_amounts: {
    fn: "rewrite-je-tooltips",
    bodyFn: (id) => ({ teaching_asset_id: id, mode: "rewrite_amounts" }),
  },
  enrich_je_tooltips: {
    fn: "rewrite-je-tooltips",
    bodyFn: (id) => ({ teaching_asset_id: id, mode: "enrich" }),
  },
  generate_supplementary_je: {
    fn: "generate-supplementary-je",
    bodyFn: (id) => ({ teaching_asset_id: id }),
    skipCheck: async (sb, id) => {
      const { data } = await sb
        .from("teaching_assets")
        .select("journal_entry_completed_json, supplementary_je_json")
        .eq("id", id)
        .single();
      // Skip if no primary JE exists OR supplementary already generated
      return !data?.journal_entry_completed_json || !!data?.supplementary_je_json;
    },
  },
  generate_worked_steps: {
    fn: "generate-worked-steps",
    bodyFn: (id) => ({ teaching_asset_id: id }),
    skipCheck: async (sb, id) => {
      const { data } = await sb.from("teaching_assets").select("worked_steps").eq("id", id).single();
      return !!(data?.worked_steps?.trim());
    },
  },
  generate_flowcharts: {
    fn: "generate-flowchart",
    bodyFn: (id) => ({ teaching_asset_id: id }),
    skipCheck: async (sb, id) => {
      const { data } = await sb.from("asset_flowcharts").select("id").eq("teaching_asset_id", id).limit(1);
      return !!(data && data.length > 0);
    },
  },
  generate_dissector_highlights: {
    fn: "generate-dissector-highlights",
    bodyFn: (id) => ({ teaching_asset_id: id }),
    skipCheck: async (sb, id) => {
      const { data } = await sb.from("dissector_problems").select("id").eq("teaching_asset_id", id).limit(1);
      return !!(data && data.length > 0);
    },
  },
  enrich_je_rows: {
    fn: "rewrite-je-tooltips",
    bodyFn: (id) => ({ teaching_asset_id: id, mode: "enrich" }),
  },
  generate_calculation_formulas: {
    fn: "rewrite-je-tooltips",
    bodyFn: (id) => ({ teaching_asset_id: id, mode: "generate_formulas" }),
    skipCheck: async (sb, id) => {
      const { data } = await sb.from("teaching_assets").select("journal_entry_completed_json").eq("id", id).single();
      if (!data?.journal_entry_completed_json) return true;
      const json = JSON.stringify(data.journal_entry_completed_json);
      return json.includes("calculation_formula");
    },
  },
  standardize_formatting: {
    fn: "standardize-formatting",
    bodyFn: (id, model) => ({ teaching_asset_id: id, model: model || "sonnet" }),
    skipCheck: async (sb, id) => {
      const { data } = await sb.from("teaching_assets").select("survive_solution_text").eq("id", id).single();
      return !data?.survive_solution_text?.trim();
    },
  },
  remove_ai_thinking: {
    fn: "remove-ai-thinking",
    bodyFn: (id) => ({ teaching_asset_id: id }),
    skipCheck: async (sb, id) => {
      const { data } = await sb.from("teaching_assets").select("survive_solution_text").eq("id", id).single();
      return !data?.survive_solution_text?.trim();
    },
  },
  remove_duplicates: {
    fn: "remove-duplicates",
    bodyFn: (id) => ({ teaching_asset_id: id }),
    skipCheck: async (sb, id) => {
      const { data } = await sb.from("teaching_assets").select("survive_solution_text").eq("id", id).single();
      return !data?.survive_solution_text?.trim();
    },
  },
};

/**
 * Server-side bulk fix queue processor.
 * Self-chains to process all queue items without needing a browser open.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);
  const invocationStartedAt = Date.now();
  let currentItem: any = null;

  try {
    const { data: currentItems } = await sb
      .from("bulk_fix_queue")
      .select("*")
      .eq("status", "running")
      .order("queue_position", { ascending: true })
      .limit(1);

    currentItem = currentItems?.[0];

    if (!currentItem) {
      const { data: pendingItems } = await sb
        .from("bulk_fix_queue")
        .select("*")
        .eq("status", "pending")
        .order("queue_position", { ascending: true })
        .limit(1);

      if (!pendingItems?.length) {
        return new Response(JSON.stringify({ done: true, message: "Queue empty" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      currentItem = pendingItems[0];

      await sb.from("bulk_fix_queue").update({
        status: "running",
        started_at: new Date().toISOString(),
        completed_at: null,
        error_summary: null,
      }).eq("id", currentItem.id);
    }

    const opKey = currentItem.operation_key;
    const queueModel = currentItem.model || "sonnet";
    const handler = DELEGATED_OPS[opKey];

    if (!handler) {
      await sb.from("bulk_fix_queue").update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_summary: `Unsupported server-side operation: ${opKey}`,
      }).eq("id", currentItem.id);
      selfChain(supabaseUrl, serviceKey);
      return new Response(JSON.stringify({ error: `Unsupported operation: ${opKey}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const needsJeJson = ["rewrite_je_reasons", "rewrite_je_amounts", "enrich_je_tooltips", "enrich_je_rows", "generate_calculation_formulas"].includes(opKey);

    // Paginated fetch to avoid Supabase 1000-row default limit
    const PAGE_SIZE = 1000;
    let allAssets: any[] = [];
    let from = 0;

    while (true) {
      let query = sb
        .from("teaching_assets")
        .select("id, asset_name")
        .order("asset_name", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (currentItem.scope_course_id) query = query.eq("course_id", currentItem.scope_course_id);
      if (currentItem.scope_chapter_id) query = query.eq("chapter_id", currentItem.scope_chapter_id);

      const scopeStatus = currentItem.scope_status_filter || "approved";
      if (scopeStatus === "approved") {
        query = query.not("asset_approved_at", "is", null);
      } else if (scopeStatus === "core") {
        query = query.not("core_rank", "is", null);
      }
      if (needsJeJson) {
        query = query.not("journal_entry_completed_json", "is", null);
      }

      const { data, error: queryErr } = await query;
      if (queryErr) throw new Error(`Asset query failed: ${queryErr.message}`);
      if (!data || data.length === 0) break;

      allAssets.push(...data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    const assets = allAssets;
    const total = assets.length;
    const offset = currentItem.assets_processed || 0;

    if (total === 0 || offset >= total) {
      await sb.from("bulk_fix_queue").update({
        status: "complete",
        completed_at: new Date().toISOString(),
        assets_processed: total,
        assets_skipped: total,
      }).eq("id", currentItem.id);

      await sendOperationEmail(sb, supabaseUrl, serviceKey, currentItem, total, 0, 0, total);
      selfChain(supabaseUrl, serviceKey);

      return new Response(JSON.stringify({ done: true, item: currentItem.operation_name, total: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let succeeded = currentItem.assets_succeeded || 0;
    let errored = currentItem.assets_errored || 0;
    let skipped = currentItem.assets_skipped || 0;
    let processed = offset;
    let creditExhausted = false;
    let stoppedForTime = false;

    const batchEnd = Math.min(offset + BATCH_SIZE, total);
    const batch = assets!.slice(offset, batchEnd);

    console.log(`[${currentItem.operation_name}] Processing batch ${offset + 1}-${batchEnd} of ${total}`);

    for (const asset of batch) {
      // Check if item was cancelled
      const { data: freshItem } = await sb.from("bulk_fix_queue").select("status").eq("id", currentItem.id).single();
      if (freshItem?.status !== "running") {
        console.log(`[${currentItem.operation_name}] Cancelled — stopping`);
        stoppedForTime = true;
        break;
      }

      if (Date.now() - invocationStartedAt >= MAX_INVOCATION_MS) {
        stoppedForTime = true;
        console.log(`[${currentItem.operation_name}] Stopping early to avoid runtime timeout at ${processed}/${total}`);
        break;
      }

      if (creditExhausted) {
        skipped++;
        processed++;
        await persistQueueProgress(sb, currentItem.id, processed, succeeded, errored, skipped);
        continue;
      }

      try {
        if (handler.skipCheck && await handler.skipCheck(sb, asset.id)) {
          skipped++;
        } else {
          const result = await invokeDelegatedOperation(
            supabaseUrl,
            serviceKey,
            handler.fn,
            handler.bodyFn(asset.id, queueModel),
          );

          if (!result.ok || result.error) {
            const errMsg = result.error || `HTTP ${result.status}`;
            console.error(`✗ ${asset.asset_name}: ${errMsg}`);

            if (
              result.status === 500 &&
              (errMsg.includes("402") || errMsg.includes("payment_required") || errMsg.includes("Not enough credits"))
            ) {
              creditExhausted = true;
              console.error("Credit exhaustion detected — pausing queue");
            }

            errored++;
          } else if (result.skipped) {
            skipped++;
          } else {
            succeeded++;
          }
        }
      } catch (e: any) {
        console.error(`✗ ${asset.asset_name}: ${e.message}`);
        errored++;
      }

      processed++;
      await persistQueueProgress(sb, currentItem.id, processed, succeeded, errored, skipped);

      if (!creditExhausted && processed < batchEnd) {
        await delay(INTER_ASSET_DELAY_MS);
      }
    }

    // Re-check if manually stopped
    const { data: recheckItem } = await sb.from("bulk_fix_queue").select("status").eq("id", currentItem.id).single();
    const manuallyStopped = recheckItem?.status !== "running";

    const isComplete = processed >= total || creditExhausted || manuallyStopped;
    const finalStatus = manuallyStopped ? recheckItem?.status : (creditExhausted ? "failed" : (isComplete ? "complete" : "running"));

    if (!manuallyStopped) {
      await sb.from("bulk_fix_queue").update({
        status: finalStatus,
        completed_at: isComplete ? new Date().toISOString() : null,
        assets_processed: processed,
        assets_succeeded: succeeded,
        assets_errored: errored,
        assets_skipped: skipped,
        error_summary: creditExhausted ? "Stopped: AI credits exhausted (402). Resume when credits are available." : null,
      }).eq("id", currentItem.id);
    }

    if (isComplete && !creditExhausted && !manuallyStopped) {
      console.log(`✓ ${currentItem.operation_name} complete: ${succeeded} ok, ${errored} errors, ${skipped} skipped`);
      await sendOperationEmail(sb, supabaseUrl, serviceKey, currentItem, processed, succeeded, errored, skipped);
    }

    if (!creditExhausted && !manuallyStopped) {
      selfChain(supabaseUrl, serviceKey);
    } else {
      console.log("Stopping self-chain due to credit exhaustion");
    }

    return new Response(JSON.stringify({
      item: currentItem.operation_name,
      processed,
      total,
      succeeded,
      errored,
      skipped,
      complete: isComplete,
      creditExhausted,
      stoppedForTime,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    const message = err?.message || "Unknown error";
    console.error("process-bulk-fix-queue error:", err);

    // Mark the current queue item as failed so it doesn't stay "running" forever
    if (currentItem?.id) {
      try {
        await sb.from("bulk_fix_queue").update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_summary: `Fatal: ${message}`.slice(0, 500),
        }).eq("id", currentItem.id);
      } catch (updateErr) {
        console.error("Failed to mark queue item as failed:", updateErr);
      }
    }

    // Still self-chain to pick up any remaining pending items
    selfChain(supabaseUrl, serviceKey);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function selfChain(supabaseUrl: string, serviceKey: string) {
  fetch(`${supabaseUrl}/functions/v1/process-bulk-fix-queue`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  }).catch((e) => console.error("Self-chain failed:", e));
}

async function invokeDelegatedOperation(
  supabaseUrl: string,
  serviceKey: string,
  functionName: string,
  body: Record<string, unknown>,
): Promise<DelegatedOperationResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ASSET_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const rawBody = await response.text();
    let parsedBody: any = null;

    if (rawBody) {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        parsedBody = { error: rawBody };
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      skipped: parsedBody?.skipped,
      error: parsedBody?.error,
    };
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return {
        ok: false,
        status: 408,
        error: `Timed out after ${ASSET_REQUEST_TIMEOUT_MS}ms`,
      };
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function persistQueueProgress(
  sb: any,
  itemId: string,
  processed: number,
  succeeded: number,
  errored: number,
  skipped: number,
) {
  await sb.from("bulk_fix_queue").update({
    status: "running",
    completed_at: null,
    assets_processed: processed,
    assets_succeeded: succeeded,
    assets_errored: errored,
    assets_skipped: skipped,
  }).eq("id", itemId);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendOperationEmail(
  sb: any,
  supabaseUrl: string,
  serviceKey: string,
  item: any,
  processed: number,
  succeeded: number,
  errored: number,
  skipped: number,
) {
  try {
    // Check for next pending item
    const { data: nextItems } = await sb
      .from("bulk_fix_queue")
      .select("operation_name")
      .eq("status", "pending")
      .order("queue_position", { ascending: true })
      .limit(1);

    const nextName = nextItems?.[0]?.operation_name || null;

    const opData = {
      ...item,
      assets_processed: processed,
      assets_succeeded: succeeded,
      assets_errored: errored,
      assets_skipped: skipped,
      completed_at: new Date().toISOString(),
    };

    // Send per-operation email
    await fetch(`${supabaseUrl}/functions/v1/send-bulk-fix-summary`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "operation_complete",
        operation: opData,
        next_in_queue: nextName,
      }),
    });

    // If no next item, also send queue-complete summary
    if (!nextName) {
      const { data: allCompleted } = await sb
        .from("bulk_fix_queue")
        .select("*")
        .eq("status", "complete")
        .order("queue_position", { ascending: true });

      if (allCompleted?.length) {
        await fetch(`${supabaseUrl}/functions/v1/send-bulk-fix-summary`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "queue_complete",
            operations: allCompleted,
          }),
        });
      }
    }
  } catch (e) {
    console.error("Failed to send summary email:", e);
  }
}
