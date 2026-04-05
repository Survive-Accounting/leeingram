import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { teaching_asset_id, context_hint } = await req.json();
    if (!teaching_asset_id) {
      return new Response(JSON.stringify({ error: "teaching_asset_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Fetch asset data
    const { data: asset, error: fetchErr } = await sb
      .from("teaching_assets")
      .select("problem_context, survive_problem_text, instruction_list, asset_name, source_ref")
      .eq("id", teaching_asset_id)
      .single();

    if (fetchErr || !asset) {
      console.error("Fetch error:", JSON.stringify(fetchErr), "asset:", asset);
      return new Response(JSON.stringify({ error: "Asset not found", detail: fetchErr?.message }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an accounting expert reviewing a practice problem solution. Given a problem scenario and its instructions, identify journal entries that a complete solution should include but may be missing.

Return ONLY valid JSON, no markdown, no backticks:
{
  "suggested_entries": [
    {
      "label": "Bond issuance at premium",
      "description": "Cash received exceeds face value — record Bonds Payable + Premium on Bonds Payable"
    }
  ]
}

Return 2–6 suggestions maximum. Keep labels short (4–6 words). Descriptions one sentence.`;

    const userPrompt = `Problem text: ${asset.problem_context || asset.survive_problem_text || "(none)"}

Instructions: ${asset.instruction_list || "(none)"}
${context_hint ? `\nAdditional context from reviewer: ${context_hint}` : ""}
What journal entries should a complete solution include for this problem? List only entries directly relevant to this specific scenario.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_journal_entries",
              description: "Return suggested missing journal entries for the problem",
              parameters: {
                type: "object",
                properties: {
                  suggested_entries: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        label: { type: "string", description: "Short label, 4-6 words" },
                        description: { type: "string", description: "One sentence description" },
                      },
                      required: ["label", "description"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["suggested_entries"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_journal_entries" } },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, errText);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      // Fallback: try parsing content directly
      const content = aiData.choices?.[0]?.message?.content || "";
      try {
        const parsed = JSON.parse(content);
        return new Response(JSON.stringify(parsed), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const result = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("suggest-missing-je error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
