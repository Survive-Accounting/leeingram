// Batch-generate you-format rewrites for all eligible assets in a chapter.
// Processes in serial chunks of 5 with small delay to avoid rate limits.
// Returns counts: processed / generated / failed / skipped.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { chapter_id, force, limit } = await req.json();
    if (!chapter_id) throw new Error("chapter_id is required");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    let q = sb
      .from("teaching_assets")
      .select("id, you_format_status")
      .eq("chapter_id", chapter_id);

    if (!force) {
      q = q.in("you_format_status", ["pending", "failed"]);
    }

    const { data: assets, error } = await q.limit(limit ?? 500);
    if (error) throw new Error(error.message);

    const ids = (assets ?? []).map((a) => a.id);
    const counts = { processed: 0, generated: 0, failed: 0, skipped: 0, errors: [] as string[] };

    const CHUNK = 5;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const results = await Promise.all(
        chunk.map(async (id) => {
          try {
            const r = await fetch(`${SUPABASE_URL}/functions/v1/you-format-rewrite`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${SERVICE_ROLE}`,
              },
              body: JSON.stringify({ asset_id: id, force: !!force }),
            });
            const json = await r.json();
            return { id, ok: r.ok, json };
          } catch (e) {
            return { id, ok: false, json: { error: String(e) } };
          }
        }),
      );

      for (const r of results) {
        counts.processed++;
        if (!r.ok) {
          counts.failed++;
          counts.errors.push(`${r.id}: ${r.json?.error ?? "unknown"}`);
        } else if (r.json?.skipped) {
          counts.skipped++;
        } else if (r.json?.status === "generated") {
          counts.generated++;
        } else if (r.json?.status === "failed") {
          counts.failed++;
        }
      }

      if (i + CHUNK < ids.length) await sleep(500);
    }

    return new Response(JSON.stringify({ success: true, total: ids.length, ...counts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("you-format-batch error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
