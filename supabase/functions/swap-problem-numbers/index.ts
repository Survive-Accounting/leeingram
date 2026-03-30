import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { teaching_asset_id } = await req.json();
    if (!teaching_asset_id) {
      return new Response(JSON.stringify({ success: false, error: "Missing teaching_asset_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch the asset
    const { data: asset, error: fetchErr } = await sb
      .from("teaching_assets")
      .select("problem_context, problem_text")
      .eq("id", teaching_asset_id)
      .single();

    if (fetchErr || !asset) {
      return new Response(JSON.stringify({ success: false, error: "Asset not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const problemContext = asset.problem_context || asset.problem_text || "";
    if (!problemContext.trim()) {
      return new Response(JSON.stringify({ success: false, error: "No problem text to swap" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Anthropic API
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are given an accounting problem. Your task is to change the numeric values in the problem to create a new version that tests the same concept.

Rules:
- Change all dollar amounts to different but realistic values (keep same order of magnitude, e.g. $800,000 becomes something like $650,000 or $1,200,000)
- Change interest rates slightly (e.g. 9% becomes 8% or 10%)
- Change years/terms slightly if present (e.g. 20-year becomes 15-year or 25-year)
- Change dates to different but realistic accounting dates
- Keep ALL company names exactly the same
- Keep ALL accounting method names exactly the same (straight-line, etc.)
- Keep the problem structure and instructions identical — do not rewrite sentences, only swap numbers
- Return ONLY the modified problem_context text, nothing else. Do not include any explanation.`;

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        system: systemPrompt,
        messages: [
          { role: "user", content: problemContext },
        ],
        max_tokens: 4096,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ success: false, error: "Rate limited — try again in a moment" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("Anthropic API error:", status, errText);
      return new Response(JSON.stringify({ success: false, error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const newText = aiData.content?.[0]?.text?.trim() || "";

    if (!newText) {
      return new Response(JSON.stringify({ success: false, error: "AI returned empty response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, new_problem_context: newText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("swap-problem-numbers error:", e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
