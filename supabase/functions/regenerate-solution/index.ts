// Edge function: regenerate-solution
// Regenerates an asset's survive_solution_text via OpenAI (o3) and stores
// the original snapshot for revertability. Tracks per-chapter run grouping.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an expert accounting tutor writing step-by-step solutions for college accounting students preparing for exams.

Your output is parsed by a custom renderer. You MUST follow these formatting rules exactly or the solution will display incorrectly. Do not deviate from these rules under any circumstances.

━━━━━━━━━━━━━━━━━━
STRUCTURE RULES
━━━━━━━━━━━━━━━━━━

PART LABELS:
Every part must start with its label on its own line, exactly like this:

(a) Calculate the bond issue price.
(b) Prepare the journal entry.

The label (a), (b), (c) etc. must be the very first characters on that line.
Never write "Part (a)" or "a)" — always exactly "(a)".

BLANK LINES:
One blank line between parts.
One blank line between sections within a part.
Never more than two consecutive blank lines.

━━━━━━━━━━━━━━━━━━
CALCULATION RULES
━━━━━━━━━━━━━━━━━━

ALL calculations must be written as aligned monospace-style blocks.

Every calculation line MUST contain at least one of: $, =, ×, ÷, +, −
so the renderer recognizes it as a calculation and formats it correctly.

CORRECT calculation format:

  Face value:              $600,000
  × PV factor (n=20, i=6%): × 0.31180
  ─────────────────────────────────────
  Present value:           $187,080

Use spaces to align the numbers on the right side.
Use a line of dashes ─ before the total.
The × symbol for multiplication.
The − symbol for subtraction.
Always include $ on dollar amounts.

NEVER write calculations as prose:
WRONG: "Multiply 600,000 by 0.31180 to get 187,080"
RIGHT: Use the aligned block format above.

━━━━━━━━━━━━━━━━━━
JOURNAL ENTRY RULES
━━━━━━━━━━━━━━━━━━

Every journal entry must be preceded by exactly this line:

Journal entry:

Then immediately followed by pipe table rows with no blank line between:

Journal entry:
| Account                    | Debit   | Credit  |
| Interest Expense           | 18,000  |         |
| Cash                       |         | 18,000  |

Column format:
| Account name (left padded) | Debit   | Credit  |

- Account column: at least 28 chars wide
- Debit/Credit: right-aligned numbers
- Empty cell for zero: leave blank, do not write 0 or —
- No header row needed unless multiple JEs in same part

Multiple journal entries in one part:

Journal entry (January 1):
| Account    | Debit  | Credit |
| ...        | ...    |        |

Journal entry (June 30):
| Account    | Debit  | Credit |
| ...        | ...    |        |

━━━━━━━━━━━━━━━━━━
BOLD RULES
━━━━━━━━━━━━━━━━━━

Only use **bold** for:
- Key accounting terms on first use
- Final answer statements
- Important warnings or notes

Syntax: **exactly like this**

No italics (*text*) — not supported.
No other markdown — not supported.
Only **bold** works.

━━━━━━━━━━━━━━━━━━
STEP LABELS
━━━━━━━━━━━━━━━━━━

Use numbered steps for multi-step processes:

Step 1. Calculate the present value of the annuity.
Step 2. Calculate the present value of the lump sum.
Step 3. Add both present values.

Format: "Step [N]." at start of line.
The renderer will bold these automatically.

━━━━━━━━━━━━━━━━━━
YEAR HEADERS
━━━━━━━━━━━━━━━━━━

When organizing entries by year or date:

2024:
[content for 2024]

2025:
[content for 2025]

Format: four-digit year followed immediately by colon.
The renderer will bold these automatically.

━━━━━━━━━━━━━━━━━━
VOICE AND STYLE
━━━━━━━━━━━━━━━━━━

- Confident tutor, never hedging
- "You" perspective where natural
- Show every step — never skip to answer
- Company name: Survive Company always
- US GAAP only
- If data missing: write [NEEDS REVIEW]
- Never invent numbers not in problem
- Start immediately with (a) — no preamble, no intro sentence
- Stop after last part — no closing remarks
- No AI thinking traces
- No: "let's", "let me", "actually", "wait", "I need to", "I believe", "approximately", "roughly"

━━━━━━━━━━━━━━━━━━
COMPLETE EXAMPLE OUTPUT
━━━━━━━━━━━━━━━━━━

(a) Calculate the semiannual cash interest payment.

Step 1. Identify the components.

The cash interest payment is based on the **face value** of the bonds and the **stated rate**, not the market rate.

  Face value:           $600,000
  × Stated rate:        × 8%
  × Semiannual factor:  × 1/2
  ─────────────────────────────
  Cash payment:         $24,000

