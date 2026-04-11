import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { postToSlack } from "../_shared/slack.ts";
import { logCost } from "../_shared/cost.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SECTION_COLUMNS: Record<string, string[]> = {
  problem_text: ["survive_problem_text", "problem_context"],
  instructions: ["instruction_list"],
  solution: ["survive_solution_text"],
  solution_je: ["journal_entry_completed_json"],
  supplementary_je: ["supplementary_je_json"],
  dissector: ["dissector_highlights_json"],
  formulas: ["important_formulas"],
  concepts: ["concept_notes"],
  traps: ["exam_traps"],
  flowchart: ["flowchart_image_url", "flowchart_image_id"],
};

// Direct AI rewrite for text fields — returns the updated text
async function rewriteTextField(
  sb: any,
  teachingAssetId: string,
  sectionKey: string,
  fixPrompt: string,
  useStrongModel: boolean,
): Promise<void> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

  const { data: asset, error } = await sb
    .from("teaching_assets")
    .select("id, asset_name, survive_problem_text, problem_context, survive_solution_text, instruction_list")
    .eq("id", teachingAssetId)
    .single();
  if (error || !asset) throw new Error("Asset not found");

  const model = useStrongModel ? "claude-opus-4-20250514" : "claude-sonnet-4-20250514";
  let result: { text: string; usage?: { input_tokens: number; output_tokens: number } };

  if (sectionKey === "problem_text") {
    const currentText = asset.survive_problem_text || asset.problem_context || "";
    const systemPrompt = `You are an accounting educator. You will be given a problem text and instructions on how to fix it. Apply the fix and return ONLY the corrected problem text. Do not add explanations.`;
    const userPrompt = `Current problem text:\n${currentText}\n\nFix instructions:\n${fixPrompt}`;
    result = await callAnthropic(ANTHROPIC_API_KEY, model, systemPrompt, userPrompt);
    await sb.from("teaching_assets").update({
      survive_problem_text: result.text,
      problem_context: result.text,
    }).eq("id", teachingAssetId);
  } else if (sectionKey === "instructions") {
    const currentText = asset.instruction_list || "";
    const systemPrompt = `You are an accounting educator. You will be given instruction text for an accounting problem and instructions on how to fix it. Apply the fix and return ONLY the corrected instruction text. Do not add explanations.`;
    const userPrompt = `Current instructions:\n${currentText}\n\nFix instructions:\n${fixPrompt}`;
    result = await callAnthropic(ANTHROPIC_API_KEY, model, systemPrompt, userPrompt);
    await sb.from("teaching_assets").update({ instruction_list: result.text }).eq("id", teachingAssetId);
  } else if (sectionKey === "solution") {
    const currentText = asset.survive_solution_text || "";
    const problemText = asset.survive_problem_text || asset.problem_context || "";
    const systemPrompt = `You are an accounting educator. You will be given a solution text for an accounting problem and instructions on how to fix it. Apply the fix and return ONLY the corrected solution text. Maintain the same format and structure. Do not add explanations or preamble.`;
    const userPrompt = `Problem:\n${problemText.slice(0, 2000)}\n\nCurrent solution text:\n${currentText}\n\nFix instructions:\n${fixPrompt}`;
    result = await callAnthropic(ANTHROPIC_API_KEY, model, systemPrompt, userPrompt);
    await sb.from("teaching_assets").update({ survive_solution_text: result.text }).eq("id", teachingAssetId);
  } else {
    return;
  }

  // Log cost
  if (result.usage) {
    logCost(sb, {
      operation_type: "asset_fix",
      asset_code: asset.asset_name,
      model,
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
      metadata: { section: sectionKey },
    });
  }
}

async function callAnthropic(apiKey: string, model: string, systemPrompt: string, userPrompt: string): Promise<{ text: string; usage?: { input_tokens: number; output_tokens: number } }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      max_tokens: 4096,
      temperature: 0.1,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const text = data.content?.[0]?.text?.trim();
  if (!text) throw new Error("AI returned empty response");
  return { text, usage: data.usage };
}

