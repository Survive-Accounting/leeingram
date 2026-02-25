import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { assets, journalOption } = await req.json();
    // assets: array of { asset_name, survive_problem_text, journal_entry_block, survive_solution_text }
    // journalOption: "question" | "feedback" | "none"

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("Missing LOVABLE_API_KEY");

    const prompt = `You are a university accounting exam question writer. For each teaching asset below, generate 3 plausible but INCORRECT distractor answers for a multiple choice question.

The correct answer is the journal entry block (if present) or a short summary of the solution.

For each asset, return:
- correct_answer: the correct answer text (use journal_entry_block if available, otherwise a concise correct answer derived from the solution)
- distractor_1, distractor_2, distractor_3: plausible wrong answers that a student might pick. They should:
  - Use similar formatting to the correct answer
  - Contain common student mistakes (wrong accounts, reversed debits/credits, wrong amounts)
  - Be clearly different from each other

Return a JSON array with one object per asset, in the same order as input.
Each object: { "correct_answer": "...", "distractor_1": "...", "distractor_2": "...", "distractor_3": "..." }

Assets:
${assets.map((a: any, i: number) => `
--- Asset ${i + 1}: ${a.asset_name} ---
Problem: ${a.survive_problem_text}
Journal Entry: ${a.journal_entry_block || "N/A"}
Solution: ${a.survive_solution_text}
`).join("\n")}

Return ONLY the JSON array, no markdown fences.`;

    const res = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`AI API error: ${res.status} ${errText}`);
    }

    const aiData = await res.json();
    let content = aiData.choices?.[0]?.message?.content ?? "[]";
    
    // Strip markdown fences if present
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    const distractors = JSON.parse(content);

    return new Response(JSON.stringify({ distractors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