**The semiannual cash interest payment is $24,000.**

(b) Calculate the total issue price.

Step 1. Find the present value of the annuity (interest payments).

  Semiannual payment:  $24,000
  × PV annuity factor: × 11.46992
  (n=20 periods, i=6%)
  ─────────────────────────────
  PV of interest:      $275,278

Step 2. Find the present value of the lump sum (principal).

  Face value:          $600,000
  × PV factor:         × 0.31180
  (n=20 periods, i=6%)
  ─────────────────────────────
  PV of principal:     $187,080

Step 3. Add both present values.

  PV of interest:      $275,278
  + PV of principal:   $187,080
  ─────────────────────────────
  **Issue price:       $462,358**

(c) Prepare the journal entry to record the bond issuance.

Survive Company receives $462,358 but must repay $600,000 at maturity. The difference is recorded as **Discount on Bonds Payable**.

  Issue price:         $462,358
  − Face value:        $600,000
  ─────────────────────────────
  Discount:            $137,642

Journal entry:
| Account                    | Debit   | Credit  |
| Cash                       | 462,358 |         |
| Discount on Bonds Payable  | 137,642 |         |
| Bonds Payable              |         | 600,000 |`;

function postProcess(text: string): string {
  // 1. NORMALIZE LINE ENDINGS
  let result = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // 2. REMOVE AI ARTIFACTS
  const artifacts = [
    /^(let'?s|let me|actually,?|wait,?|hmm,?|so,?)\s/gim,
    /^(in this problem|in this question|to solve this)/gim,
    /^(i'll|i will|i need to|i should)/gim,
    /^(first,? let'?s|now let'?s|next,? let'?s)/gim,
    /\[Note:.*?\]/gi,
    /\(Note:.*?\)/gi,
  ];
  artifacts.forEach((pattern) => {
    result = result.replace(pattern, "");
  });

  // 3. FIX PART LABELS — ensure (a), (b)... are on their own line
  result = result.replace(/([^\n])\(([a-z])\)\s/g, "$1\n\n($2) ");
  // Remove "Part " prefix if present
  result = result.replace(/^Part\s+\(([a-z])\)/gim, "($1)");

  // 4. FIX JOURNAL ENTRY HEADERS — ensure on own line + normalize casing
  result = result.replace(/([^\n])(Journal entry:)/gi, "$1\n$2");
  result = result.replace(
    /^(Journal Entry|journal entry|JOURNAL ENTRY):/gim,
    "Journal entry:",
  );

  // 5. FIX STEP LABELS — "Step 1:" → "Step 1."
  result = result.replace(/^Step\s+(\d+):/gim, "Step $1.");

  // 6. COLLAPSE EXCESS BLANK LINES
  result = result.replace(/\n{3,}/g, "\n\n");

  // 7. TRIM
  return result.trim();
}

function buildUserMessage(asset: any): string {
  const lines: string[] = [];
  const push = (label: string, val: any) => {
    if (val !== null && val !== undefined && String(val).trim() !== "") {
      lines.push(`${label}: ${val}`);
    }
  };

  if (asset.course_name || asset.course_code) {
    const cc = asset.course_code ? ` (${asset.course_code})` : "";
    lines.push(`COURSE: ${asset.course_name ?? ""}${cc}`.trim());
  }
  if (asset.chapter_number || asset.chapter_name) {
    lines.push(
      `CHAPTER: ${asset.chapter_number ?? ""}${
        asset.chapter_name ? ` — ${asset.chapter_name}` : ""
      }`.trim(),
    );
  }
  push("TOPIC", asset.topic_name);
  push("ASSET TYPE", asset.asset_type);
  push("PROBLEM TYPE", asset.problem_type);
  push("DIFFICULTY", asset.difficulty);

  const sourceParts = [asset.source_ref, asset.source_number].filter(Boolean);
  if (sourceParts.length) lines.push(`SOURCE: ${sourceParts.join(" ")}`);

  lines.push("", "PROBLEM:");
  if (asset.survive_problem_text) lines.push(asset.survive_problem_text);
  if (asset.problem_context) lines.push(asset.problem_context);
  if (asset.problem_title) lines.push(asset.problem_title);

  const instr: string[] = [];
  const labels = ["a", "b", "c", "d", "e"];
  const fields = [
    asset.instruction_1,
    asset.instruction_2,
    asset.instruction_3,
    asset.instruction_4,
    asset.instruction_5,
  ];
  fields.forEach((f, i) => {
    if (f && String(f).trim() !== "") instr.push(`(${labels[i]}) ${f}`);
  });

  if (instr.length === 0 && asset.instruction_list) {
    instr.push(asset.instruction_list);
  }

  if (instr.length > 0) {
    lines.push("", "INSTRUCTIONS:");
    instr.forEach((i) => lines.push(i));
  }

  lines.push(
    "",
    "Write the complete step-by-step solution for all parts. Show all work.",
  );
  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { asset_id, chapter_run_id, dry_run = false } = body || {};

  if (!asset_id || typeof asset_id !== "string") {
    return new Response(JSON.stringify({ error: "asset_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // ---- STEP 1: Fetch asset with joined chapter / topic / course context ----
  const selectCols =
    "*,chapters(chapter_name,chapter_number),chapter_topics(topic_name),courses(code,course_name)";
  const fetchUrl = `${SUPABASE_URL}/rest/v1/teaching_assets?id=eq.${asset_id}&select=${
    encodeURIComponent(selectCols)
  }`;

  let asset: any;
  try {
    const r = await fetch(fetchUrl, {
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
      },
    });
    if (!r.ok) {
      const t = await r.text();
      console.error("Fetch asset failed:", r.status, t);
      return new Response(
        JSON.stringify({ error: "Failed to fetch asset" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const rows = await r.json();
    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ error: "Asset not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const row = rows[0];
    asset = {
      ...row,
      chapter_name: row.chapters?.chapter_name ?? null,
      chapter_number: row.chapters?.chapter_number ?? null,
      topic_name: row.topics?.topic_name ?? null,
      course_code: row.courses?.code ?? null,
      course_name: row.courses?.course_name ?? null,
    };
  } catch (err: any) {
    console.error("Fetch asset error:", err);
    return new Response(JSON.stringify({ error: err.message ?? "Fetch failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ---- STEP 2: Build prompt ----
  const userMessage = buildUserMessage(asset);

  // ---- STEP 3: Call OpenAI ----
  let generatedSolution = "";
  let tokensUsed = 0;
  let modelUsed = "o3";

  try {
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "o3",
        max_completion_tokens: 4000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("OpenAI error:", aiRes.status, errText);
      throw new Error(`OpenAI ${aiRes.status}: ${errText.slice(0, 500)}`);
    }

    const data = await aiRes.json();
    generatedSolution = data?.choices?.[0]?.message?.content ?? "";
    tokensUsed = data?.usage?.total_tokens ?? 0;
    modelUsed = data?.model ?? "o3";

    if (!generatedSolution || generatedSolution.trim() === "") {
      throw new Error("OpenAI returned empty content");
    }

    // Post-process AI output before returning/saving
    generatedSolution = postProcess(generatedSolution);
  } catch (err: any) {
    console.error("Generation failed:", err);
    if (!dry_run) {
      // Mark asset as failed
      try {
        await fetch(
          `${SUPABASE_URL}/rest/v1/teaching_assets?id=eq.${asset_id}`,
          {
            method: "PATCH",
            headers: {
              apikey: SERVICE_ROLE,
              Authorization: `Bearer ${SERVICE_ROLE}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              ai_generation_status: "failed",
              ai_generation_error: String(err.message ?? err).slice(0, 2000),
            }),
          },
        );
      } catch (patchErr) {
        console.error("Failed to mark asset failed:", patchErr);
      }
    }
    return new Response(
      JSON.stringify({
        success: false,
        asset_id,
        error: String(err.message ?? err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // ---- STEP 4: Save (unless dry run) ----
  if (dry_run) {
    return new Response(
      JSON.stringify({
        generated: generatedSolution,
        tokens_used: tokensUsed,
        dry_run: true,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const patchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/teaching_assets?id=eq.${asset_id}`,
      {
        method: "PATCH",
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          // Snapshot original BEFORE overwriting
          survive_solution_text_original: asset.survive_solution_text ?? null,
          survive_solution_text: generatedSolution,
          ai_generated_at: new Date().toISOString(),
          ai_model_used: modelUsed,
          ai_generation_status: "complete",
          ai_chapter_run_id: chapter_run_id ?? null,
          ai_generation_error: null,
        }),
      },
    );

    if (!patchRes.ok) {
      const t = await patchRes.text();
      throw new Error(`DB update failed: ${patchRes.status} ${t.slice(0, 500)}`);
    }
  } catch (err: any) {
    console.error("Save failed:", err);
    return new Response(
      JSON.stringify({
        success: false,
        asset_id,
        error: String(err.message ?? err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // ---- STEP 5: Return success ----
  return new Response(
    JSON.stringify({
      success: true,
      asset_id,
      tokens_used: tokensUsed,
      model_used: modelUsed,
      preview: generatedSolution.slice(0, 200),
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
