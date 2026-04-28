import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Lee, an accounting tutor. You generate cram-style explanations that help a student know HOW TO START a problem immediately.

Goal: a student reads "Lee's approach" and instantly knows what to do first. They understand and move on in under 10 seconds.

Hard rules:
- No long paragraphs anywhere
- Bullets are short fragments, not full sentences
- Max 2-4 lines per section
- No fluff, no theory dumps, no restating the problem
- Every word earns its place
- Write like a tutor guiding first steps, not a textbook

You will return a JSON object with four fields. Each field is its own section.

Sections and their style:

lees_approach (MOST IMPORTANT — always shown first)
- 2-4 short bullets
- How to THINK when you see this problem — the mental moves before any math
- What to identify, what to set up, what to watch for
- NO calculations, NO numbers being computed, NO final answers
- Tutor voice: "Spot the…", "Start by…", "Ask yourself…"

how_to_solve
- numbered steps (1, 2, 3...)
- 3-5 concise steps max
- each step is a short imperative phrase
- include the specific accounts/amounts when relevant

walkthrough (NEW — bite-sized, one entry per lettered instruction part)
- Return an array. One object per instruction part (a, b, c, …) in the same order as the Instructions list.
- Each entry MUST have: { "part": "a", "title": "<5-7 word task title>", "restate": "<one short sentence in your tutor voice translating what this part is asking — like 'Just figure out: sale price minus cost.'>", "content": "<2-4 short numbered steps with specific numbers/accounts. Markdown allowed. NO restating the textbook prompt.>" }
- If there is only ONE instruction (or none), still return a single-entry array with part "a".
- The walkthrough is the SAME solution as how_to_solve, just split per part. Don't add new info.

why_it_works
- 1-2 sentences max
- the conceptual reason the approach is correct
- plain language, not textbook language

lock_it_in
- 1-2 short bullets
- pattern recognition: "if you see X → think Y"
- the trigger-to-move mapping a student should memorize

Format: each text field is a markdown string (bullets/numbers allowed). No headers inside the fields.`;

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

type WalkStep = { part: string; title: string; restate: string; content: string };

type Sections = {
  lees_approach: string;
  how_to_solve: string;
  why_it_works: string;
  lock_it_in: string;
  walkthrough?: WalkStep[];
};

function isValidSections(s: any): s is Sections {
  return (
    s &&
    typeof s.lees_approach === "string" &&
    typeof s.how_to_solve === "string" &&
    typeof s.why_it_works === "string" &&
    typeof s.lock_it_in === "string"
  );
}

function hasWalkthrough(s: any): boolean {
  return Array.isArray(s?.walkthrough) && s.walkthrough.length > 0
    && s.walkthrough.every((w: any) => w && typeof w.part === "string" && typeof w.content === "string");
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

    // Cache hit only if the cached sections also include the new walkthrough shape.
    // Old cached rows (no walkthrough) get regenerated once on next view.
    const cache = asset.survive_solution_explanation_cache as any;
    if (!force && cache?.sections && isValidSections(cache.sections) && hasWalkthrough(cache.sections)) {
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

    const model = "gpt-5-mini";
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
        // gpt-5 family are reasoning models — most tokens go to internal reasoning.
        // Need a high ceiling so the tool-call output isn't truncated to empty.
        max_completion_tokens: 8000,
        tools: [
          {
            type: "function",
            function: {
              name: "return_explanation",
              description: "Return the four explanation sections.",
              parameters: {
                type: "object",
                properties: {
                  lees_approach: { type: "string", description: "2-4 bullets on HOW TO THINK / where to start. No calculations." },
                  how_to_solve: { type: "string", description: "Numbered steps, 3-5 max" },
                  why_it_works: { type: "string", description: "1-2 sentences max" },
                  lock_it_in: { type: "string", description: "1-2 bullets, 'if you see X → think Y'" },
                },
                required: ["lees_approach", "how_to_solve", "why_it_works", "lock_it_in"],
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
    const choice = data?.choices?.[0];
    const toolCall = choice?.message?.tool_calls?.[0];
    let sections: Sections | null = null;
    try {
      const args = toolCall?.function?.arguments;
      if (args) sections = JSON.parse(args);
    } catch (e) {
      console.error("Failed to parse tool args:", e);
    }

    if (!sections || !isValidSections(sections)) {
      console.error("Invalid AI response shape", {
        finish_reason: choice?.finish_reason,
        usage: data?.usage,
        had_tool_call: !!toolCall,
        args_preview: String(toolCall?.function?.arguments || "").slice(0, 200),
      });
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
