import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { course_id, chapter_id, source_problem_ids, variant_count = 1, provider = "lovable" } = await req.json();

    if (!course_id || !chapter_id || !Array.isArray(source_problem_ids) || source_problem_ids.length === 0) {
      throw new Error("Missing required fields: course_id, chapter_id, source_problem_ids[]");
    }

    // Get user id from auth header
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const { data: { user } } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
      userId = user?.id ?? null;
    }

    // ── Soft-reset: clear stale state from any previous failed generation ──
    // 1. Delete orphan draft variants for these source problems (from partial failures)
    const { data: orphanVariants } = await sb.from("problem_variants")
      .select("id")
      .in("base_problem_id", source_problem_ids)
      .eq("variant_status", "draft");
    if (orphanVariants && orphanVariants.length > 0) {
      const orphanIds = orphanVariants.map((v: any) => v.id);
      await sb.from("problem_variants").delete().in("id", orphanIds);
      console.log(`[soft-reset] Cleared ${orphanIds.length} orphan draft variant(s) before new batch`);
    }

    // 2. Reset source problems that are stuck in 'generated' status back to 'ready'
    //    (happens when a previous batch partially succeeded but the user wants to re-generate)
    await sb.from("chapter_problems")
      .update({ status: "ready", pipeline_status: "imported" })
      .in("id", source_problem_ids)
      .eq("status", "generated");

    // Create batch run
    const { data: run, error: runErr } = await sb.from("chapter_batch_runs").insert({
      course_id,
      chapter_id,
      created_by_user_id: userId,
      status: "draft",
      variant_count,
      provider,
      total_sources: source_problem_ids.length,
    }).select("id").single();

    if (runErr) throw runErr;

    // Insert items
    const items = source_problem_ids.map((spId: string, idx: number) => ({
      batch_run_id: run.id,
      source_problem_id: spId,
      seq: idx + 1,
      status: "queued",
    }));

    const { error: itemsErr } = await sb.from("chapter_batch_run_items").insert(items);
    if (itemsErr) throw itemsErr;

    return new Response(JSON.stringify({ batch_run_id: run.id, total: source_problem_ids.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
