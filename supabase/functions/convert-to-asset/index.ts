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

    const body = await req.json();
    const { mode } = body;

    // ─── MODE: save ─── Save a chosen candidate to DB
    if (mode === "save") {
      const { problemId, courseId, chapterId, candidate, requiresJournalEntry } = body;

      const { data: newAsset, error: insertErr } = await supabase
        .from("teaching_assets")
        .insert({
          course_id: courseId,
          chapter_id: chapterId,
          base_raw_problem_id: problemId,
          asset_name: candidate.asset_name,
          tags: candidate.tags || [],
          survive_problem_text: candidate.survive_problem_text,
          journal_entry_block: requiresJournalEntry ? (candidate.journal_entry_block || null) : null,
          survive_solution_text: candidate.survive_solution_text,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      // Update raw problem status
      const { error: updateErr } = await supabase
        .from("chapter_problems")
        .update({ status: "approved" })
        .eq("id", problemId);
      if (updateErr) console.error("Failed to update problem status:", updateErr);

      return new Response(JSON.stringify({ success: true, asset: newAsset }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── MODE: candidates (default) ─── Generate 3 candidates without saving
    const {
      problemId,
      sourceLabel,
      title,
      problemText,
      solutionText,
      journalEntryText,
      difficulty,
      notes,
      requiresJournalEntry,
    } = body;

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

Your job: Take a raw textbook problem and create THREE different ORIGINAL practice problems that each teach the same concept but use completely different numbers, names, and scenario details. NEVER copy the original problem text. Each candidate should feel distinct.

Rules:
- Each problem must test the SAME underlying concept
- Use completely different numbers, company names, and details across all three
- ${difficultyInstruction}
- Solutions must be tutor-style: concise, complete, step-by-step
- Tags should be 2-6 concise keywords about the concept
- Each candidate should have a slightly different angle or scenario

OUTPUT FORMAT — Return exactly 3 candidates using tool calling.`;

    const userPrompt = `Raw Problem: ${sourceLabel} — ${title}

Original Problem Text:
${problemText || "Not provided"}

Original Solution:
${solutionText || "Not provided"}

${journalEntryText ? `Original Journal Entry:\n${journalEntryText}` : ""}

${notes ? `Instructor Notes:\n${notes}` : ""}

${journalInstruction}

Generate 3 candidate teaching assets.`;

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
              name: "create_teaching_asset_candidates",
              description: "Create 3 candidate scalable teaching assets from a raw problem",
              parameters: {
                type: "object",
                properties: {
                  candidates: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        asset_name: { type: "string", description: "Short, clear name" },
                        tags: { type: "array", items: { type: "string" }, description: "2-6 concise concept tags" },
                        survive_problem_text: { type: "string", description: "Original practice problem" },
                        journal_entry_block: { type: "string", description: "Debit/Credit lines or null" },
                        survive_solution_text: { type: "string", description: "Tutor-style solution" },
                      },
                      required: ["asset_name", "tags", "survive_problem_text", "survive_solution_text"],
                      additionalProperties: false,
                    },
                    description: "Exactly 3 candidate teaching assets",
                  },
                },
                required: ["candidates"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_teaching_asset_candidates" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI generation failed");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return structured output");
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const candidates = parsed.candidates || [];

    return new Response(JSON.stringify({ success: true, candidates }), {
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
