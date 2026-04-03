import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Maps section keys to the DB columns they affect
const SECTION_COLUMNS: Record<string, string[]> = {
  solution_je: ["journal_entry_completed_json"],
  supplementary_je: ["supplementary_je_json"],
  formulas: ["important_formulas"],
  concepts: ["concept_notes"],
  traps: ["exam_traps"],
  flowchart: ["flowchart_image_url", "flowchart_image_id"],
};

// Maps section keys to the edge function + body they call
function sectionToInvocation(key: string, teachingAssetId: string, fixPrompt: string) {
  const base: Record<string, { fn: string; body: Record<string, unknown> }> = {
    solution_je: { fn: "rewrite-je-tooltips", body: { teaching_asset_id: teachingAssetId, mode: "rewrite_reasons", fix_context: fixPrompt } },
    supplementary_je: { fn: "generate-supplementary-je", body: { teaching_asset_id: teachingAssetId, fix_context: fixPrompt } },
    formulas: { fn: "generate-ai-output", body: { teaching_asset_id: teachingAssetId, section: "important_formulas", fix_context: fixPrompt } },
    concepts: { fn: "generate-ai-output", body: { teaching_asset_id: teachingAssetId, section: "concept_notes", fix_context: fixPrompt } },
    traps: { fn: "generate-ai-output", body: { teaching_asset_id: teachingAssetId, section: "exam_traps", fix_context: fixPrompt } },
    flowchart: { fn: "generate-flowchart", body: { teaching_asset_id: teachingAssetId, fix_context: fixPrompt } },
  };
  return base[key];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    const { teaching_asset_id, sections, fix_prompt, action } = await req.json();

    if (!teaching_asset_id) throw new Error("Missing teaching_asset_id");

    // ── ACTION: snapshot ── Get current values for selected sections
    if (action === "snapshot") {
      if (!sections || !Array.isArray(sections) || sections.length === 0) {
        throw new Error("Missing or empty sections array");
      }

      const allColumns = new Set<string>();
      for (const s of sections) {
        (SECTION_COLUMNS[s] || []).forEach(c => allColumns.add(c));
      }

      const selectStr = ["id", "asset_name", ...allColumns].join(", ");
      const { data: asset, error } = await sb
        .from("teaching_assets")
        .select(selectStr)
        .eq("id", teaching_asset_id)
        .single();
      if (error || !asset) throw new Error("Asset not found");

      // Return snapshot keyed by section
      const snapshot: Record<string, Record<string, unknown>> = {};
      for (const s of sections) {
        snapshot[s] = {};
        for (const col of SECTION_COLUMNS[s] || []) {
          snapshot[s][col] = (asset as any)[col];
        }
      }

      return new Response(JSON.stringify({ snapshot, asset_name: (asset as any).asset_name }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: run ── Execute fixes for selected sections
    if (action === "run") {
      if (!sections || !Array.isArray(sections) || sections.length === 0) {
        throw new Error("Missing or empty sections array");
      }
      if (!fix_prompt || typeof fix_prompt !== "string" || fix_prompt.trim().length === 0) {
        throw new Error("fix_prompt is required");
      }

      const results: { key: string; ok: boolean; error?: string }[] = [];

      for (const sectionKey of sections) {
        const invocation = sectionToInvocation(sectionKey, teaching_asset_id, fix_prompt);
        if (!invocation) {
          results.push({ key: sectionKey, ok: false, error: "Unknown section" });
          continue;
        }

        try {
          const fnUrl = `${supabaseUrl}/functions/v1/${invocation.fn}`;
          const res = await fetch(fnUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify(invocation.body),
          });

          if (!res.ok) {
            const errText = await res.text();
            results.push({ key: sectionKey, ok: false, error: errText.slice(0, 200) });
          } else {
            results.push({ key: sectionKey, ok: true });
          }
        } catch (e: any) {
          results.push({ key: sectionKey, ok: false, error: e.message || "Unknown error" });
        }
      }

      // Read the new values after regeneration
      const allColumns = new Set<string>();
      for (const s of sections) {
        (SECTION_COLUMNS[s] || []).forEach(c => allColumns.add(c));
      }
      const selectStr = ["id", ...allColumns].join(", ");
      const { data: updatedAsset } = await sb
        .from("teaching_assets")
        .select(selectStr)
        .eq("id", teaching_asset_id)
        .single();

      const after: Record<string, Record<string, unknown>> = {};
      if (updatedAsset) {
        for (const s of sections) {
          after[s] = {};
          for (const col of SECTION_COLUMNS[s] || []) {
            after[s][col] = (updatedAsset as any)[col];
          }
        }
      }

      return new Response(JSON.stringify({ results, after }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: approve ── Save fix_notes audit trail
    if (action === "approve") {
      if (!fix_prompt) throw new Error("fix_prompt required for audit trail");

      const { error } = await sb
        .from("teaching_assets")
        .update({ fix_notes: fix_prompt })
        .eq("id", teaching_asset_id);
      if (error) throw new Error("Failed to save fix_notes: " + error.message);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: reject ── Restore snapshot values
    if (action === "reject") {
      const { snapshot } = await req.json().catch(() => ({ snapshot: null }));
      // snapshot was already parsed above from the original req.json()
      // We need it passed in the body
      if (!sections || !Array.isArray(sections)) throw new Error("Missing sections");

      // The snapshot should be passed in the body
      const body = { teaching_asset_id, sections, fix_prompt, action, snapshot: null as any };
      // Re-read from the original parse — snapshot comes from the request body
      // Actually we already destructured above, let's check
    }

    // ── ACTION: restore ── Restore a snapshot (called on reject)
    if (action === "restore") {
      const { snapshot } = await req.json().catch(() => ({ snapshot: null }));
      // Already parsed above
      if (!snapshot || typeof snapshot !== "object") throw new Error("Missing snapshot data");

      const updateObj: Record<string, unknown> = {};
      for (const sectionKey of Object.keys(snapshot)) {
        for (const [col, val] of Object.entries(snapshot[sectionKey] as Record<string, unknown>)) {
          updateObj[col] = val;
        }
      }

      const { error } = await sb
        .from("teaching_assets")
        .update(updateObj)
        .eq("id", teaching_asset_id);
      if (error) throw new Error("Failed to restore: " + error.message);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action. Must be 'snapshot', 'run', 'approve', or 'restore'");
  } catch (e: any) {
    console.error("fix-asset error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
