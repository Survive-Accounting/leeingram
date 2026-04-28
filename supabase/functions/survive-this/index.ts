import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Lee, an encouraging accounting tutor inside Survive Accounting. Warm, sharp, and direct — like the smartest friend in your accounting class who actually wants you to understand, not just get the answer.

Your rules:
- ALWAYS render data tables as raw HTML using <table> tags. Never use markdown pipes or dashes for tables. Use semantic <thead>, <tbody>, <th>, <td>. Mark a totals row with class="total".
- For lists, use plain HTML <ul> or <ol> — not markdown dashes or asterisks.
- Use <strong> for bold (not **). Use <br> only for hard line breaks inside a paragraph.
- Never dump everything at once. Be conversational. One idea at a time.
- Plain English first, then the accounting term. Example: "the stuff still in the warehouse (ending inventory)".
- When you give a step, end with a soft prompt that invites the next step — never a dead end.
- Keep responses under 180 words unless a table is present. With a table, keep prose under 80 words total.
- Never say "Great question!" or "Certainly!" — just answer.
- If a student seems stuck or wrong, be kind. Start with what they got right.
- Format dollars with $ and commas. Always label units.
- Tutor voice: second-person "you", short punchy sentences, cause-and-effect.
- Never hedge. Never use AI phrases like "as an AI" or "I can't actually".

The problem context will be injected below each prompt. Always work from the exact numbers given.`;

function buildUserPrompt(promptType: string, ctx: any): string {
  const course = ctx?.course_name || "";
  const chapter = ctx?.chapter_name || "";
  const topic = ctx?.topic_name || "";
  const problem = ctx?.problem_text || "";
  const instructions = ctx?.instructions || "";

  switch (promptType) {
    case "walk_through":
      return `A student needs a guided, step-by-step walkthrough of this accounting problem. Walk them through it ONE STEP AT A TIME — do NOT show all steps upfront.

Start at Step 1 only. Format:
- Bold "Step 1 of [N] — [short title]" using <strong> tags
- 2-3 sentences explaining what they're doing and why
- Then the actual work for THIS step (use an HTML <table> if numbers/layers are involved)
- End with: "Ready for step 2?" or a soft comprehension question that previews step 2

Pick the right step structure for the problem type. Examples:
- Inventory cost-flow: (1) Build layers table, (2) Confirm units available vs on hand, (3) Apply method to isolate EI layers, (4) Multiply units × cost, (5) Sum to EI value
- Bond amortization: (1) Identify face/coupon/market, (2) Compute issue price, (3) Build amortization row, (4) Record entries
- Adjusting entries: (1) Identify what changed, (2) Determine the accounts touched, (3) Compute the amount, (4) Write the JE
Adjust step count to fit. Maximum 6 steps total.

Course: ${course} | Chapter: ${chapter} | Topic: ${topic}
Problem: ${problem}
Instructions: ${instructions}`;

    case "hint":
      return `A student is stuck and needs ONE hint — not the answer, not a walkthrough. One nudge that unsticks them.

Rules:
- Identify the single most likely sticking point for this type of problem
- Give ONE clue pointing them in the right direction
- End with a question that helps them take the next step themselves
- Do NOT show any calculations or tables
- Maximum 3 sentences total
- Tone: a tutor leaning over and whispering "look at this part…"

Chapter: ${chapter}
Problem: ${problem}
Instructions: ${instructions}`;

    case "setup":
      return `A student wants to see how to SET UP this problem before solving it. Give them the scaffold, not the solution.

Produce an HTML <table> with the right shell for this problem (e.g., for inventory: date | units purchased | cost per unit | "Units in EI" empty | "Layer total" empty, with a totals row). For other problem types, build the appropriate empty worksheet (T-accounts, amortization shell, JE template, etc.).

Then 2 lines beneath the table:
- One sentence: the key rule that determines what fills the blanks (e.g. "Under FIFO, the newest layers fill ending inventory first")
- One sentence: the target (e.g. "You need to account for 150 units on hand")

Do NOT solve it. This is a blank worksheet they fill in. Tone: calm, organized.

Chapter: ${chapter}
Problem: ${problem}
Instructions: ${instructions}`;

    case "full_solution":
      return `A student wants the complete solution. Give it clearly and completely. They already tried — give them the clean answer.

Format:
1. ONE sentence: which method/approach you're using and why it determines what's in the answer
2. HTML <table> with the actual solution rows (label, units, cost, amount, etc.). Include a row with class="total" containing the final answer in <strong>.
3. TWO sentences max beneath: one connecting the table to the final number, one noting what would change under a different method or assumption

