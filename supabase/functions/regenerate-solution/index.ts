// Edge function: regenerate-solution
// Regenerates an asset's structured solution JSON via OpenAI (o3) and stores
// the original snapshot for revertability. Tracks per-chapter run grouping.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an expert accounting tutor creating structured study solutions for college accounting students preparing for exams.

You must return ONLY a valid JSON object.
No text before or after the JSON.
No markdown code fences.
No explanation.
Just the raw JSON object.

OUTPUT FORMAT:
{
  "parts": [
    {
      "label": "a",
      "instruction": "Brief restatement of what this part asks (max 15 words)",
      "answer_type": "number" | "journal_entry" | "statement" | "calculation" | "list",
      "answer": "The final answer only — concise, no steps. For numbers: '$462,358'. For statements: one clear sentence. For journal entries: null (use journal_entry field instead). For lists: null (use steps field).",
      "steps": "Full step-by-step work showing how to get the answer.\n\nUse this exact formatting:\n\nStep 1. [description]\n[calculation block with alignment]\n  Face value:        $600,000\n  × PV factor:       × 0.31180\n  ──────────────────────────────\n  Result:            $187,080\n\nStep 2. [description]\n\nNarrative explanation lines.\n**Bold** key terms only.\nNo other markdown.\nBlank line between steps.",
      "journal_entry": null
    }
  ]
}

JOURNAL ENTRY PARTS:
For any part requiring a journal entry, set answer_type to 'journal_entry', answer to null, and journal_entry to:
{
  "label": "Journal entry description",
  "lines": [
    { "account": "Account Name", "debit": 462358, "credit": null },
    { "account": "Bonds Payable", "debit": null, "credit": 600000 }
  ]
}

Use numbers not strings for debit/credit.
Use null not 0 for empty cells.

MULTIPLE JOURNAL ENTRIES IN ONE PART:
If a part requires multiple JEs, use journal_entries (array) instead:
"journal_entries": [
  { "label": "January 1, 2024", "lines": [...] },
  { "label": "December 31, 2024", "lines": [...] }
]

ACCOUNTING RULES:
- US GAAP only
- Company name: Survive Company always
- Never invent numbers not in problem
- All JEs must balance (debits = credits)
- Normal balances: Assets/Expenses debit, Liabilities/Equity/Revenue credit
- If data missing:
  answer: "[NEEDS REVIEW — missing: X]"
  steps: "Could not solve — [reason]"

VOICE IN STEPS:
- Confident tutor, never hedging
- "You" perspective where natural
- Show every calculation
- No AI thinking traces
- No: "let's", "let me", "actually", "I believe", "approximately"
- Write as if you knew the answer from the start

