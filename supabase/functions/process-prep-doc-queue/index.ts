import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BATCH_SIZE = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth: only allow service-role or authenticated users
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
      .from("prep_doc_queue")
      .select("id, teaching_asset_id, batch_id")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchErr) throw fetchErr;
    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ processed: 0, done: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing ${items.length} queued prep docs...`);
    let successCount = 0;
    let failCount = 0;

    for (const item of items) {
      // Mark as processing
      await sb.from("prep_doc_queue")
        .update({ status: "processing", started_at: new Date().toISOString() })
        .eq("id", item.id);

      try {
        // Call the existing create-prep-doc function via HTTP
        const res = await fetch(`${supabaseUrl}/functions/v1/create-prep-doc`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ teaching_asset_id: item.teaching_asset_id }),
        });

        const result = await res.json();
        if (!res.ok || result.error) {
          throw new Error(result.error || `HTTP ${res.status}`);
        }

        await sb.from("prep_doc_queue")
          .update({ status: "done", completed_at: new Date().toISOString(), error: null })
          .eq("id", item.id);
        successCount++;
        console.log(`✓ ${item.teaching_asset_id}`);
      } catch (err: any) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await sb.from("prep_doc_queue")
          .update({ status: "failed", completed_at: new Date().toISOString(), error: errMsg })
          .eq("id", item.id);
        failCount++;
        console.error(`✗ ${item.teaching_asset_id}: ${errMsg}`);
      }
    }

    // Check if there are more queued items
    const { count } = await sb
      .from("prep_doc_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "queued");

    const remaining = count ?? 0;

    // Self-chain: if more items remain, invoke self again after a brief pause
    if (remaining > 0) {
      console.log(`${remaining} items remaining — self-chaining...`);
      // Fire-and-forget: don't await, let this response return immediately
      fetch(`${supabaseUrl}/functions/v1/process-prep-doc-queue`, {
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
    console.error("process-prep-doc-queue error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
