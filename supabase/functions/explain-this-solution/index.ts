import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You generate cram-style accounting explanations.

Goal: a student understands and moves on in under 10 seconds.

Hard rules:
- No long paragraphs
- Bullets are short fragments, not full sentences
- Max 2-4 lines per section
- No fluff, no theory dumps, no restating the problem
- Every word earns its place

You will return a JSON object with four fields. Each field is its own section.

Sections and their style:

what_matters
- 2-3 short bullets
- the key observations or signals in the problem (what the student should notice immediately)

how_to_solve
- numbered steps (1, 2, 3...)
- 3-5 steps max
- each step is a short imperative phrase
- include the specific accounts/amounts when relevant

why_it_works
- 1-2 sentences max
- the conceptual reason the approach is correct
- plain language, not textbook language

exam_tip
- 1-2 short bullets
- pattern recognition: "if you see X, do Y"
- how to think on exams when this shows up

Format: each field is a markdown string (bullets/numbers allowed). No headers inside the fields.`;

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
    parts.push("Reference solution (truth — explain how to reach it):");
    parts.push(asset.survive_solution_text);
  }

  if (asset.journal_entry_completed_json) {
    parts.push("");
    parts.push("Journal entries (reference):");
    parts.push(JSON.stringify(asset.journal_entry_completed_json, null, 2));
  }

  return parts.join("\n");
}

type Sections = {
  what_matters: string;
  how_to_solve: string;
  why_it_works: string;
  exam_tip: string;
};

function isValidSections(s: any): s is Sections {
  return (
    s &&
    typeof s.what_matters === "string" &&
    typeof s.how_to_solve === "string" &&
    typeof s.why_it_works === "string" &&
    typeof s.exam_tip === "string"
  );
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
    const { asset_code, force } = await req.json();
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

    // Cache (new structured shape only)
    const cache = asset.survive_solution_explanation_cache as any;
    if (!force && cache?.sections && isValidSections(cache.sections)) {
      return new Response(
        JSON.stringify({
          success: true,
          cached: true,
          sections: cache.sections,
          model_used: cache.model_used || "cached",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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
        tools: [
          {
            type: "function",
            function: {
              name: "return_explanation",
              description: "Return the four explanation sections.",
              parameters: {
                type: "object",
                properties: {
                  what_matters: { type: "string", description: "2-3 short bullets" },
                  how_to_solve: { type: "string", description: "Numbered steps, 3-5 max" },
                  why_it_works: { type: "string", description: "1-2 sentences max" },
                  exam_tip: { type: "string", description: "1-2 short bullets" },
                },
                required: ["what_matters", "how_to_solve", "why_it_works", "exam_tip"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_explanation" } },
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
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    let sections: Sections | null = null;
    try {
      const args = toolCall?.function?.arguments;
      if (args) sections = JSON.parse(args);
    } catch (e) {
      console.error("Failed to parse tool args:", e);
    }

    if (!sections || !isValidSections(sections)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid AI response shape" }), {
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
            sections,
            model_used: model,
            generated_at: new Date().toISOString(),
          },
        })
        .eq("id", asset.id);
    } catch (e) {
      console.warn("Cache save failed:", (e as any)?.message);
    }

    return new Response(
      JSON.stringify({ success: true, cached: false, sections, model_used: model }),
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
