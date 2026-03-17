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
    const { teaching_asset_id } = await req.json();
    if (!teaching_asset_id) throw new Error("Missing teaching_asset_id");

    // 1. Fetch teaching asset
    const { data: asset, error: aErr } = await sb
      .from("teaching_assets")
      .select("id, asset_name, problem_context, highlight_tags, worked_steps, important_formulas, chapter_id, course_id")
      .eq("id", teaching_asset_id)
      .single();
    if (aErr || !asset) throw new Error("Teaching asset not found: " + (aErr?.message ?? ""));

    const problemText = asset.problem_context || "";
    if (!problemText.trim()) throw new Error("Teaching asset has no problem_context text");

    // 2. Use AI to analyze and extract highlights
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are an accounting professor analyzing a problem statement. Identify every piece of key information in the problem text that a student needs to solve this problem.

For each piece of key information return:
- text: the exact substring from the problem text (must match exactly — copy it character-for-character)
- label: what this information is used for in solving the problem (1-2 sentences)
- category: one of: "amount" | "rate" | "date" | "term" | "method" | "entity" | "account" | "other"
- color: assign a hex color based on category:
  amount = "#FFD700"
  rate = "#00FFFF"
  date = "#90EE90"
  term = "#FFB6C1"
  method = "#DDA0DD"
  entity = "#87CEEB"
  account = "#FFA500"
  other = "#D3D3D3"

Return a JSON array only. Every "text" value MUST be an exact substring found in the problem text. Do not paraphrase or alter any text values.`;

    const userPrompt = `Problem text to analyze:

${problemText}

${asset.highlight_tags ? `Existing highlight tags for reference: ${asset.highlight_tags}` : ""}
${asset.worked_steps ? `Worked steps for context: ${asset.worked_steps}` : ""}
${asset.important_formulas ? `Important formulas: ${asset.important_formulas}` : ""}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`AI error: ${res.status} ${errText}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    let highlights: any[];

    try {
      highlights = JSON.parse(cleaned);
    } catch (e) {
      throw new Error("Failed to parse AI response as JSON: " + e.message);
    }

    if (!Array.isArray(highlights)) {
      throw new Error("AI response is not an array");
    }

    // 3. Validate: only keep highlights whose text is an exact substring
    const validHighlights = highlights.filter((h: any) => {
      if (!h.text || typeof h.text !== "string") return false;
      return problemText.includes(h.text);
    });

    // 4. Create dissector_problems record
    const { data: problem, error: pErr } = await sb
      .from("dissector_problems")
      .insert({
        teaching_asset_id,
        chapter_id: asset.chapter_id,
        course_id: asset.course_id,
        problem_text: problemText,
        highlights: validHighlights,
        status: "draft",
      })
      .select("id")
      .single();
    if (pErr) throw new Error("Failed to create dissector problem: " + pErr.message);

    return new Response(
      JSON.stringify({
        success: true,
        problem_id: problem.id,
        highlights_found: validHighlights.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-dissector-highlights error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
