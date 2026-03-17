import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    const { chapter_id } = await req.json();
    if (!chapter_id) throw new Error("Missing chapter_id");

    // 1. Fetch chapter info
    const { data: chapter, error: chErr } = await sb
      .from("chapters")
      .select("id, chapter_number, course_id")
      .eq("id", chapter_id)
      .single();
    if (chErr || !chapter) throw new Error("Chapter not found: " + (chErr?.message ?? ""));

    // 2. Fetch approved teaching assets with important_formulas
    const { data: assets, error: aErr } = await sb
      .from("teaching_assets")
      .select("id, asset_name, important_formulas")
      .eq("chapter_id", chapter_id)
      .not("asset_approved_at", "is", null);

    if (aErr) throw new Error("Failed to fetch assets: " + aErr.message);
    if (!assets || assets.length === 0) throw new Error("No approved assets found for this chapter");

    // 3. Parse formulas from each asset
    const seen = new Map<string, { formula_name: string; formula_text: string; hint: string; source_asset_id: string }>();

    for (const asset of assets as any[]) {
      const raw = asset.important_formulas;
      if (!raw || typeof raw !== "string") continue;

      const lines = raw.split(/\n/).map((l: string) => l.trim()).filter((l: string) => l.length > 0);

      for (const line of lines) {
        if (!line.includes("=")) continue;

        const eqIndex = line.indexOf("=");
        const formulaName = line.slice(0, eqIndex).trim();
        if (!formulaName) continue;

        // Deduplicate by normalized formula name
        const key = formulaName.toLowerCase();
        if (seen.has(key)) continue;

        // Generate hint: show left side + first term of right side, rest blanked
        const rightSide = line.slice(eqIndex + 1).trim();
        const rightParts = rightSide.split(/\s*[-+×*/]\s*/).filter(Boolean);
        let hint: string;
        if (rightParts.length > 1) {
          hint = `${formulaName} = ${rightParts[0].trim()}...`;
        } else {
          // Single term — show first few chars
          hint = `${formulaName} = ${rightSide.slice(0, Math.min(15, Math.floor(rightSide.length / 2)))}...`;
        }

        seen.set(key, {
          formula_name: formulaName,
          formula_text: line,
          hint,
          source_asset_id: asset.id,
        });
      }
    }

    const formulas = Array.from(seen.values());

    if (formulas.length === 0) {
      throw new Error("No formulas found in chapter assets' important_formulas fields");
    }

    // 4. Create formula_sets record
    const { data: formulaSet, error: setErr } = await sb
      .from("formula_sets")
      .insert({
        course_id: chapter.course_id,
        chapter_id: chapter_id,
        status: "draft",
        plays: 0,
        completions: 0,
      })
      .select("id")
      .single();

    if (setErr || !formulaSet) throw new Error("Failed to create formula set: " + (setErr?.message ?? ""));

    // 5. Insert formula items
    const rows = formulas.map((f, i) => ({
      set_id: formulaSet.id,
      formula_name: f.formula_name,
      formula_text: f.formula_text,
      hint: f.hint,
      source_asset_id: f.source_asset_id,
      sort_order: i,
      deleted: false,
    }));

    const { error: insertErr } = await sb.from("formula_items").insert(rows);
    if (insertErr) throw new Error("Failed to insert formulas: " + insertErr.message);

    return new Response(
      JSON.stringify({
        success: true,
        set_id: formulaSet.id,
        formulas_found: formulas.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-formula-set error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
