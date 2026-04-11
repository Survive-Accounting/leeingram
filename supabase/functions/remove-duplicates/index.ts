import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { logCost } from "../_shared/cost.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROMPT = `You are cleaning an accounting explanation that contains duplicate or redundant content. Apply these rules exactly:

DUPLICATE DETECTION:

1. Same journal entry appears more than once — keep ONE only
2. Same calculation appears more than once — keep ONE only
3. Same paragraph near-verbatim — keep ONE, remove rest
4. Two JE tables for same transaction — merge into one

REDUNDANCY RULES:

5. Remove sentences that restate what was just calculated
6. Remove 'As calculated above' if calculation is right there
7. Remove verbatim restatements of the problem

WHAT TO KEEP:

8. All unique calculations and results
9. All unique journal entries
10. All narrative adding new information
11. Part headers (a)(b)(c) even if content consolidated

After removing, explanation must flow logically. If gap created, write ONE clean transition sentence.

Do not change any accounting content, numbers, conclusions.

Output: clean, concise, professional textbook solution.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    const { teaching_asset_id } = await req.json();
    if (!teaching_asset_id) throw new Error("teaching_asset_id required");

    // Always use Opus for this operation
    const aiModel = "claude-opus-4-20250514";

    const { data: asset, error: fetchErr } = await sb
      .from("teaching_assets")
      .select("id, asset_name, survive_solution_text, solution_text_backup")
      .eq("id", teaching_asset_id)
      .single();

    if (fetchErr || !asset) throw new Error("Asset not found");

    const original = asset.survive_solution_text || "";
    if (!original.trim()) {
      return new Response(JSON.stringify({ skipped: true, reason: "empty solution text" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Anthropic with Opus
    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        max_tokens: 8192,
        temperature: 0.1,
        messages: [
          { role: "user", content: `Instruction: ${PROMPT}\n\nText to clean:\n${original}` },
        ],
        system: "You are a text editor. Apply the following instruction to the text. Return ONLY the modified text, nothing else.",
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      throw new Error(`Anthropic ${aiResp.status}: ${errText}`);
    }

    const aiData = await aiResp.json();
    const after = aiData.content?.[0]?.text || original;

    if (after === original) {
      return new Response(JSON.stringify({ skipped: true, reason: "no changes" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Backup original and update — never auto-approve
    const updatePayload: Record<string, any> = {
      survive_solution_text: after,
      fix_status: "fix_applied",
    };
    if (!asset.solution_text_backup) {
      updatePayload.solution_text_backup = original;
    }

    const { error: updateErr } = await sb
      .from("teaching_assets")
      .update(updatePayload)
      .eq("id", teaching_asset_id);

    if (updateErr) throw new Error(`Update failed: ${updateErr.message}`);

    // Log cost
    if (aiData.usage) {
      logCost(sb, {
        operation_type: "asset_fix",
        asset_code: asset.asset_name || teaching_asset_id,
        model: aiModel,
        input_tokens: aiData.usage.input_tokens,
        output_tokens: aiData.usage.output_tokens,
        metadata: { type: "remove_duplicates" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("remove-duplicates error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
