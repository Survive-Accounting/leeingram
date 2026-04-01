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
    const { topic_id } = await req.json();
    if (!topic_id) throw new Error("topic_id is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

    const sb = createClient(supabaseUrl, serviceKey);

    // ── STEP 1: Fetch topic context ──
    const { data: topic, error: topicErr } = await sb
      .from("chapter_topics")
      .select("id, topic_name, topic_description, topic_rationale, chapter_id")
      .eq("id", topic_id)
      .single();
    if (topicErr || !topic) throw new Error("Topic not found");

    const { data: assets, error: assetErr } = await sb
      .from("teaching_assets")
      .select("id, problem_context, survive_solution_text, important_formulas, concept_notes, exam_traps, supplementary_je_json, survive_problem_text, asset_type")
      .eq("topic_id", topic_id)
      .not("asset_approved_at", "is", null);
    if (assetErr) throw assetErr;

    // Determine example asset: first approved asset sorted by type priority (BE > QS > E > P)
    const TYPE_ORDER: Record<string, number> = { BE: 0, QS: 1, E: 2, EX: 2, P: 3 };
    const sortedForExample = [...(assets || [])].sort((a, b) => {
      const oa = TYPE_ORDER[a.asset_type?.toUpperCase() ?? ""] ?? 99;
      const ob = TYPE_ORDER[b.asset_type?.toUpperCase() ?? ""] ?? 99;
      return oa - ob;
    });
    const exampleAssetId = sortedForExample[0]?.id ?? null;

    // ── STEP 2: Determine question mix ──
    let totalJeEntries = 0;
    for (const asset of assets || []) {
      const jeJson = asset.supplementary_je_json;
      if (jeJson && Array.isArray(jeJson)) {
        totalJeEntries += jeJson.length;
      } else if (jeJson && typeof jeJson === "object" && Array.isArray((jeJson as any).entries)) {
        totalJeEntries += (jeJson as any).entries.length;
      }
    }

    let mix: { calc_mc: number; conceptual_mc: number; je_recall: number; claude_split_metadata?: any };

    if (totalJeEntries >= 3) {
      mix = { calc_mc: 2, conceptual_mc: 1, je_recall: 2 };
    } else if (totalJeEntries >= 1) {
      mix = { calc_mc: 3, conceptual_mc: 1, je_recall: 1 };
    } else {
      // Ask Claude to decide the split
      const sampleText = (assets || []).slice(0, 3).map(a =>
        (a.survive_problem_text || a.problem_context || "").substring(0, 300)
      ).filter(Boolean).join("\n---\n");

      const splitResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          system: "You decide the question mix for a quiz. Return a tool call with calc_mc and conceptual_mc counts.",
          messages: [{
            role: "user",
            content: `Topic: ${topic.topic_name}\nDescription: ${topic.topic_description || "N/A"}\n\nSample problem text:\n${sampleText || "No problems available"}\n\nDecide how to split 5 questions between calculation MC and conceptual MC.\nConstraints: min 1 of each, max 4 of either, total must equal 5.\nCalculation MC = questions with numbers, formulas, dollar amounts.\nConceptual MC = definitions, principles, classifications, theory.`
          }],
          max_tokens: 512,
          tools: [{
            name: "return_split",
            description: "Return the question split decision",
            input_schema: {
              type: "object",
              properties: {
                calc_mc: { type: "number", description: "Number of calculation MC questions (1-4)" },
                conceptual_mc: { type: "number", description: "Number of conceptual MC questions (1-4)" },
                reasoning: { type: "string", description: "Brief explanation of why this split was chosen" },
              },
              required: ["calc_mc", "conceptual_mc", "reasoning"],
            },
          }],
          tool_choice: { type: "tool", name: "return_split" },
        }),
      });

      let calcMc = 3, conceptualMc = 2, reasoning = "default fallback";
      if (splitResp.ok) {
        const splitData = await splitResp.json();
        const toolBlock = splitData.content?.find((b: any) => b.type === "tool_use");
        if (toolBlock?.input) {
          const inp = toolBlock.input;
          const c = Math.min(4, Math.max(1, inp.calc_mc || 3));
          const co = Math.min(4, Math.max(1, inp.conceptual_mc || 2));
          // Ensure total = 5
          if (c + co === 5) {
            calcMc = c;
            conceptualMc = co;
          }
          reasoning = inp.reasoning || "";
        }
      }

      mix = {
        calc_mc: calcMc,
        conceptual_mc: conceptualMc,
        je_recall: 0,
        claude_split_metadata: { calc_mc: calcMc, conceptual_mc: conceptualMc, reasoning },
      };
    }

    // ── Build asset context for prompt ──
    const assetContext = (assets || []).map((a, i) => {
      const parts: string[] = [];
      if (a.problem_context) parts.push(`Problem Context: ${(a.problem_context as string).substring(0, 800)}`);
      if (a.survive_solution_text) parts.push(`Solution: ${(a.survive_solution_text as string).substring(0, 800)}`);
      if (a.important_formulas) parts.push(`Formulas: ${JSON.stringify(a.important_formulas).substring(0, 500)}`);
      if (a.concept_notes) parts.push(`Concepts: ${(a.concept_notes as string).substring(0, 500)}`);
      if (a.exam_traps) parts.push(`Exam Traps: ${JSON.stringify(a.exam_traps).substring(0, 500)}`);
      if (a.supplementary_je_json) parts.push(`Journal Entries: ${JSON.stringify(a.supplementary_je_json).substring(0, 600)}`);
      return `--- Asset ${i + 1} ---\n${parts.join("\n")}`;
    }).join("\n\n");

    // ── STEP 3: Call Anthropic AI with tool calling ──
    const totalMc = mix.calc_mc + mix.conceptual_mc;
    const mixDescription = mix.je_recall > 0
      ? `- ${mix.calc_mc} calculation multiple choice (mc) — questions involving numbers, formulas, dollar amounts\n- ${mix.conceptual_mc > 0 ? `${mix.conceptual_mc} conceptual multiple choice (mc) — questions about definitions, principles, classifications\n- ` : ""}${mix.je_recall} journal entry recall (je_recall)`
      : `- ${mix.calc_mc} calculation multiple choice (mc) — questions involving numbers, formulas, dollar amounts\n- ${mix.conceptual_mc} conceptual multiple choice (mc) — questions about definitions, principles, classifications`;

    const systemPrompt = `You are an expert accounting professor generating a quick knowledge-check quiz for undergraduate exam preparation.

Generate exactly 5 questions for this accounting topic. This is a quick knowledge check, not a full exam.

QUESTION MIX:
${mixDescription}

QUALITY RULES:
- Questions must be concise. Question text must be under 3 sentences.
- MC distractors must be plausible but not tricky.
- JE recall: max 3–4 accounts per entry.
- Every question MUST include a explanation_correct field that explains WHY the correct answer is right. This is required — never leave it null or empty.
  For MC questions: explain the calculation or reasoning that leads to the correct answer.
  For JE recall: explain why those specific accounts are debited/credited.

CRITICAL RULE FOR MC ANSWER OPTIONS:
- option_a, option_b, option_c, option_d must contain ONLY the short answer value.
- Examples of CORRECT option values: "$12,000", "18%", "Net income", "$4,500 gain", "Depreciation expense"
- Examples of WRONG option values: "$12,000 because the company recognized revenue" or "The answer is $18,000 which reflects..."
- NEVER include explanations, reasoning, or justifications in option fields.
- All explanations go ONLY in explanation_a, explanation_b, explanation_c, explanation_d fields.
- If the answer is a dollar amount, format it with $ and commas (e.g. "$12,000").

RULES FOR EACH TYPE:

Multiple Choice (mc):
- 4 options (a/b/c/d) — SHORT values only, never sentences of explanation
- Distractors must be plausible — common student mistakes
- Explain why each wrong answer is wrong in the explanation fields, NOT in the option fields

JE Recall (je_recall):
- question_text: Describe the scenario/transaction and ask the student to identify the correct journal entry. The question must NOT indicate which choice is correct in any way. End the question with "Select the journal entry that correctly records this transaction."
- Generate EXACTLY 4 choices using je_option_a through je_option_d.
- Each choice is an array of JE rows: account_name and side only. NO dollar amounts. NO correct answer markers.
- Debits listed before credits. Max 4 accounts per choice.
- Exactly ONE choice is correct. Set correct_answer to the letter of the correct choice.
- The 3 distractors must use these specific patterns:
  PATTERN 1 — Reversed: Same accounts, all debits and credits swapped.
  PATTERN 2 — Wrong account: Replace one account with a plausible wrong account (e.g. Notes Payable instead of Bonds Payable).
  PATTERN 3 — Wrong structure: Add an extra wrong account, or merge two accounts into one incorrect account.
- Randomize which pattern maps to which letter so the correct answer is not always the same position.
- explanation_correct: explain WHY each account is debited or credited. Reference the specific accounts by name. Minimum 30 words.`;

    const jeRecallAddendum = totalJeEntries >= 1
      ? `\n\nFor je_recall questions: Base the correct JE on the actual accounts in the supplementary_je_json entries for assets assigned to this topic. Use those exact account names. Build distractors by modifying those same accounts using the three distractor patterns. Do not invent unrelated accounts.`
      : "";

    const userPrompt = `Topic: ${topic.topic_name}
Description: ${topic.topic_description || "N/A"}
Rationale: ${topic.topic_rationale || "N/A"}
Total JE entries in this topic: ${totalJeEntries}

${assetContext || "No teaching assets available for this topic."}${jeRecallAddendum}`;

    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
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
          { role: "user", content: userPrompt },
        ],
        max_tokens: 4096,
        tools: [
          {
            name: "return_quiz_questions",
            description: "Return the generated quiz questions",
            input_schema: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      question_number: { type: "number" },
                      question_type: { type: "string", enum: ["mc", "je_recall"] },
                      question_text: { type: "string" },
                      option_a: { type: "string" },
                      option_b: { type: "string" },
                      option_c: { type: "string" },
                      option_d: { type: "string" },
                      correct_answer: { type: "string" },
                      explanation_correct: { type: "string", description: "Required. Explains why the correct answer is right. Never empty or null." },
                      explanation_a: { type: "string" },
                      explanation_b: { type: "string" },
                      explanation_c: { type: "string" },
                      explanation_d: { type: "string" },
                      je_description: { type: "string" },
                      je_accounts: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            account_name: { type: "string" },
                            side: { type: "string", enum: ["debit", "credit"] },
                          },
                          required: ["account_name", "side"],
                        },
                      },
                      je_option_a: {
                        type: "array",
                        description: "JE rows for choice A. Required for je_recall.",
                        items: {
                          type: "object",
                          properties: {
                            account_name: { type: "string" },
                            side: { type: "string", enum: ["debit", "credit"] },
                          },
                          required: ["account_name", "side"],
                        },
                      },
                      je_option_b: {
                        type: "array",
                        description: "JE rows for choice B. Required for je_recall.",
                        items: {
                          type: "object",
                          properties: {
                            account_name: { type: "string" },
                            side: { type: "string", enum: ["debit", "credit"] },
                          },
                          required: ["account_name", "side"],
                        },
                      },
                      je_option_c: {
                        type: "array",
                        description: "JE rows for choice C. Required for je_recall.",
                        items: {
                          type: "object",
                          properties: {
                            account_name: { type: "string" },
                            side: { type: "string", enum: ["debit", "credit"] },
                          },
                          required: ["account_name", "side"],
                        },
                      },
                      je_option_d: {
                        type: "array",
                        description: "JE rows for choice D. Required for je_recall.",
                        items: {
                          type: "object",
                          properties: {
                            account_name: { type: "string" },
                            side: { type: "string", enum: ["debit", "credit"] },
                          },
                          required: ["account_name", "side"],
                        },
                      },
                    },
                    required: ["question_number", "question_type", "question_text", "correct_answer", "explanation_correct"],
                  },
                },
              },
              required: ["questions"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "return_quiz_questions" },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await aiResp.text();
      console.error("Anthropic API error:", aiResp.status, errText);
      throw new Error(`Anthropic API error ${aiResp.status}: ${errText}`);
    }

    const aiData = await aiResp.json();
    let questions: any[] = [];

    // Extract from Anthropic tool use response
    const toolBlock = aiData.content?.find((b: any) => b.type === "tool_use");
    if (toolBlock?.input) {
      questions = toolBlock.input.questions ?? [];
    }

    if (questions.length !== 5) {
      throw new Error(`Expected 5 questions, got ${questions.length}. Please try regenerating.`);
    }

    for (const q of questions) {
      if (!q.explanation_correct || q.explanation_correct.trim().length < 10) {
        throw new Error(`Question ${q.question_number} is missing explanation_correct. Please try regenerating.`);
      }
    }

    // ── STEP 4: Store results ──
    await sb.from("topic_quiz_questions").delete().eq("topic_id", topic_id);

    console.log(`[generate-topic-quiz] Storing ${questions.length} questions for topic ${topic_id} (${topic.topic_name})`);

    let insertedCount = 0;
    for (const q of questions) {
      const isJeRecall = q.question_type === "je_recall";

      const questionId = crypto.randomUUID();

      // Log each question's data
      console.log(`[generate-topic-quiz] Q${q.question_number}: id=${questionId}, type=${q.question_type}, correct=${q.correct_answer}`);

      // Log iframe URLs that will be generated
      const BASE = "https://learn.surviveaccounting.com";
      console.log(`[generate-topic-quiz] Q${q.question_number} iframe URLs:`, JSON.stringify({
        question: `${BASE}/quiz-question/${questionId}`,
        choice1: `${BASE}/quiz-choice/${questionId}/1`,
        choice2: `${BASE}/quiz-choice/${questionId}/2`,
        choice3: `${BASE}/quiz-choice/${questionId}/3`,
        choice4: `${BASE}/quiz-choice/${questionId}/4`,
        explanation: `${BASE}/quiz-explanation/${questionId}`,
      }));

      // Log null/empty fields
      const fields: Record<string, any> = {
        question_text: q.question_text,
        correct_answer: q.correct_answer,
        explanation_correct: q.explanation_correct,
        option_a: isJeRecall ? q.je_option_a : q.option_a,
        option_b: isJeRecall ? q.je_option_b : q.option_b,
        option_c: isJeRecall ? q.je_option_c : q.option_c,
        option_d: isJeRecall ? q.je_option_d : q.option_d,
      };
      const nullFields = Object.entries(fields).filter(([, v]) => !v || (typeof v === "string" && v.trim() === "")).map(([k]) => k);
      if (nullFields.length > 0) {
        console.warn(`[generate-topic-quiz] Q${q.question_number} has null/empty fields:`, nullFields);
      }

      const { error: insErr } = await sb.from("topic_quiz_questions").insert({
        id: questionId,
        topic_id,
        chapter_id: topic.chapter_id,
        question_number: q.question_number || insertedCount + 1,
        question_type: q.question_type || "mc",
        question_text: q.question_text || "",
        correct_answer: q.correct_answer || "",
        explanation_correct: q.explanation_correct || "",
        option_a: isJeRecall ? JSON.stringify(q.je_option_a || []) : (q.option_a || null),
        option_b: isJeRecall ? JSON.stringify(q.je_option_b || []) : (q.option_b || null),
        option_c: isJeRecall ? JSON.stringify(q.je_option_c || []) : (q.option_c || null),
        option_d: isJeRecall ? JSON.stringify(q.je_option_d || []) : (q.option_d || null),
        explanation_a: q.explanation_a || null,
        explanation_b: q.explanation_b || null,
        explanation_c: q.explanation_c || null,
        explanation_d: q.explanation_d || null,
        je_accounts: q.je_accounts || null,
        je_description: q.je_description || null,
        example_asset_id: exampleAssetId,
        review_status: "pending",
      } as any);

      if (insErr) {
        console.error(`[generate-topic-quiz] Insert error for Q${q.question_number}:`, insErr);
        continue;
      }
      insertedCount++;
    }

    console.log(`[generate-topic-quiz] Successfully inserted ${insertedCount}/${questions.length} questions`);

    return new Response(
      JSON.stringify({
        success: true,
        questions_generated: insertedCount,
        mix,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-topic-quiz error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
