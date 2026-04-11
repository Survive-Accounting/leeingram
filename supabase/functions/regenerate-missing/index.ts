import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { logCost } from "../_shared/cost.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROMPT = `You are completing an accounting explanation that is missing content for one or more parts.

CONTEXT:
- Practice problem for accounting students
- Problem text and instructions provided
- Some parts have complete explanations, some missing
- Company name: 'Survive Company'

YOUR TASK:
1. Read problem text and instructions carefully
2. Identify which parts (a)(b)(c) have missing explanations
3. Generate complete correct explanations for ONLY missing parts
4. Do not modify parts that already have complete explanations

FOR EACH MISSING PART:
- Clear part header: bold, matches instruction letter
- Step-by-step solution showing all work
- All calculations in monospace format
- Final answer clearly stated
- Journal entry if instruction asks for one

ACCOUNTING RULES:
- US GAAP only
- Never invent numbers — derive from problem text only
- If figure cannot be derived: [NEEDS LEE — insufficient data]
- Normal balances: Assets/Expenses debit, Liabilities/Equity/Revenue credit
- All JEs must balance (debits = credits)
- Use 'Survive Company' throughout

VOICE:
- Confident tutor explaining to confused student
- Show every step — never skip to answer
- 'You' perspective where natural
- No AI thinking, no self-correction, no hedging
- Reads like written by human tutor immediately

CRITICAL:
- Do not hallucinate numbers or accounting rules
- If uncertain: write [NEEDS LEE] rather than guess
- Preserve all existing correct content exactly
- Only add — never remove existing correct parts`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    const { teaching_asset_id } = await req.json();
    if (!teaching_asset_id) throw new Error("teaching_asset_id required");

    const aiModel = "claude-opus-4-20250514";

    const { data: asset, error: fetchErr } = await sb
      .from("teaching_assets")
      .select("id, asset_name, survive_problem_text, problem_context, instructions, survive_solution_text, solution_text_backup, journal_entry_completed_json")
      .eq("id", teaching_asset_id)
      .single();

    if (fetchErr || !asset) throw new Error("Asset not found");

    const original = (asset as any).survive_solution_text || "";
    const problemText = (asset as any).survive_problem_text || (asset as any).problem_context || "";
    const instructions = (asset as any).instructions || "";

    if (!problemText.trim()) {
      return new Response(JSON.stringify({ skipped: true, reason: "no problem text" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context for Claude
    let userContent = `Problem Text:\n${problemText}\n\n`;
    if (instructions.trim()) {
      userContent += `Instructions:\n${instructions}\n\n`;
    }
    if (original.trim()) {
      userContent += `Existing Explanation (preserve all correct content, only add missing parts):\n${original}`;
    } else {
      userContent += `Existing Explanation: NONE — generate complete explanation for all parts.`;
    }

    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        max_tokens: 12000,
        temperature: 0.1,
        messages: [
          { role: "user", content: `${PROMPT}\n\n${userContent}` },
        ],
        system: "You are an accounting tutor completing missing parts of a practice problem explanation. Return the COMPLETE explanation with all parts — both existing (unchanged) and newly generated. Do not include any meta-commentary.",
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

    // Check for [NEEDS LEE] — flag but still save
    const needsLee = after.includes("[NEEDS LEE");

    // Backup original and update — NEVER auto-approve
    const updatePayload: Record<string, any> = {
      survive_solution_text: after,
      fix_status: needsLee ? "needs_lee" : "fix_applied",
    };
    if (!asset.solution_text_backup) {
      updatePayload.solution_text_backup = original;
    }

    const fixNoteEntry = `Bulk fix applied: Regenerate Missing Content — ${new Date().toISOString()}${needsLee ? " — [NEEDS LEE] flagged" : ""}`;
    const { data: currentAsset } = await sb
      .from("teaching_assets")
      .select("fix_notes")
      .eq("id", teaching_asset_id)
      .single();
    updatePayload.fix_notes = ((currentAsset as any)?.fix_notes ? (currentAsset as any).fix_notes + "\n" : "") + fixNoteEntry;

    const { error: updateErr } = await sb
      .from("teaching_assets")
      .update(updatePayload)
      .eq("id", teaching_asset_id);

    if (updateErr) throw new Error(`Update failed: ${updateErr.message}`);

    // Log cost
    if (aiData.usage) {
      logCost(sb, {
        operation_type: "asset_fix",
        asset_code: (asset as any).asset_name || teaching_asset_id,
        model: aiModel,
        input_tokens: aiData.usage.input_tokens,
        output_tokens: aiData.usage.output_tokens,
        metadata: { type: "regenerate_missing", needs_lee: needsLee },
      });
    }

    return new Response(JSON.stringify({ success: true, needs_lee: needsLee }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("regenerate-missing error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
