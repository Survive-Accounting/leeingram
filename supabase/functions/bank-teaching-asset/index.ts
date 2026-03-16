const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const QUESTION_TYPES = ["JE_MC", "CALC_MC", "CONCEPT_MC", "TRUE_FALSE", "TRAP"] as const;

const SYSTEM_PROMPT = `You are an expert accounting exam question writer. Given a teaching asset (problem text, solution, and optional journal entry), generate multiple-choice questions that test student understanding.

For each question, produce:
- question_type: one of JE_MC, CALC_MC, CONCEPT_MC, TRUE_FALSE, TRAP
- question_text: clear, exam-style question
- answer_a through answer_e: 4-5 plausible answer choices (answer_e can be empty if only 4 choices)
- correct_answer: the letter (A, B, C, D, or E) of the correct choice
- short_explanation: 1-2 sentence explanation of why the correct answer is right
- difficulty: 1-10 scale
- ai_confidence_score: 0-100 how confident you are in question quality

Guidelines:
- Generate 8-12 questions covering different aspects of the problem
- Include at least 1 JE_MC (journal entry multiple choice) if there's a journal entry
- Include at least 1 CALC_MC (calculation-based) if there are numbers
- Include at least 1 TRUE_FALSE
- Include at least 1 TRAP (common mistake/misconception)
- Make distractors plausible but clearly wrong
- Questions should be standalone (don't reference "the problem above")
- Use professional accounting language
- Round numbers to whole dollars unless precision matters

ENTITY NAMING IN QUESTION STEMS:
The teaching asset you are generating questions from uses this naming convention:
  Survive Company A ([role]) — the primary entity
  Survive Company B ([role]) — the secondary entity

When writing question stems that reference a company name, always use the full name with role hint exactly as it appears in the source asset text.

CORRECT:
  "What amount did Survive Company A (the issuer) record as interest expense on July 1?"
  "How much cash did Survive Company A (the borrower) receive at the time the note was issued?"

WRONG (do not do this):
  "What amount did Survive Company record..."
  "What amount did the company record..."
  "What amount did the issuer record..."

If the source asset text uses "Survive Company A (the issuer)", your question stem must use that exact same label.

If a question specifically tests whether the student knows which entity performs an action, you may write the question without naming the entity — but only when that ambiguity is intentional and the question is testing that knowledge specifically.

PERSPECTIVE CLARITY:
If a question asks the student to determine what a specific entity records, always name that entity explicitly in the question stem so the student knows whose perspective to take. Never leave it ambiguous.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const verifyRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: anonKey },
    });
    if (!verifyRes.ok) {
      await verifyRes.text();
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    await verifyRes.text();

    const { teaching_asset_id, asset_name, problem_text, solution_text, journal_entry_block, difficulty } = await req.json();

    if (!teaching_asset_id || !problem_text) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const userPrompt = `Asset: ${asset_name || "Unknown"}
Difficulty: ${difficulty || "standard"}

PROBLEM TEXT:
${problem_text}

SOLUTION TEXT:
${solution_text || "(no solution provided)"}

JOURNAL ENTRY:
${journal_entry_block || "(no journal entry)"}

Generate 8-12 multiple-choice questions for this asset.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "submit_questions",
            description: "Submit generated multiple choice questions",
            parameters: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      question_type: { type: "string", enum: ["JE_MC", "CALC_MC", "CONCEPT_MC", "TRUE_FALSE", "TRAP"] },
                      question_text: { type: "string" },
                      answer_a: { type: "string" },
                      answer_b: { type: "string" },
                      answer_c: { type: "string" },
                      answer_d: { type: "string" },
                      answer_e: { type: "string", description: "Optional 5th answer choice" },
                      correct_answer: { type: "string", enum: ["A", "B", "C", "D", "E"] },
                      short_explanation: { type: "string" },
                      difficulty: { type: "integer", minimum: 1, maximum: 10 },
                      ai_confidence_score: { type: "integer", minimum: 0, maximum: 100 },
                    },
                    required: ["question_type", "question_text", "answer_a", "answer_b", "answer_c", "answer_d", "correct_answer", "short_explanation", "difficulty", "ai_confidence_score"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["questions"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "submit_questions" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited — please try again in a moment" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted — please add funds" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return structured questions");
    }

    let parsed: { questions: any[] };
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      throw new Error("Failed to parse AI response");
    }

    const questions = parsed.questions || [];
    if (questions.length === 0) {
      throw new Error("AI generated 0 questions");
    }

    // Insert into banked_questions
    const rows = questions.map((q: any) => ({
      teaching_asset_id,
      question_type: q.question_type || "CONCEPT_MC",
      question_text: q.question_text || "",
      answer_a: q.answer_a || "",
      answer_b: q.answer_b || "",
      answer_c: q.answer_c || "",
      answer_d: q.answer_d || "",
      answer_e: q.answer_e || "",
      correct_answer: q.correct_answer || "A",
      short_explanation: q.short_explanation || "",
      difficulty: Math.min(10, Math.max(1, q.difficulty || 5)),
      ai_confidence_score: Math.min(100, Math.max(0, q.ai_confidence_score || 50)),
      review_status: "pending",
    }));

    const dbRes = await fetch(`${supabaseUrl}/rest/v1/banked_questions`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        apikey: anonKey,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(rows),
    });

    if (!dbRes.ok) {
      const dbErr = await dbRes.text();
      console.error("DB insert failed:", dbErr);
      throw new Error(`Failed to save questions: ${dbErr}`);
    }

    const savedQuestions = await dbRes.json();

    return new Response(JSON.stringify({
      success: true,
      questions_generated: savedQuestions.length,
      asset_name,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("bank-teaching-asset error:", err);
    return new Response(JSON.stringify({ error: err.message || "Unknown error" }), {
      status: err.status || 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