Do not hedge. Do not over-explain. Use the actual numbers from the problem.

Chapter: ${chapter}
Problem: ${problem}
Instructions: ${instructions}`;

    case "challenge":
      return `A student wants a challenge question on this topic — something that makes them THINK, not just recall.

Write ONE conceptual question that:
- Cannot be answered by re-reading the problem
- Forces reasoning about WHY the accounting rule works the way it does
- References the actual numbers or scenario in this problem
- Has a non-obvious answer that rewards thinking

Good types: "What would change if…", "Why do you think…", "Which company would prefer X and why…", "If the auditor found one more unit…"

After the question, add one line: <em>"Type your answer below — I'll tell you if you're on the right track."</em>

Do NOT give hints, setup, or the answer. Just the question. Tone: a professor who genuinely wants to see you think.

Chapter: ${chapter}
Problem: ${problem}`;

    case "challenge_followup": {
      const studentAnswer = ctx?.student_answer || "";
      const originalQuestion = ctx?.original_response || "";
      return `A student answered a challenge question on this accounting topic. Evaluate their response warmly and precisely.

The challenge question was about this problem:
Chapter: ${chapter}
Problem: ${problem}

The original challenge question text was:
"""
${originalQuestion}
"""

The student's answer:
"""
${studentAnswer}
"""

Your response (under 120 words):
1. First line: tell them clearly if they're correct, partially correct, or off-track. Be direct, no hedging.
2. If correct: confirm the reasoning, then offer a harder follow-up question (one sentence)
3. If partially correct: identify what they got right first, then correct the gap with the full reasoning
4. If off-track: start with what's valid in their thinking, then redirect with the correct reasoning
5. End with: "Want to try another challenge?" or "Ready for the next part?"

