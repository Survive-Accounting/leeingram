import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BATCH_SIZE = 5;

/** Operations that delegate to existing edge functions (need only asset id) */
const DELEGATED_OPS: Record<string, { fn: string; bodyFn: (assetId: string) => any; skipCheck?: (sb: any, assetId: string) => Promise<boolean> }> = {
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
  },
  generate_flowcharts: {
    fn: "generate-flowchart",
    bodyFn: (id) => ({ teaching_asset_id: id }),
    skipCheck: async (sb, id) => {
      const { data } = await sb.from("asset_flowcharts").select("id").eq("teaching_asset_id", id).limit(1);
      return (data && data.length > 0);
    },
  },
  generate_dissector_highlights: {
    fn: "generate-dissector-highlights",
    bodyFn: (id) => ({ teaching_asset_id: id }),
    skipCheck: async (sb, id) => {
      const { data } = await sb.from("dissector_problems").select("id").eq("teaching_asset_id", id).limit(1);
      return (data && data.length > 0);
    },
  },
  enrich_je_rows: {
    fn: "rewrite-je-tooltips",
    bodyFn: (id) => ({ teaching_asset_id: id, mode: "enrich" }),
  },
};

/**
 * Server-side bulk fix queue processor.
 * Self-chains to process all queue items without needing a browser open.
 * 
 * Flow:
 * 1. Find current running item OR pick next pending item
 * 2. Query teaching_assets matching the item's scope
 * 3. Process assets in batches, calling the relevant edge function
 * 4. Update progress in bulk_fix_queue
 * 5. On completion, send summary email
 * 6. Self-chain to process next item
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    // 1. Find the current item to process
    let { data: currentItems } = await sb
      .from("bulk_fix_queue")
      .select("*")
      .eq("status", "running")
      .order("queue_position", { ascending: true })
      .limit(1);

    let currentItem = currentItems?.[0];
    let isNewItem = false;

    if (!currentItem) {
      // Pick next pending
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
      isNewItem = true;

      // Mark as running
      await sb.from("bulk_fix_queue").update({
        status: "running",
        started_at: new Date().toISOString(),
      }).eq("id", currentItem.id);
    }

    const opKey = currentItem.operation_key;
    const handler = DELEGATED_OPS[opKey];

    if (!handler) {
      await sb.from("bulk_fix_queue").update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_summary: `Unsupported server-side operation: ${opKey}`,
      }).eq("id", currentItem.id);
      // Self-chain for remaining
      selfChain(supabaseUrl, serviceKey);
      return new Response(JSON.stringify({ error: `Unsupported operation: ${opKey}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Query assets matching scope
    const needsJeJson = ["rewrite_je_reasons", "rewrite_je_amounts", "enrich_je_tooltips", "enrich_je_rows"].includes(opKey);
    let query = sb.from("teaching_assets").select("id, asset_name");

    if (currentItem.scope_course_id) {
      query = query.eq("course_id", currentItem.scope_course_id);
    }
    if (currentItem.scope_chapter_id) {
      query = query.eq("chapter_id", currentItem.scope_chapter_id);
    }
    const scopeStatus = currentItem.scope_status_filter || "approved";
    if (scopeStatus === "approved") {
      query = query.not("asset_approved_at", "is", null);
    } else if (scopeStatus === "core") {
      query = query.not("core_rank", "is", null);
    }
    if (needsJeJson) {
      query = query.not("journal_entry_completed_json", "is", null);
    }

    const { data: assets, error: queryErr } = await query.order("asset_name", { ascending: true });
    if (queryErr) throw new Error("Failed to query assets: " + queryErr.message);

    const total = assets?.length || 0;
    const offset = currentItem.assets_processed || 0;

    if (total === 0 || offset >= total) {
      // Nothing to process — mark complete
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

    // 3. Process one batch from offset
    let succeeded = currentItem.assets_succeeded || 0;
    let errored = currentItem.assets_errored || 0;
    let skipped = currentItem.assets_skipped || 0;
    let processed = offset;
    let creditExhausted = false;

    const batchEnd = Math.min(offset + BATCH_SIZE, total);
    const batch = assets!.slice(offset, batchEnd);

    console.log(`[${currentItem.operation_name}] Processing batch ${offset + 1}-${batchEnd} of ${total}`);

    for (const asset of batch) {
      if (creditExhausted) { skipped++; processed++; continue; }

      try {
        // Check skip condition
        if (handler.skipCheck && await handler.skipCheck(sb, asset.id)) {
          skipped++;
          processed++;
          continue;
        }

        const res = await fetch(`${supabaseUrl}/functions/v1/${handler.fn}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(handler.bodyFn(asset.id)),
        });

        const result = await res.json();
        if (!res.ok || result.error) {
          const errMsg = result.error || `HTTP ${res.status}`;
          console.error(`✗ ${asset.asset_name}: ${errMsg}`);
          // Detect credit exhaustion — stop wasting calls
          if (res.status === 500 && typeof errMsg === "string" && (errMsg.includes("402") || errMsg.includes("payment_required") || errMsg.includes("Not enough credits"))) {
            creditExhausted = true;
            console.error("Credit exhaustion detected — pausing queue");
          }
          errored++;
        } else if (result.skipped) {
          skipped++;
        } else {
          succeeded++;
        }
      } catch (e: any) {
        console.error(`✗ ${asset.asset_name}: ${e.message}`);
        errored++;
      }
      processed++;
      // Small delay between assets to avoid rate limiting
      if (processed < batchEnd) await new Promise(r => setTimeout(r, 500));
    }

    // 4. Update progress
    const isComplete = processed >= total || creditExhausted;
    const finalStatus = creditExhausted ? "failed" : (isComplete ? "complete" : "running");

    await sb.from("bulk_fix_queue").update({
      status: finalStatus,
      completed_at: isComplete ? new Date().toISOString() : null,
      assets_processed: processed,
      assets_succeeded: succeeded,
      assets_errored: errored,
      assets_skipped: skipped,
      error_summary: creditExhausted ? "Stopped: AI credits exhausted (402). Resume when credits are available." : null,
    }).eq("id", currentItem.id);

    // 5. If complete, send email and chain to next
    if (isComplete && !creditExhausted) {
      console.log(`✓ ${currentItem.operation_name} complete: ${succeeded} ok, ${errored} errors, ${skipped} skipped`);
      await sendOperationEmail(sb, supabaseUrl, serviceKey, currentItem, processed, succeeded, errored, skipped);
    }

    // 6. Self-chain (unless credit exhausted — no point burning more calls)
    if (!creditExhausted) {
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
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("process-bulk-fix-queue error:", err);
    // Still self-chain on error so the queue doesn't permanently stall
    selfChain(supabaseUrl, serviceKey);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function selfChain(supabaseUrl: string, serviceKey: string) {
  // Fire immediately — no setTimeout; Deno runtime may terminate before delayed callbacks fire
  fetch(`${supabaseUrl}/functions/v1/process-bulk-fix-queue`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  }).catch(e => console.error("Self-chain failed:", e));
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
