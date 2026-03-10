import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { password, dry_run = true } = await req.json();

    // Password gate
    if (password !== "Stax420!#") {
      return new Response(JSON.stringify({ error: "Invalid password" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceRoleKey);

    // ── Gather counts ──
    const { count: variantsActive } = await sb
      .from("problem_variants")
      .select("*", { count: "exact", head: true })
      .neq("variant_status", "archived");

    const { count: assetsTotal } = await sb
      .from("teaching_assets")
      .select("*", { count: "exact", head: true });

    const { count: assetsWithSheets } = await sb
      .from("teaching_assets")
      .select("*", { count: "exact", head: true })
      .or("google_sheet_url.not.is.null,sheet_master_url.not.is.null");

    const { count: problemsBeyondImport } = await sb
      .from("chapter_problems")
      .select("*", { count: "exact", head: true })
      .neq("pipeline_status", "imported");

    const summary = {
      variants_to_archive: variantsActive ?? 0,
      teaching_assets_to_archive: assetsTotal ?? 0,
      sheet_links_to_clear: assetsWithSheets ?? 0,
      source_problems_to_reset: problemsBeyondImport ?? 0,
    };

    if (dry_run) {
      return new Response(
        JSON.stringify({ dry_run: true, summary }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Execute reset ──
    const errors: string[] = [];

    // 1. Archive active variants
    const { error: e1 } = await sb
      .from("problem_variants")
      .update({ variant_status: "archived" })
      .neq("variant_status", "archived");
    if (e1) errors.push(`Archive variants: ${e1.message}`);

    // 2. Delete teaching assets (archive = delete from table; source data on chapter_problems is preserved)
    // Actually, the user said "archive" not delete. There's no archived column on teaching_assets.
    // We'll clear the pipeline-output fields and soft-delete by setting a tag.
    // Simplest: delete teaching_assets since all source data lives on chapter_problems.
    // The user said "do not delete" — but there's no archive flag column.
    // Let's add a google_sheet_status = 'archived' and clear sheet URLs.
    const { error: e2 } = await sb
      .from("teaching_assets")
      .update({
        google_sheet_status: "archived",
        google_sheet_url: null,
        google_sheet_file_id: null,
        sheet_master_url: null,
        sheet_practice_url: null,
        sheet_promo_url: null,
        sheet_path_url: null,
        sheet_last_synced_at: null,
        sheet_template_version: null,
      })
      .neq("id", "00000000-0000-0000-0000-000000000000"); // match all
    if (e2) errors.push(`Archive teaching assets: ${e2.message}`);

    // 3. Reset chapter_problems pipeline_status back to 'imported'
    const { error: e3 } = await sb
      .from("chapter_problems")
      .update({ pipeline_status: "imported" })
      .neq("pipeline_status", "imported");
    if (e3) errors.push(`Reset pipeline status: ${e3.message}`);

    // 4. Log the reset event
    const { error: e4 } = await sb.from("activity_log").insert({
      entity_id: "00000000-0000-0000-0000-000000000000",
      entity_type: "system",
      event_type: "pipeline_reset",
      message: `Pipeline Reset Performed. Archived ${summary.variants_to_archive} variants, ${summary.teaching_assets_to_archive} teaching assets, cleared ${summary.sheet_links_to_clear} sheet links, reset ${summary.source_problems_to_reset} source problems.`,
      severity: "warn",
      payload_json: summary,
    });
    if (e4) errors.push(`Log entry: ${e4.message}`);

    return new Response(
      JSON.stringify({
        dry_run: false,
        summary,
        errors: errors.length ? errors : null,
        success: errors.length === 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
