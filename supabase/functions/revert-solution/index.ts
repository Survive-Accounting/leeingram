// Edge function: revert-solution
// Reverts AI-regenerated solutions back to their snapshotted originals.
// Supports two modes:
//   1. Single asset:  { asset_id: string }
//   2. Whole run:     { chapter_run_id: string }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { asset_id, chapter_run_id } = body || {};

  if (!asset_id && !chapter_run_id) {
    return new Response(
      JSON.stringify({ error: "asset_id or chapter_run_id is required" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Build filter
  const filter = asset_id
    ? `id=eq.${asset_id}`
    : `ai_chapter_run_id=eq.${encodeURIComponent(chapter_run_id)}`;

  try {
    // Fetch matching assets that have a snapshot
    const fetchUrl =
      `${SUPABASE_URL}/rest/v1/teaching_assets?${filter}&select=id,survive_solution_text_original`;
    const r = await fetch(fetchUrl, {
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
      },
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`Fetch failed: ${r.status} ${t.slice(0, 300)}`);
    }
    const rows = await r.json();

    let reverted = 0;
    let skipped = 0;

    for (const row of rows) {
      if (
        row.survive_solution_text_original === null ||
        row.survive_solution_text_original === undefined
      ) {
        skipped++;
        continue;
      }

      const patchRes = await fetch(
        `${SUPABASE_URL}/rest/v1/teaching_assets?id=eq.${row.id}`,
        {
          method: "PATCH",
          headers: {
            apikey: SERVICE_ROLE,
            Authorization: `Bearer ${SERVICE_ROLE}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            survive_solution_text: row.survive_solution_text_original,
            ai_generation_status: "reverted",
          }),
        },
      );

      if (patchRes.ok) {
        reverted++;
      } else {
        skipped++;
        console.error(
          "Revert failed for",
          row.id,
          patchRes.status,
          (await patchRes.text()).slice(0, 200),
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        reverted,
        skipped,
        total: rows.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    console.error("Revert error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err.message ?? err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
