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
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;

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
      .select("problem_context, survive_solution_text, important_formulas, concept_notes, exam_traps, supplementary_je_json")
      .eq("topic_id", topic_id);
    if (assetErr) throw assetErr;

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

    let mix: { mc: number; true_false: number; je_recall: number };
    if (totalJeEntries >= 5) {
      mix = { mc: 2, true_false: 1, je_recall: 2 };
    } else if (totalJeEntries >= 1) {
      mix = { mc: 3, true_false: 1, je_recall: 1 };
    } else {
      mix = { mc: 4, true_false: 1, je_recall: 0 };
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

    // ── STEP 3: Call Lovable AI with tool calling ──
    const mixDescription = `- ${mix.mc} multiple choice (mc)\n- ${mix.true_false} true/false (true_false)\n- ${mix.je_recall} journal entry recall (je_recall)`;

    const systemPrompt = `You are an expert accounting professor generating quiz questions for undergraduate exam preparation.

Generate exactly 10 questions for this accounting topic. Questions must test DEEP understanding — not surface memorization.

QUESTION MIX:
${mixDescription}

RULES FOR EACH TYPE:

Multiple Choice (mc):
- 4 options (a/b/c/d)
- Distractors must be plausible — common student mistakes
- Mix conceptual and computational
- Explain why each wrong answer is wrong

True/False (true_false):
- Statement must be clear and unambiguous
- Avoid trick questions
- Explain why the false option is wrong

JE Recall (je_recall):
- Give a transaction description
- Student identifies which accounts to debit and credit
- No amounts required
- List 2–4 accounts with their correct debit/credit side
- Explain the reasoning`;

    const userPrompt = `Topic: ${topic.topic_name}
Description: ${topic.topic_description || "N/A"}
Rationale: ${topic.topic_rationale || "N/A"}
Total JE entries in this topic: ${totalJeEntries}

${assetContext || "No teaching assets available for this topic."}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
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
              name: "return_quiz_questions",
              description: "Return the generated quiz questions",
              parameters: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question_number: { type: "number" },
                        question_type: { type: "string", enum: ["mc", "true_false", "je_recall"] },
                        question_text: { type: "string" },
                        option_a: { type: "string" },
                        option_b: { type: "string" },
                        option_c: { type: "string" },
                        option_d: { type: "string" },
                        correct_answer: { type: "string" },
                        explanation_correct: { type: "string" },
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
                      },
                      required: ["question_number", "question_type", "question_text", "correct_answer", "explanation_correct"],
                    },
                  },
                },
                required: ["questions"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_quiz_questions" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, errText);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResp.json();
    let questions: any[] = [];

    // Extract from tool call
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed =
        typeof toolCall.function.arguments === "string"
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
      questions = parsed.questions ?? [];
    }

    if (!questions.length) {
      throw new Error("AI returned no questions — please try again");
    }

    // ── STEP 4: Store results ──
    await sb.from("topic_quiz_questions").delete().eq("topic_id", topic_id);

    let insertedCount = 0;
    for (const q of questions.slice(0, 10)) {
      const { error: insErr } = await sb.from("topic_quiz_questions").insert({
        topic_id,
        chapter_id: topic.chapter_id,
        question_number: q.question_number || insertedCount + 1,
        question_type: q.question_type || "mc",
        question_text: q.question_text || "",
        correct_answer: q.correct_answer || "",
        explanation_correct: q.explanation_correct || "",
        option_a: q.option_a || null,
        option_b: q.option_b || null,
        option_c: q.option_c || null,
        option_d: q.option_d || null,
        explanation_a: q.explanation_a || null,
        explanation_b: q.explanation_b || null,
        explanation_c: q.explanation_c || null,
        explanation_d: q.explanation_d || null,
        je_accounts: q.je_accounts || null,
        je_description: q.je_description || null,
        review_status: "pending",
      } as any);

      if (insErr) {
        console.error("Insert error:", insErr);
        continue;
      }
      insertedCount++;
    }

    return new Response(
      JSON.stringify({ success: true, questions_generated: insertedCount, mix }),
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
