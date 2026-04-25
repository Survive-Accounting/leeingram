import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `When a student clicks Explain this, generate the explanation as if you are a professor thinking out loud while solving the problem.

Style rules:
- Keep it short, clear, and conversational
- Use a chat-like tone, not formal textbook language
- Structure the explanation into 5–6 short sections
- Each section should start with a simple emoji + short header
- Sound like a professor explaining their thought process step-by-step
- Focus only on what is relevant to this specific problem
- Avoid long paragraphs
- Avoid unnecessary theory unless it directly helps the answer
- Make it feel like: "here's exactly what I'm thinking while solving this"

Required structure (use these exact headers as markdown ## headings):
## 💡 What I notice first
## 🧠 My thought process
## 📌 What I do
## 🔍 What's happening behind the scenes
## ⚖️ Why this makes sense
## 🚨 Exam mindset

Tone: natural, slightly informal, confident, no fluff, no generic textbook explanations. Prioritize clarity + speed for exam prep.

Output: pure markdown only. No preamble, no closing remarks.`;

function buildUserPrompt(asset: any): string {
  const parts: string[] = [];
  if (asset.problem_title) parts.push(`Title: ${asset.problem_title}`);
  if (asset.source_ref) parts.push(`Source: ${asset.source_ref}`);
  parts.push("");
  parts.push("Problem:");
  parts.push(asset.survive_problem_text || "");

  const instructions = [
    asset.instruction_1,
    asset.instruction_2,
    asset.instruction_3,
    asset.instruction_4,
    asset.instruction_5,
  ].filter(Boolean);
  if (instructions.length) {
    parts.push("");
    parts.push("Instructions:");
    instructions.forEach((ins, i) => parts.push(`${String.fromCharCode(97 + i)}. ${ins}`));
  } else if (asset.instruction_list) {
    parts.push("");
    parts.push("Instructions:");
    parts.push(asset.instruction_list);
  }

  if (asset.survive_solution_text) {
    parts.push("");
    parts.push("Reference solution (use this as the truth — explain how to arrive at it):");
    parts.push(asset.survive_solution_text);
  }

  if (asset.journal_entry_completed_json) {
    parts.push("");
    parts.push("Journal entries (reference):");
    parts.push(JSON.stringify(asset.journal_entry_completed_json, null, 2));
  }

  return parts.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: "OPENAI_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(supabaseUrl, serviceKey);
    const { asset_code } = await req.json();
    if (!asset_code) {
      return new Response(JSON.stringify({ success: false, error: "Missing asset_code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: asset, error: assetErr } = await sb
      .from("teaching_assets")
      .select(
        "id, asset_name, problem_title, source_ref, survive_problem_text, survive_solution_text, instruction_1, instruction_2, instruction_3, instruction_4, instruction_5, instruction_list, journal_entry_completed_json, survive_solution_explanation_cache",
      )
      .eq("asset_name", asset_code)
      .maybeSingle();

    if (assetErr || !asset) {
      return new Response(JSON.stringify({ success: false, error: "Asset not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check cache
    const cache = asset.survive_solution_explanation_cache as any;
    if (cache?.markdown) {
      return new Response(
        JSON.stringify({
          success: true,
          cached: true,
          markdown: cache.markdown,
          model_used: cache.model_used || "cached",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Call OpenAI
    const model = "gpt-5";
    const userPrompt = buildUserPrompt(asset);

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_completion_tokens: 1200,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("OpenAI error:", res.status, errText);
      return new Response(JSON.stringify({ success: false, error: `OpenAI ${res.status}: ${errText.slice(0, 300)}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const markdown = data?.choices?.[0]?.message?.content?.trim() || "";
    if (!markdown) {
      return new Response(JSON.stringify({ success: false, error: "Empty response from OpenAI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save cache
    try {
      await sb
        .from("teaching_assets")
        .update({
          survive_solution_explanation_cache: {
            markdown,
            model_used: model,
            generated_at: new Date().toISOString(),
          },
        })
        .eq("id", asset.id);
    } catch (e) {
      console.warn("Cache save failed:", (e as any)?.message);
    }

    return new Response(
      JSON.stringify({ success: true, cached: false, markdown, model_used: model }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("explain-this-solution fatal:", e);
    return new Response(JSON.stringify({ success: false, error: e?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
