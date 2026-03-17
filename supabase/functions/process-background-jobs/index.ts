import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BATCH_SIZE = 10;

// Maps job_type → edge function name + how to build the request body from payload
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
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth: allow service-role or authenticated users
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

    // Grab next batch of queued items (oldest first)
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

    console.log(`Processing ${items.length} background jobs...`);
    let successCount = 0;
    let failCount = 0;

    for (const item of items) {
      const handler = JOB_HANDLERS[item.job_type];
      if (!handler) {
        await sb.from("background_jobs")
          .update({ status: "failed", completed_at: new Date().toISOString(), error: `Unknown job_type: ${item.job_type}` })
          .eq("id", item.id);
        failCount++;
        continue;
      }

      // Mark as processing
      await sb.from("background_jobs")
        .update({ status: "processing", started_at: new Date().toISOString() })
        .eq("id", item.id);

      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/${handler.fn}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(handler.body(item.payload)),
        });

        const result = await res.json();
        if (!res.ok || result.error) {
          throw new Error(result.error || `HTTP ${res.status}`);
        }

        await sb.from("background_jobs")
          .update({ status: "done", completed_at: new Date().toISOString(), error: null })
          .eq("id", item.id);
        successCount++;
        console.log(`✓ ${item.job_type} ${item.id}`);
      } catch (err: any) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await sb.from("background_jobs")
          .update({ status: "failed", completed_at: new Date().toISOString(), error: errMsg })
          .eq("id", item.id);
        failCount++;
        console.error(`✗ ${item.job_type} ${item.id}: ${errMsg}`);
      }
    }

    // Check remaining
    const { count } = await sb
      .from("background_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "queued");

    const remaining = count ?? 0;

    // Self-chain if more items remain
    if (remaining > 0) {
      console.log(`${remaining} items remaining — self-chaining...`);
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
      success: successCount,
      failed: failCount,
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
