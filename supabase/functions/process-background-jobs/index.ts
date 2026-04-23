import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BATCH_SIZE = 10;
// Per-job-type rate-limit config to stay under OpenAI TPM caps.
// o3 has a 30,000 TPM limit; ~1,500 tokens/request → ~20 req/min theoretical max.
// We dispatch SERIALLY (await each child) and pace at ~12 req/min (5s between)
// to stay safely under the cap even with bursty token usage.
const JOB_DISPATCH_DELAY_MS: Record<string, number> = {
  regenerate_solution: 5000,
};
const DEFAULT_DISPATCH_DELAY_MS = 0;
const SELF_CHAIN_DELAY_MS = 2000;
const MAX_RETRIES = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const JOB_HANDLERS: Record<string, { fn: string; body: (p: any) => any }> = {
  prep_doc: {
    fn: "create-prep-doc",
    body: (p) => ({ teaching_asset_id: p.teaching_asset_id }),
  },
  whiteboard: {
    fn: "create-asset-sheet",
    body: (p) => ({ asset_id: p.teaching_asset_id, sheet_types: ["master"] }),
  },
  filming_slides: {
    fn: "create-test-slide",
    body: (p) => ({ teaching_asset_id: p.teaching_asset_id }),
  },
  bank_mc: {
    fn: "bank-teaching-asset",
    body: (p) => ({
      teaching_asset_id: p.teaching_asset_id,
      asset_name: p.asset_name,
      problem_text: p.problem_text,
      solution_text: p.solution_text,
      journal_entry_block: p.journal_entry_block,
      difficulty: p.difficulty,
    }),
  },
  regenerate_solution: {
    fn: "regenerate-solution",
    body: (p) => ({
      asset_id: p.asset_id,
      chapter_run_id: p.chapter_run_id,
      dry_run: p.dry_run ?? false,
    }),
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;
    if (!isServiceRole) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const sb = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data, error } = await sb.auth.getUser(token);
      if (error || !data?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const sb = createClient(supabaseUrl, serviceRoleKey);

    const { data: items, error: fetchErr } = await sb
      .from("background_jobs")
      .select("id, job_type, payload, batch_id")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchErr) throw fetchErr;
    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ processed: 0, done: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Dispatching ${items.length} background jobs (fire-and-forget)...`);

    // Mark all as processing up-front
    const itemIds = items.map((i) => i.id);
    await sb.from("background_jobs")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .in("id", itemIds);

    // Dispatch SERIALLY — await each child before starting the next. This (combined
    // with the per-job delay) guarantees we never have more than one OpenAI request
    // in flight per worker, keeping us well under the TPM cap. On 429, we re-queue
    // the job (up to MAX_RETRIES) so transient rate limits self-heal overnight.
    let dispatched = 0;
    let invalidCount = 0;
    let retriedCount = 0;

    for (const item of items) {
      const handler = JOB_HANDLERS[item.job_type];
      if (!handler) {
        invalidCount++;
        await sb.from("background_jobs")
          .update({ status: "failed", completed_at: new Date().toISOString(), error: `Unknown job_type: ${item.job_type}` })
          .eq("id", item.id);
        continue;
      }

      let ok = false;
      let errMsg: string | null = null;
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/${handler.fn}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(handler.body(item.payload)),
        });
        ok = res.ok;
        try {
          const result = await res.json();
          if (!res.ok || result?.error) {
            ok = false;
            errMsg = result?.error || `HTTP ${res.status}`;
          }
        } catch {
          if (!res.ok) errMsg = `HTTP ${res.status}`;
        }
      } catch (err) {
        ok = false;
        errMsg = err instanceof Error ? err.message : String(err);
      }

      // Retry on 429 (rate limit) up to MAX_RETRIES by re-queuing the job
      const is429 = !!errMsg && /\b429\b|rate[_ ]limit/i.test(errMsg);
      const retryCount = Number(item.payload?._retry_count ?? 0);
      if (!ok && is429 && retryCount < MAX_RETRIES) {
        const newPayload = { ...item.payload, _retry_count: retryCount + 1 };
        await sb.from("background_jobs")
          .update({
            status: "queued",
            started_at: null,
            completed_at: null,
            error: `retry ${retryCount + 1}/${MAX_RETRIES}: ${errMsg?.slice(0, 200)}`,
            payload: newPayload,
          })
          .eq("id", item.id);
        retriedCount++;
        console.log(`↻ ${item.job_type} ${item.id} — re-queued (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      } else {
        await sb.from("background_jobs")
          .update({
            status: ok ? "done" : "failed",
            completed_at: new Date().toISOString(),
            error: errMsg,
          })
          .eq("id", item.id);
        console.log(`${ok ? "✓" : "✗"} ${item.job_type} ${item.id}${errMsg ? ": " + errMsg : ""}`);
      }
      dispatched++;

      // Pace dispatches per job_type to respect upstream API rate limits.
      const delay = JOB_DISPATCH_DELAY_MS[item.job_type] ?? DEFAULT_DISPATCH_DELAY_MS;
      if (delay > 0) await sleep(delay);
    }

    const { count } = await sb
      .from("background_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "queued");

    const remaining = count ?? 0;

    if (remaining > 0) {
      console.log(`${remaining} items remaining — self-chaining in ${SELF_CHAIN_DELAY_MS}ms...`);
      // Small gap before re-invoking so we don't pile dispatcher invocations on top of each other.
      await sleep(SELF_CHAIN_DELAY_MS);
      fetch(`${supabaseUrl}/functions/v1/process-background-jobs`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }).catch(e => console.error("Self-chain failed:", e));
    }

    return new Response(JSON.stringify({
      processed: items.length,
      dispatched,
      invalid: invalidCount,
      retried: retriedCount,
      remaining,
      done: remaining === 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("process-background-jobs error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