Tone: a tutor who's genuinely impressed when students engage.`;
    }

    case "similar_problem":
      return `Generate a NEW practice problem similar in structure to the one below, but with different numbers, dates, and company name.

Requirements:
- Same method types tested
- Different unit quantities, prices, and dates
- Include one subtle trap (e.g., a purchase after the last sale, or units that don't divide cleanly)
- End with the same multi-part question style: (a), (b), (c)…
- Do NOT include the solution
- Use "Survive Company A" as the company name

Format: problem statement only, in clean HTML paragraphs (use <p> tags). No preamble, no "Here's a similar problem". Just start with the problem.

Original (for structure reference):
Chapter: ${chapter}
Problem: ${problem}`;

    case "memorize":
      return `A student wants to know exactly what to memorize for this topic — nothing more.

Give them a tight, scannable cheat sheet:
- 3-5 rules or facts they need cold for the exam (use <strong> to bold the rule, then one sentence explanation)
- 1-2 key formulas written simply (also bolded)
- Any exam-day exceptions worth knowing

Format: one HTML <ul> list. Bold each rule with <strong>. One sentence each. No full lesson — this is memory only.

Chapter: ${chapter} | Topic: ${topic}
Problem: ${problem}`;

    case "journal_entries":
      return `A student wants the journal entries for this problem broken down clearly.

Explain:
1. What economic event each entry records (plain English first, then the accounting term)
2. Which accounts are debited/credited and the intuition behind each
3. The most common mistake students make with these entries on exams

For each journal entry, render an HTML <table> with three columns: Account | Debit | Credit. Use the actual amounts from the problem. Multiple entries = multiple tables.

Then one short paragraph (under 60 words) on the most common exam trap with these entries.

Tone: clinical and precise. Students reading this are learning entries.

Chapter: ${chapter}
Problem: ${problem}`;

    case "financial_statements":
      return `Show the student exactly how this problem's results appear on the financial statements.

Produce TWO mini-statement excerpts as HTML <table> elements:
1. Income statement excerpt showing the relevant calculation (e.g., for inventory: Beg Inv + Purchases − End Inv = COGS → Gross Profit). Use actual numbers from the problem.
2. Balance sheet excerpt showing where this problem's ending value sits (e.g., Inventory under Current Assets).

Beneath each table, ONE sentence: what would change under a different method or assumption.

Keep it to two tables and two sentences. No preamble.

Chapter: ${chapter}
Problem: ${problem}
Instructions: ${instructions}`;

    case "real_world":
      return `Give a real-world example of how this accounting concept applies in actual business.

Requirements:
- Reference a real company or industry by name if possible
- Explain WHY they use the method they use (business reason, not just the rule)
- Connect it back: "In your problem, Survive Company A is doing the same thing as…"
- One sentence on the financial impact of their choice (taxes, balance sheet, comparability)

Maximum 120 words. No tables. Tone: a professor who worked in industry before teaching — grounded, not textbook.

Chapter: ${chapter}
Topic derived from problem: ${problem}`;

    case "professor_tricks":
      return `A student wants to know the exam traps on this topic. Be direct and specific.

List exactly 3-4 ways professors trick students on this type of problem. Use an HTML <ol> ordered list. For each trap:
- <strong>The trap name</strong>
- One sentence: what the trap is
- One sentence: why students fall for it
- One sentence: how to avoid it

Make every trap concrete to THIS problem type — not generic study advice. Where applicable, include at least one trap about: periodic vs perpetual, cash vs accrual, recognition timing, or rising/falling prices affecting method choice (whichever fits).

Tone: a TA who has graded 500 of these.

Chapter: ${chapter}
Problem: ${problem}`;

    case "the_why":
      return `A student wants to understand WHY this accounting rule exists — not how to calculate, but the conceptual reasoning.

Explain:
1. The reason the rule exists (matching principle, conservatism, economic reality, or legal requirement — whichever applies)
2. The real-world impact of the choice on taxes and reported income (direction only, no made-up numbers)
3. Why GAAP allows multiple methods here (or doesn't) — the trade-off between comparability and relevance

No tables. No formulas. Write like you're answering "but WHY does any of this matter?" from a frustrated student.
Maximum 150 words. Tone: honest, a little philosophical.

Chapter: ${chapter}
Problem: ${problem}`;

    // Legacy fallback — kept so old cached rows don't break
    case "strategy":
      return `A student needs a study strategy for this problem before they start.
Course: ${course} | Chapter: ${chapter} | Topic: ${topic}
Problem: ${problem}
Instructions: ${instructions}
Give them: (1) What accounting concept this tests, (2) Best approach before calculating, (3) One specific exam strategy tip.`;

    default:
      return `Help the student understand this problem.
Chapter: ${chapter}
Problem: ${problem}
Instructions: ${instructions}`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "OPENAI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sb = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { asset_id, prompt_type, context, skip_cache } = body || {};
    const skipCache = skip_cache === true;

    if (!asset_id || !prompt_type) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing asset_id or prompt_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // STEP 1 — CHECK CACHE (skipped for challenge_followup or when caller passes skip_cache)
    if (!skipCache) {
      const { data: cached } = await sb
        .from("survive_ai_responses")
        .select("response_text")
        .eq("asset_id", asset_id)
        .eq("prompt_type", prompt_type)
        .limit(1)
        .maybeSingle();

      if (cached?.response_text) {
        return new Response(
          JSON.stringify({
            success: true,
            cached: true,
            response_text: cached.response_text,
            prompt_type,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // STEP 2/3 — Build prompts
    const userPrompt = buildUserPrompt(prompt_type, context || {});

    // STEP 4 — CALL OPENAI (o3 reasoning model)
    const model = "o3";
    let responseText = "";

    try {
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
          // o3 is a reasoning model — most tokens go to internal reasoning.
          // 2000 gives table-heavy responses (full_solution, financial_statements,
          // walk_through step 1) enough headroom not to truncate.
          max_completion_tokens: 2000,
          response_format: { type: "text" },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("OpenAI API error:", res.status, errText);
        return new Response(
          JSON.stringify({ success: false, error: `OpenAI error: ${res.status} ${errText}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const data = await res.json();
      responseText = data?.choices?.[0]?.message?.content?.trim() || "";

      if (!responseText) {
        console.error("Empty OpenAI response", { finish_reason: data?.choices?.[0]?.finish_reason, usage: data?.usage });
        return new Response(
          JSON.stringify({ success: false, error: "Empty response from OpenAI" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } catch (e: any) {
      console.error("OpenAI call failed:", e);
      return new Response(
        JSON.stringify({ success: false, error: e?.message || "OpenAI call failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // STEP 5 — SAVE TO CACHE
    // Skip the write for challenge_followup (per-student answers) and any
    // explicit skip_cache request — avoids per-student row pollution and
    // potential unique-constraint conflicts on (asset_id, prompt_type).
    if (!skipCache && prompt_type !== "challenge_followup") {
      try {
        await sb.from("survive_ai_responses").insert({
          asset_id,
          prompt_type,
          response_text: responseText,
          model_used: model,
        } as any);
      } catch (e) {
        console.warn("Cache insert skipped:", (e as any)?.message);
      }
    }

    // STEP 6 — RETURN
    return new Response(
      JSON.stringify({
        success: true,
        cached: false,
        response_text: responseText,
        prompt_type,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("survive-this fatal error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
