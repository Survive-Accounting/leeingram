import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      problemId,
      courseId,
      chapterId,
      sourceLabel,
      title,
      problemText,
      solutionText,
      journalEntryText,
      difficulty,
      notes,
      requiresJournalEntry,
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const difficultyInstruction = difficulty === "tricky"
      ? "Make the problem TRICKY — include one subtle exam-relevant twist that tests deeper understanding."
      : difficulty === "slightly_harder"
      ? "Make the problem slightly harder than the original — add one extra step or a less obvious detail."
      : "Keep the problem at a standard difficulty level, similar to the original.";

    const journalInstruction = requiresJournalEntry
      ? `JOURNAL ENTRY BLOCK:
Generate a journal entry formatted for Google Sheets copy/paste:
Debit: Account — Amount
Credit: Account — Amount
(multiple lines as needed for the problem)`
      : "JOURNAL ENTRY BLOCK: Leave empty (null). This problem does not require a journal entry.";

    const systemPrompt = `You are an expert accounting instructor creating Scalable Teaching Assets for exam prep.

Your job: Take a raw textbook problem and create an ORIGINAL practice problem that teaches the same concept but uses completely different numbers, names, and scenario details. NEVER copy the original problem text.

Rules:
- The new problem must test the SAME underlying concept
- Use completely different numbers, company names, and details
- ${difficultyInstruction}
- Solution must be tutor-style: concise, complete, step-by-step
- Tags should be 2-6 concise keywords about the concept

OUTPUT FORMAT — Return exactly these sections using tool calling.`;

    const userPrompt = `Raw Problem: ${sourceLabel} — ${title}

Original Problem Text:
${problemText || "Not provided"}

Original Solution:
${solutionText || "Not provided"}

${journalEntryText ? `Original Journal Entry:\n${journalEntryText}` : ""}

${notes ? `Instructor Notes:\n${notes}` : ""}

${journalInstruction}

Generate the teaching asset.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_teaching_asset",
              description: "Create a scalable teaching asset from a raw problem",
              parameters: {
                type: "object",
                properties: {
                  asset_name: { type: "string", description: "Short, clear name for the asset (e.g., 'Bond Premium Amortization')" },
                  tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "2-6 concise concept tags",
                  },
                  survive_problem_text: { type: "string", description: "The original practice problem with different numbers and details" },
                  journal_entry_block: {
                    type: "string",
                    description: "Journal entry formatted as Debit/Credit lines, or null if not required",
                  },
                  survive_solution_text: { type: "string", description: "Tutor-style step-by-step solution" },
                },
                required: ["asset_name", "tags", "survive_problem_text", "survive_solution_text"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_teaching_asset" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI generation failed");
    }

    const data = await response.json();
    
    // Extract tool call arguments
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return structured output");
    }

    const asset = JSON.parse(toolCall.function.arguments);

    // Save to teaching_assets
    const { data: newAsset, error: insertErr } = await supabase
      .from("teaching_assets")
      .insert({
        course_id: courseId,
        chapter_id: chapterId,
        base_raw_problem_id: problemId,
        asset_name: asset.asset_name,
        tags: asset.tags || [],
        survive_problem_text: asset.survive_problem_text,
        journal_entry_block: requiresJournalEntry ? (asset.journal_entry_block || null) : null,
        survive_solution_text: asset.survive_solution_text,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Update raw problem status to converted
    const { error: updateErr } = await supabase
      .from("chapter_problems")
      .update({ status: "converted" })
      .eq("id", problemId);

    if (updateErr) {
      console.error("Failed to update problem status:", updateErr);
    }

    return new Response(JSON.stringify({ success: true, asset: newAsset }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("convert-to-asset error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