const DIRECT_REWRITE_SECTIONS = new Set(["problem_text", "instructions", "solution"]);

function sectionToInvocation(key: string, teachingAssetId: string, fixPrompt: string) {
  const map: Record<string, { fn: string; body: Record<string, unknown> }> = {
    solution_je: { fn: "rewrite-je-tooltips", body: { teaching_asset_id: teachingAssetId, mode: "rewrite_reasons", fix_context: fixPrompt } },
    supplementary_je: { fn: "generate-supplementary-je", body: { teaching_asset_id: teachingAssetId, fix_context: fixPrompt } },
    dissector: { fn: "generate-dissector-highlights", body: { teaching_asset_id: teachingAssetId, fix_context: fixPrompt } },
    formulas: { fn: "generate-ai-output", body: { teaching_asset_id: teachingAssetId, section: "important_formulas", fix_context: fixPrompt } },
    concepts: { fn: "generate-ai-output", body: { teaching_asset_id: teachingAssetId, section: "concept_notes", fix_context: fixPrompt } },
    traps: { fn: "generate-ai-output", body: { teaching_asset_id: teachingAssetId, section: "exam_traps", fix_context: fixPrompt } },
    flowchart: { fn: "generate-flowchart", body: { teaching_asset_id: teachingAssetId, fix_context: fixPrompt } },
  };
  return map[key];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const { teaching_asset_id, sections, fix_prompt, action, snapshot } = body;
    const attempt_number = body.attempt_number ?? 1;
    const requestedModel = body.model; // 'opus' | 'sonnet' | undefined

    if (!teaching_asset_id) throw new Error("Missing teaching_asset_id");

    // Fetch asset info for Slack messages
    const { data: assetRow } = await sb
      .from("teaching_assets")
      .select("asset_name, source_ref")
      .eq("id", teaching_asset_id)
      .single();
    const assetCode = (assetRow as any)?.asset_name || teaching_asset_id;
    const sourceRef = (assetRow as any)?.source_ref || assetCode;
    const pageUrl = `https://learn.surviveaccounting.com/solutions/${encodeURIComponent(assetCode)}`;
    // ── SNAPSHOT: Get current values before fix ──
    if (action === "snapshot") {
      if (!sections?.length) throw new Error("Missing sections");

      const allCols = new Set<string>();
      for (const s of sections) (SECTION_COLUMNS[s] || []).forEach(c => allCols.add(c));

      const { data: asset, error } = await sb
        .from("teaching_assets")
        .select(["id", "asset_name", ...allCols].join(", "))
        .eq("id", teaching_asset_id)
        .single();
      if (error || !asset) throw new Error("Asset not found");

      const snap: Record<string, Record<string, unknown>> = {};
      for (const s of sections) {
        snap[s] = {};
        for (const col of SECTION_COLUMNS[s] || []) snap[s][col] = (asset as any)[col];
      }

      return new Response(JSON.stringify({ snapshot: snap, asset_name: (asset as any).asset_name }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── RUN: Execute section regenerations ──
    if (action === "run") {
      if (!sections?.length) throw new Error("Missing sections");
      if (!fix_prompt?.trim()) throw new Error("fix_prompt is required");

      const results: { key: string; ok: boolean; error?: string }[] = [];

      for (const sectionKey of sections) {
        try {
          // Direct text rewrite for problem_text, instructions, solution
          if (DIRECT_REWRITE_SECTIONS.has(sectionKey)) {
            const useStrong = requestedModel === "opus" || attempt_number > 1;
            await rewriteTextField(sb, teaching_asset_id, sectionKey, fix_prompt, useStrong);
            results.push({ key: sectionKey, ok: true });
            continue;
          }

          const inv = sectionToInvocation(sectionKey, teaching_asset_id, fix_prompt);
          if (!inv) { results.push({ key: sectionKey, ok: false, error: "Unknown section" }); continue; }

          // Use strong model on retry attempts (attempt 2+) or explicit flag
          inv.body.use_strong_model = requestedModel === "opus" || attempt_number > 1;

          const res = await fetch(`${supabaseUrl}/functions/v1/${inv.fn}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
            body: JSON.stringify(inv.body),
          });
          if (!res.ok) {
            results.push({ key: sectionKey, ok: false, error: (await res.text()).slice(0, 200) });
          } else {
            results.push({ key: sectionKey, ok: true });
          }
        } catch (e: any) {
          results.push({ key: sectionKey, ok: false, error: e.message });
        }
      }

      // Read updated values
      const allCols = new Set<string>();
      for (const s of sections) (SECTION_COLUMNS[s] || []).forEach(c => allCols.add(c));
      const { data: updated } = await sb
        .from("teaching_assets")
        .select(["id", ...allCols].join(", "))
        .eq("id", teaching_asset_id)
        .single();

      const after: Record<string, Record<string, unknown>> = {};
      if (updated) {
        for (const s of sections) {
          after[s] = {};
          for (const col of SECTION_COLUMNS[s] || []) after[s][col] = (updated as any)[col];
        }
      }

      // (Slack notifications removed — handled client-side now)

      return new Response(JSON.stringify({ results, after }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── APPROVE: Save fix_notes audit trail ──
    if (action === "approve") {
      if (!fix_prompt) throw new Error("fix_prompt required");
      const reviewer_name = body.reviewer_name || "Admin";
      const existing = await sb.from("teaching_assets").select("fix_notes").eq("id", teaching_asset_id).single();
      const prev = (existing.data as any)?.fix_notes || "";
      const timestamp = new Date().toISOString().slice(0, 16);
      const newNote = `[${timestamp}] ${fix_prompt}`;
      const combined = prev ? `${prev}\n---\n${newNote}` : newNote;

      const { error } = await sb.from("teaching_assets").update({
        fix_notes: combined,
        last_reviewed_by: reviewer_name,
        last_reviewed_at: new Date().toISOString(),
      }).eq("id", teaching_asset_id);
      if (error) throw new Error("Failed to save: " + error.message);

      // (Slack notifications removed — handled client-side now)

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── RESTORE: Rollback to snapshot on reject ──
    if (action === "restore") {
      if (!snapshot || typeof snapshot !== "object") throw new Error("Missing snapshot");

      const updateObj: Record<string, unknown> = {};
      for (const sectionKey of Object.keys(snapshot)) {
        for (const [col, val] of Object.entries(snapshot[sectionKey] as Record<string, unknown>)) {
          updateObj[col] = val;
        }
      }

      const { error } = await sb.from("teaching_assets").update(updateObj).eq("id", teaching_asset_id);
      if (error) throw new Error("Restore failed: " + error.message);

      // (Slack notifications removed — handled client-side now)

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── RESTORE_PARTIAL: Rollback specific sections ──
    if (action === "restore_partial") {
      if (!snapshot || typeof snapshot !== "object") throw new Error("Missing snapshot");
      const restore_sections = body.restore_sections as string[];
      if (!restore_sections?.length) throw new Error("Missing restore_sections");

      const updateObj: Record<string, unknown> = {};
      for (const sectionKey of restore_sections) {
        if (!snapshot[sectionKey]) continue;
        for (const [col, val] of Object.entries(snapshot[sectionKey] as Record<string, unknown>)) {
          updateObj[col] = val;
        }
      }

      if (Object.keys(updateObj).length > 0) {
        const { error } = await sb.from("teaching_assets").update(updateObj).eq("id", teaching_asset_id);
        if (error) throw new Error("Partial restore failed: " + error.message);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── NOTIFY_SLACK: Send a single Slack message ──
    if (action === "notify_slack") {
      const slackMessage = body.slack_message;
      if (!slackMessage) throw new Error("Missing slack_message");
      await postToSlack(slackMessage);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action. Use: snapshot, run, approve, restore, restore_partial, notify_slack");
  } catch (e: any) {
    console.error("fix-asset error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