COMPLETE EXAMPLE OUTPUT:
{
  "parts": [
    {
      "label": "a",
      "instruction": "Calculate the semiannual cash interest payment",
      "answer_type": "number",
      "answer": "$24,000",
      "steps": "Step 1. Identify the cash payment components.\n\nThe cash payment uses the **face value** and **stated rate** — not the market rate.\n\n  Face value:        $600,000\n  × Stated rate:       × 8%\n  × Semiannual:        × 0.5\n  ──────────────────────────────\n  Cash payment:      $24,000",
      "journal_entry": null
    },
    {
      "label": "b",
      "instruction": "Record the bond issuance at January 1",
      "answer_type": "journal_entry",
      "answer": null,
      "steps": "Survive Company receives $462,358 but must repay $600,000 at maturity. The difference is **Discount on Bonds Payable** — a contra liability.\n\n  Face value:        $600,000\n  − Issue price:     $462,358\n  ──────────────────────────────\n  Discount:          $137,642",
      "journal_entry": {
        "label": "January 1, 2024",
        "lines": [
          { "account": "Cash", "debit": 462358, "credit": null },
          { "account": "Discount on Bonds Payable", "debit": 137642, "credit": null },
          { "account": "Bonds Payable", "debit": null, "credit": 600000 }
        ]
      }
    }
  ]
}`;

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
    "Return the structured JSON solution for all parts. Show all work in the steps field.",
  );
  return lines.join("\n");
}

// Format a number for the text fallback (no decimals if whole, comma-separated)
function fmtAmount(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  const num = Number(n);
  if (!Number.isFinite(num)) return "";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(num) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function jeToText(je: any): string {
  if (!je || !Array.isArray(je.lines)) return "";
  const out: string[] = [];
  out.push(je.label ? `Journal entry (${je.label}):` : "Journal entry:");
  out.push("| Account                    | Debit   | Credit  |");
  for (const line of je.lines) {
    const acct = String(line?.account ?? "").padEnd(26).slice(0, 26);
    const dr = fmtAmount(line?.debit).padStart(7);
    const cr = fmtAmount(line?.credit).padStart(7);
    out.push(`| ${acct} | ${dr} | ${cr} |`);
  }
  return out.join("\n");
}

// Convert structured JSON back to readable text for the existing renderer fallback.
function convertToText(parsed: any): string {
  if (!parsed || !Array.isArray(parsed.parts)) return "";
  const blocks: string[] = [];

  for (const part of parsed.parts) {
    const label = part?.label ?? "";
    const instruction = part?.instruction ?? "";
    const header = label ? `(${label})${instruction ? ` ${instruction}` : ""}` : instruction;
    const sections: string[] = [];
    if (header) sections.push(header);

    if (part?.steps && String(part.steps).trim() !== "") {
      sections.push(String(part.steps).trim());
    }

    if (part?.answer && String(part.answer).trim() !== "") {
      sections.push(`**Answer: ${String(part.answer).trim()}**`);
    }

    if (part?.journal_entry) {
      sections.push(jeToText(part.journal_entry));
    }
    if (Array.isArray(part?.journal_entries)) {
      for (const je of part.journal_entries) {
        sections.push(jeToText(je));
      }
    }

    blocks.push(sections.join("\n\n"));
  }

  return blocks.join("\n\n").trim();
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

  // ---- STEP 1: Fetch asset, then chapter / topic / course context separately ----
  const fetchUrl = `${SUPABASE_URL}/rest/v1/teaching_assets?id=eq.${asset_id}&select=*`;

  let asset: any;
  try {
    const headers = {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
    };

    const r = await fetch(fetchUrl, { headers });
    if (!r.ok) {
      const t = await r.text();
      console.error("Fetch asset failed:", r.status, t);
      return new Response(
        JSON.stringify({ error: "Failed to fetch asset", details: t }),
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

    const [chapterRes, topicRes, courseRes] = await Promise.all([
      row.chapter_id
        ? fetch(`${SUPABASE_URL}/rest/v1/chapters?id=eq.${row.chapter_id}&select=chapter_name,chapter_number`, { headers })
        : Promise.resolve(null),
      row.topic_id
        ? fetch(`${SUPABASE_URL}/rest/v1/chapter_topics?id=eq.${row.topic_id}&select=topic_name`, { headers })
        : Promise.resolve(null),
      row.course_id
        ? fetch(`${SUPABASE_URL}/rest/v1/courses?id=eq.${row.course_id}&select=code,course_name`, { headers })
        : Promise.resolve(null),
    ]);

    const chapter = chapterRes && chapterRes.ok ? (await chapterRes.json())[0] ?? null : null;
    const topic = topicRes && topicRes.ok ? (await topicRes.json())[0] ?? null : null;
    const course = courseRes && courseRes.ok ? (await courseRes.json())[0] ?? null : null;

    asset = {
      ...row,
      chapter_name: chapter?.chapter_name ?? null,
      chapter_number: chapter?.chapter_number ?? null,
      topic_name: topic?.topic_name ?? null,
      course_code: course?.code ?? null,
      course_name: course?.course_name ?? null,
    };
  } catch (err: any) {
    console.error("Fetch asset error:", err);
    return new Response(JSON.stringify({ error: (err as any).message ?? "Fetch failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ---- STEP 2: Build prompt ----
  const userMessage = buildUserMessage(asset);

  // ---- STEP 3: Call OpenAI ----
  let rawContent = "";
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
        // o3 reasoning model: needs ample headroom for internal reasoning tokens.
        max_completion_tokens: 25000,
        response_format: { type: "json_object" },
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
    rawContent = data?.choices?.[0]?.message?.content ?? "";
    tokensUsed = data?.usage?.total_tokens ?? 0;
    modelUsed = data?.model ?? "o3";

    if (!rawContent || rawContent.trim() === "") {
      const finishReason = data?.choices?.[0]?.finish_reason ?? "unknown";
      const completionTokens = data?.usage?.completion_tokens ?? 0;
      const reasoningTokens = data?.usage?.completion_tokens_details?.reasoning_tokens ?? 0;
      throw new Error(
        `Empty content (finish_reason=${finishReason}, completion_tokens=${completionTokens}, reasoning_tokens=${reasoningTokens})`,
      );
    }
  } catch (err: any) {
    console.error("Generation failed:", err);
    if (!dry_run) {
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
              ai_generation_error: String((err as any).message ?? err).slice(0, 2000),
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
        error: String((err as any).message ?? err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // ---- STEP 3b: Parse + validate JSON ----
  let parsed: any = null;
  let parseError: string | null = null;
  try {
    parsed = JSON.parse(rawContent);
    if (!parsed || !Array.isArray(parsed.parts)) {
      throw new Error("Invalid JSON structure from AI (missing parts array)");
    }
  } catch (err: any) {
    parseError = String(err?.message ?? err);
    console.error("JSON parse failed:", parseError);
  }

  // ---- STEP 4: Save (unless dry run) ----
  if (dry_run) {
    return new Response(
      JSON.stringify({
        generated: parsed ?? rawContent,
        format: parsed ? "json" : "text_fallback",
        warning: parseError ? "JSON parse failed" : undefined,
        tokens_used: tokensUsed,
        dry_run: true,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // ---- STEP 4a: JSON parse failed → text-only fallback save ----
  if (!parsed) {
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
            survive_solution_text_original: asset.survive_solution_text ?? null,
            survive_solution_text: rawContent,
            ai_generated_at: new Date().toISOString(),
            ai_model_used: modelUsed,
            ai_generation_status: "complete_text_only",
            ai_chapter_run_id: chapter_run_id ?? null,
            ai_generation_error: "JSON parse failed — text saved",
          }),
        },
      );
    } catch (err) {
      console.error("Text fallback save failed:", err);
    }

    return new Response(
      JSON.stringify({
        success: true,
        asset_id,
        format: "text_fallback",
        warning: "JSON parse failed",
        tokens_used: tokensUsed,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // ---- STEP 4b: Save structured JSON + text fallback ----
  const textVersion = convertToText(parsed);

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
          survive_solution_text: textVersion,
          survive_solution_json: parsed,
          survive_solution_json_generated_at: new Date().toISOString(),
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
        error: String((err as any).message ?? err),
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
      format: "json",
      parts_count: parsed.parts.length,
      tokens_used: tokensUsed,
      model_used: modelUsed,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
