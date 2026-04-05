import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { logCost } from "../_shared/cost.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(supabaseUrl, serviceKey);

  try {
    const { teaching_asset_id } = await req.json();
    if (!teaching_asset_id) throw new Error("Missing teaching_asset_id");

    // Fetch asset
    const { data: asset, error: aErr } = await sb
      .from("teaching_assets")
      .select("id, asset_name, problem_context, survive_problem_text, survive_solution_text, instruction_list, worked_steps")
      .eq("id", teaching_asset_id)
      .single();
    if (aErr || !asset) throw new Error("Asset not found: " + (aErr?.message ?? ""));

    // Skip if already has worked_steps
    if (asset.worked_steps?.trim()) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Already has worked_steps" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const problemText = asset.problem_context || asset.survive_problem_text || "";
    const solutionText = asset.survive_solution_text || "";

    // Skip if no solution text to extract steps from
    if (!solutionText.trim()) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "No solution text available" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch instructions
    const { data: instrData } = await sb
      .from("problem_instructions")
      .select("instruction_number, instruction_text")
      .eq("teaching_asset_id", teaching_asset_id)
      .order("instruction_number");

    const instructions = (instrData || [])
      .map((i: any) => `(${String.fromCharCode(96 + i.instruction_number)}) ${i.instruction_text}`)
      .join("\n");

    const systemPrompt = `You are an accounting educator. Given a problem and its worked solution, extract a clear step-by-step breakdown that a student can follow to solve this type of problem.

Rules:
1. Each step should be a clear, actionable instruction (e.g. "Calculate the present value of the annuity payments").
2. Include the formula or method used in each step where applicable.
3. Include the specific values plugged in and the result.
4. Use plain English — avoid jargon a student wouldn't know.
5. If the problem has multiple parts (a, b, c...), organize steps under each part.
6. Maximum 15 steps total. Be concise but complete.
7. Format as a numbered list. For multi-part problems, use headers like "Part (a):" before the steps.
8. Do NOT include the original problem text or restate the question.
9. Return ONLY the worked steps text, no JSON, no markdown fences.`;

    const userPrompt = `Problem:\n${problemText.slice(0, 3000)}

Solution:\n${solutionText.slice(0, 4000)}

${instructions ? `Instructions:\n${instructions}` : ""}

Extract the step-by-step worked solution.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        max_tokens: 3000,
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic API error: ${res.status} ${errText}`);
    }

    const data = await res.json();
    if (!data.content || !data.content[0]?.text) {
      throw new Error("Empty response from Anthropic API");
    }

    const workedSteps = data.content[0].text.trim();

    if (!workedSteps || workedSteps.length < 20) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "AI returned insufficient content" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save to teaching_assets
    const { error: updateErr } = await sb
      .from("teaching_assets")
      .update({ worked_steps: workedSteps })
      .eq("id", teaching_asset_id);
    if (updateErr) throw new Error("Failed to save: " + updateErr.message);

    return new Response(
      JSON.stringify({ success: true, skipped: false, steps_length: workedSteps.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("generate-worked-steps error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
