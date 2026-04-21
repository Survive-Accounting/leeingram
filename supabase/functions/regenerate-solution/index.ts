// Edge function: regenerate-solution
// Regenerates an asset's survive_solution_text via OpenAI (o3) and stores
// the original snapshot for revertability. Tracks per-chapter run grouping.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an expert accounting tutor writing step-by-step solutions for college accounting students preparing for exams.

VOICE AND STYLE:
- Confident tutor explaining to a struggling student
- Use "you" perspective where natural
- Show every single step — never skip to the answer
- All calculations displayed in aligned monospace:
  Face value:      $600,000
  × PV factor:     × 0.31180
  ─────────────────────────
  Present value:   $187,080
- Label each instruction part clearly: (a), (b), (c)
- Bold key terms on first use
- Final answer for each part stated clearly

ACCOUNTING RULES:
- US GAAP only — never mention IFRS unless asked
- Never invent numbers — derive everything from the problem text only
- Normal balances: Assets/Expenses debit, Liabilities/Equity/Revenue credit
- All journal entries must balance exactly
- Company name throughout: Survive Company
- If a figure cannot be derived from the problem text: write [NEEDS REVIEW] and explain what's missing
- Never guess or approximate

FORMAT RULES:
- Begin immediately with the solution
- No preamble, no "In this problem we will..."
- No summary of what you're about to do
- No AI thinking traces
- No phrases: "let's", "let me", "actually", "wait", "I need to", "let me recalculate"
- No hedging: "approximately", "roughly", "I believe", "it seems"
- Write as if you knew the answer from the start
- One blank line between parts
- Monospace blocks for all calculations
- Journal entry format:
  | Account | Debit | Credit |
  |---------|-------|--------|
  | Cash    | X     |        |
  | Revenue |       | X      |

CRITICAL:
- Do not reproduce problem text verbatim
- Do not add closing remarks after final answer
- Stop after the last part is answered`;

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
    "*,chapters(chapter_name,chapter_number),topics(topic_name),courses(code,course_name)";
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
