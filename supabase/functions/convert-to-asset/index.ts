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

      // ── Auto-generate Instance ID ──
      const { data: course, error: courseErr } = await supabase
        .from("courses").select("code").eq("id", courseId).single();
      if (courseErr || !course) throw new Error("Course not found");

      const { data: chapter, error: chErr } = await supabase
        .from("chapters").select("chapter_number").eq("id", chapterId).single();
      if (chErr || !chapter) throw new Error("Chapter not found");

      const courseCode = course.code || "UNK";
      const chNum = chapter.chapter_number;

      const { count: existingVariants } = await supabase
        .from("teaching_assets")
        .select("id", { count: "exact", head: true })
        .eq("base_raw_problem_id", problemId);
      const variantLetter = String.fromCharCode(65 + (existingVariants || 0));

      let seqNum: number;
      if ((existingVariants || 0) === 0) {
        const { data: distinctSources } = await supabase
          .from("teaching_assets")
          .select("base_raw_problem_id")
          .eq("chapter_id", chapterId)
          .not("base_raw_problem_id", "is", null);
        const uniqueSources = new Set((distinctSources || []).map((d: any) => d.base_raw_problem_id));
        seqNum = uniqueSources.size + 1;
      } else {
        const { data: siblings } = await supabase
          .from("teaching_assets")
          .select("asset_name")
          .eq("base_raw_problem_id", problemId)
          .limit(1);
        const match = siblings?.[0]?.asset_name?.match(/_P(\d+)/);
        seqNum = match ? parseInt(match[1], 10) : 1;
      }

      const instanceId = `${courseCode}_CH${chNum}_P${String(seqNum).padStart(3, "0")}${variantLetter}`;

      const { data: newAsset, error: insertErr } = await supabase
        .from("teaching_assets")
        .insert({
          course_id: courseId,
          chapter_id: chapterId,
          base_raw_problem_id: problemId,
          asset_name: instanceId,
          tags: candidate.tags || [],
          survive_problem_text: candidate.survive_problem_text,
          journal_entry_block: requiresJournalEntry ? (candidate.journal_entry_block || null) : null,
          survive_solution_text: candidate.survive_solution_text,
          source_ref: candidate.answer_only || null,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      const { error: updateErr } = await supabase
        .from("chapter_problems")
        .update({ status: "approved" })
        .eq("id", problemId);
      if (updateErr) console.error("Failed to update problem status:", updateErr);

      return new Response(JSON.stringify({ success: true, asset: newAsset }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── MODE: candidates (default) ─── Generate 3 variants with V2 prompt
    const {
      problemId,
      sourceLabel,
      title,
      problemText,
      solutionText,
      journalEntryText,
      notes,
      requiresJournalEntry,
      difficultyToggles,
    } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Fetch 3 random active company names
    const { data: companyNames } = await supabase
      .from("company_names")
      .select("name, style")
      .eq("active", true);
    
    const shuffled = (companyNames || []).sort(() => Math.random() - 0.5);
    const selectedCompanies = shuffled.slice(0, 3);
    const companyList = selectedCompanies.length >= 3
      ? selectedCompanies.map((c: any) => `${c.name} (${c.style})`).join(", ")
      : "Riverstone Corp (realistic), Moonbeam Industries (playful), Granite Financial (realistic)";

    // Build difficulty toggles instruction
    const toggles: string[] = difficultyToggles || [];
    let difficultySection = "";
    if (toggles.length > 0) {
      difficultySection = `\nEXAM DIFFICULTY PATTERNS (incorporate at least one per variant):
${toggles.map((t: string) => `- ${t}`).join("\n")}

For each variant, include an "exam_trap_note" explaining what makes this variant tricky.`;
    }

    const journalInstruction = requiresJournalEntry
      ? `JOURNAL ENTRY HANDLING:
- Generate a consolidated JE per event
- Use grid format: Account | Debit | Credit
- If date-based events, use timeline-based JE
- Do NOT include explanations for JE entries — students rely on video walkthroughs.`
      : "JOURNAL ENTRY: Leave journal_entry_block as null. This problem does not require a journal entry.";

    const systemPrompt = `You are an expert accounting instructor creating Scalable Teaching Assets for exam prep.

CORE RULES:
- Generate exactly 3 exam-style practice problem variants from the source.
- Each variant must teach the SAME core accounting concept as the source.
- Use DIFFERENT numerical values across all 3 variants.
- Each variant MUST use a different company name and short scenario.
- Use concise wording and short sentences. No fluff, no bolding, no unnecessary narrative.
- Every problem must include: "Round all calculations to the nearest whole dollar."
- Reflect exam-style structure similar to textbook/homework problems.
- Variants should feel clean and solvable on first pass.
- Do NOT include "Survive Accounting" in student-facing text.

COMPANY NAMES TO USE (one per variant, in order):
${companyList}

${difficultySection}

${journalInstruction}

SOLUTION STORAGE — For every variant, provide BOTH:
1. answer_only: Final numeric answers + JE summary (concise)
2. survive_solution_text: Fully worked steps with all internal solution logic (step-by-step)

OUTPUT: Return exactly 3 candidates using tool calling.`;

    const userPrompt = `Source Problem: ${sourceLabel} — ${title}

Original Problem Text:
${problemText || "Not provided"}

Original Solution:
${solutionText || "Not provided"}

${journalEntryText ? `Original Journal Entry:\n${journalEntryText}` : ""}

${notes ? `Instructor Notes:\n${notes}` : ""}

Generate 3 exam-style practice variants.`;

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
                        asset_name: { type: "string", description: "Short clear name for this variant" },
                        tags: { type: "array", items: { type: "string" }, description: "2-6 concise concept tags" },
                        survive_problem_text: { type: "string", description: "Student-facing practice problem text" },
                        journal_entry_block: { type: "string", description: "Account | Debit | Credit grid or null" },
                        answer_only: { type: "string", description: "Final numeric answers + JE summary only" },
                        survive_solution_text: { type: "string", description: "Fully worked step-by-step solution" },
                        exam_trap_note: { type: "string", description: "Internal note on what makes this tricky (if difficulty toggles active)" },
                      },
                      required: ["asset_name", "tags", "survive_problem_text", "answer_only", "survive_solution_text"],
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
