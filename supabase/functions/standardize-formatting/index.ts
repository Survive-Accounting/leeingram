import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { logCost } from "../_shared/cost.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROMPT = `You are fixing the formatting of this explanation only. Do not change any numbers, calculations, or accounting conclusions. Apply these rules exactly:

1. Step labels (Step 1, Step 2, Step 3) must always be narrative text OUTSIDE of calculation blocks — never inside a monospace or highlighted calculation line.

2. Part headers like "Calculate the amount of proceeds allocated to the bonds" must be bold and sit as a clean header above their calculation block — not mixed inside it.

3. Every calculation line stays in its monospace/highlighted format.

4. One blank line between each step and its calculation block.

5. One blank line between each part (a), (b), (c).

6. Do not add any new content or change any values.

7. Do not remove any calculations or conclusions.

PART HEADERS:
- Each instruction part (a)(b)(c) must have its own clearly labeled section outside all code blocks.
- Format: **(a)** bold, on its own line, before any calculation block for that part.
- Use the format (a), (b), (c) with parentheses on BOTH sides — never a), b), c).
- Never bury part labels inside monospace calculation blocks.
- Every part from the instructions must appear as a header even if the calculation for it is inside a code block.
- If the original text uses a), b), c) format (no leading paren), convert to (a), (b), (c).

Output must look like a clean textbook solution with clear separation between narrative steps and calculation lines.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    const { teaching_asset_id, model: requestedModel } = await req.json();
    if (!teaching_asset_id) throw new Error("teaching_asset_id required");
    const aiModel = requestedModel === "opus" ? "claude-opus-4-20250514" : "claude-sonnet-4-20250514";

    const { data: asset, error: fetchErr } = await sb
      .from("teaching_assets")
      .select("id, survive_solution_text, solution_text_backup")
      .eq("id", teaching_asset_id)
      .single();

    if (fetchErr || !asset) throw new Error("Asset not found");

    const original = asset.survive_solution_text || "";
    if (!original.trim()) {
      return new Response(JSON.stringify({ skipped: true, reason: "empty solution text" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Anthropic
    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        max_tokens: 4000,
        temperature: 0.1,
        messages: [
          { role: "user", content: `Instruction: ${PROMPT}\n\nText to modify:\n${original}` },
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

    // Backup and update
    const updatePayload: Record<string, any> = { survive_solution_text: after };
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
        asset_code: teaching_asset_id,
        model: aiModel,
        input_tokens: aiData.usage.input_tokens,
        output_tokens: aiData.usage.output_tokens,
        metadata: { type: "standardize_formatting" },
      });
    }

    return new Response(JSON.stringify({ success: true, estimated_cost_usd: aiData.usage ? undefined : null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("standardize-formatting error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
