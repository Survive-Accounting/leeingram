import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logCost } from "../_shared/cost.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ChapterInfo = {
  id: string;
  chapter_name: string;
  chapter_number: number;
  courseCode: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const sb = createClient(supabaseUrl, serviceKey);
    const body = await req.json();

    let chapters: ChapterInfo[] = [];

    if (body.all === true) {
      const { data: allCh } = await sb.from("chapters").select("id, chapter_name, chapter_number, course_id").order("chapter_number");
      const { data: courses } = await sb.from("courses").select("id, code");
      const courseMap = Object.fromEntries((courses || []).map((c: any) => [c.id, c.code]));
      chapters = (allCh || []).map((ch: any) => ({
        id: ch.id,
        chapter_name: ch.chapter_name,
        chapter_number: ch.chapter_number,
        courseCode: courseMap[ch.course_id] || "Unknown",
      }));
    } else if (body.chapterId) {
      if (body.chapterName && body.courseCode) {
        chapters = [{ id: body.chapterId, chapter_name: body.chapterName, chapter_number: 0, courseCode: body.courseCode }];
      } else {
        const { data: ch } = await sb.from("chapters").select("id, chapter_name, chapter_number, course_id, courses!chapters_course_id_fkey(code)").eq("id", body.chapterId).single();
        if (!ch) throw new Error("Chapter not found");
        chapters = [{ id: ch.id, chapter_name: ch.chapter_name, chapter_number: ch.chapter_number, courseCode: (ch as any).courses?.code || "" }];
      }
    } else {
      return new Response(JSON.stringify({ error: "Provide chapterId or all:true" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allResults: any[] = [];
    const errors: string[] = [];
    let completed = 0;

    for (const ch of chapters) {
      try {
        const result = await generateSuiteForChapter(sb, anthropicKey, ch);
        allResults.push({ chapterId: ch.id, chapterName: ch.chapter_name, results: result });
        completed++;
      } catch (err: any) {
        errors.push(`${ch.chapter_name}: ${err.message}`);
      }
    }

    return new Response(
      JSON.stringify({ completed, total: chapters.length, errors, results: allResults }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("generate-chapter-content-suite error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Anthropic helper ────────────────────────────────────────────────────

async function callAnthropic(anthropicKey: string, system: string, user: string): Promise<{ parsed: any; usage: any }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const rawText = data.content?.[0]?.text || "";

  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      // Attempt repair: strip trailing commas before } or ]
      const cleaned = jsonMatch[0].replace(/,\s*([}\]])/g, "$1");
      parsed = JSON.parse(cleaned);
    } else {
      throw new Error("Could not parse AI response as JSON");
    }
  }

  return { parsed, usage: data.usage };
}

// ─── Main suite generator ────────────────────────────────────────────────

async function generateSuiteForChapter(sb: any, anthropicKey: string, ch: ChapterInfo) {
  const label = `${ch.chapter_name} (${ch.courseCode})`;
  const now = new Date().toISOString();
  const results: Record<string, string | number> = {};

  // ━━━ CALL 1: chapter_purpose ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  try {
    const { parsed, usage } = await callAnthropic(
      anthropicKey,
      `Return ONLY valid JSON:\n{\n  "purpose_text": "2-3 sentence paragraph explaining what accountants are trying to accomplish in this chapter and why it matters in the real world.",\n  "consequence_text": "1-2 sentences describing the biggest consequence for a business that gets this wrong or ignores it entirely. Be specific and concrete — what actually goes wrong?"\n}`,
      `Chapter: ${label}`
    );

    logCost(sb, { operation_type: "chapter_purpose_generation", chapter_id: ch.id, model: "claude-sonnet-4-20250514", input_tokens: usage?.input_tokens, output_tokens: usage?.output_tokens, metadata: { chapter_name: ch.chapter_name } });

    // Upsert: check if row exists
    const { data: existing } = await sb.from("chapter_purpose").select("id").eq("chapter_id", ch.id).maybeSingle();
    if (existing) {
      await sb.from("chapter_purpose").update({
        purpose_text: parsed.purpose_text,
        consequence_text: parsed.consequence_text,
        generated_at: now,
        updated_at: now,
      }).eq("id", existing.id);
    } else {
      await sb.from("chapter_purpose").insert({
        chapter_id: ch.id,
        purpose_text: parsed.purpose_text,
        consequence_text: parsed.consequence_text,
        generated_at: now,
      });
    }
    results.purpose = "ok";
  } catch (err: any) {
    console.error(`Purpose error for ${label}:`, err.message);
    results.purpose = "error";
  }

  // ━━━ CALL 2: chapter_key_terms ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  try {
    const { parsed, usage } = await callAnthropic(
      anthropicKey,
      `Return ONLY valid JSON:\n{\n  "terms": [\n    {\n      "term": "Bond Premium",\n      "definition": "Plain-English one sentence. No textbook language. Write like a tutor explaining to a confused student.",\n      "sort_order": 1\n    }\n  ]\n}`,
      `Generate 6-10 key terms a student must know for exams in: ${label}.\nOnly terms introduced or heavily used in this chapter.\n\nReturn valid JSON only.`
    );

    logCost(sb, { operation_type: "chapter_key_terms_generation", chapter_id: ch.id, model: "claude-sonnet-4-20250514", input_tokens: usage?.input_tokens, output_tokens: usage?.output_tokens, metadata: { chapter_name: ch.chapter_name } });

    const terms = parsed.terms || [];
    await sb.from("chapter_key_terms").delete().eq("chapter_id", ch.id).eq("is_approved", false);
    if (terms.length) {
      await sb.from("chapter_key_terms").insert(terms.map((t: any) => ({
        chapter_id: ch.id, term: t.term, definition: t.definition, sort_order: t.sort_order || 0, generated_at: now,
      })));
    }
    results.key_terms = terms.length;
  } catch (err: any) {
    console.error(`Key terms error for ${label}:`, err.message);
    results.key_terms = "error";
  }

  // ━━━ CALL 3: chapter_exam_mistakes ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  try {
    const { parsed, usage } = await callAnthropic(
      anthropicKey,
      `Return ONLY valid JSON:\n{\n  "mistakes": [\n    {\n      "mistake": "Short label for the mistake (8 words max)",\n      "explanation": "One sentence explaining why students make this mistake and what to do instead.",\n      "sort_order": 1\n    }\n  ]\n}`,
      `Generate 4-6 common exam mistakes students make in: ${label}.\nFocus on mistakes that cost exam points. Be specific — not generic accounting advice.\n\nReturn valid JSON only.`
    );

    logCost(sb, { operation_type: "chapter_exam_mistakes_generation", chapter_id: ch.id, model: "claude-sonnet-4-20250514", input_tokens: usage?.input_tokens, output_tokens: usage?.output_tokens, metadata: { chapter_name: ch.chapter_name } });

    const mistakes = parsed.mistakes || [];
    await sb.from("chapter_exam_mistakes").delete().eq("chapter_id", ch.id).eq("is_approved", false);
    if (mistakes.length) {
      await sb.from("chapter_exam_mistakes").insert(mistakes.map((m: any) => ({
        chapter_id: ch.id, mistake: m.mistake, explanation: m.explanation || null, sort_order: m.sort_order || 0, generated_at: now,
      })));
    }
    results.exam_mistakes = mistakes.length;
  } catch (err: any) {
    console.error(`Exam mistakes error for ${label}:`, err.message);
    results.exam_mistakes = "error";
  }

  // ━━━ CALL 4: chapter_exam_checklist ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  try {
    const { parsed, usage } = await callAnthropic(
      anthropicKey,
      `Return ONLY valid JSON:\n{\n  "items": [\n    {\n      "checklist_item": "Before your exam, make sure you can: [specific skill or task]",\n      "sort_order": 1\n    }\n  ]\n}`,
      `Generate 5-8 exam prep checklist items for: ${label}.\nEach item starts with "Before your exam, make sure you can:" followed by a specific, testable skill.\nFocus on what actually appears on exams.\n\nReturn valid JSON only.`
    );

    logCost(sb, { operation_type: "chapter_exam_checklist_generation", chapter_id: ch.id, model: "claude-sonnet-4-20250514", input_tokens: usage?.input_tokens, output_tokens: usage?.output_tokens, metadata: { chapter_name: ch.chapter_name } });

    const items = parsed.items || [];
    await sb.from("chapter_exam_checklist").delete().eq("chapter_id", ch.id).eq("is_approved", false);
    if (items.length) {
      await sb.from("chapter_exam_checklist").insert(items.map((it: any) => ({
        chapter_id: ch.id, checklist_item: it.checklist_item, sort_order: it.sort_order || 0, generated_at: now,
      })));
    }
    results.exam_checklist = items.length;
  } catch (err: any) {
    console.error(`Exam checklist error for ${label}:`, err.message);
    results.exam_checklist = "error";
  }

  // ━━━ CALL 5: chapter_accounts ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  try {
    const { parsed, usage } = await callAnthropic(
      anthropicKey,
      `Return ONLY valid JSON:\n{\n  "accounts": [\n    {\n      "account_name": "Bonds Payable",\n      "account_type": "Long-Term Liability",\n      "normal_balance": "Credit",\n      "account_description": "One sentence. Plain English. What does this account represent and when is it used in this chapter?",\n      "sort_order": 1\n    }\n  ]\n}\n\naccount_type must be one of exactly:\n  Current Asset | Long-Term Asset | Contra Asset | Current Liability | Long-Term Liability | Equity | Revenue | Expense | Contra Revenue\n\nnormal_balance must be: Debit | Credit | Both`,
      `List every account used in journal entries in: ${label}.\nInclude ALL accounts that appear in any journal entry in this chapter — assets, liabilities, equity, revenue, expense, and contra accounts.\nOrder by account_type following A = L + E hierarchy:\nCurrent Asset → Long-Term Asset → Contra Asset → Current Liability → Long-Term Liability → Equity → Revenue → Expense → Contra Revenue.\n\nReturn valid JSON only.`
    );

    logCost(sb, { operation_type: "chapter_accounts_generation", chapter_id: ch.id, model: "claude-sonnet-4-20250514", input_tokens: usage?.input_tokens, output_tokens: usage?.output_tokens, metadata: { chapter_name: ch.chapter_name } });

    const accounts = parsed.accounts || [];
    await sb.from("chapter_accounts").delete().eq("chapter_id", ch.id).eq("is_approved", false);
    if (accounts.length) {
      await sb.from("chapter_accounts").insert(accounts.map((a: any) => ({
        chapter_id: ch.id,
        account_name: a.account_name,
        account_type: a.account_type,
        normal_balance: a.normal_balance,
        account_description: a.account_description || "",
        sort_order: a.sort_order || 0,
        generated_at: now,
      })));
    }
    results.accounts = accounts.length;
  } catch (err: any) {
    console.error(`Accounts error for ${label}:`, err.message);
    results.accounts = "error";
  }

  // ━━━ CALL 6: chapter_formulas (reuse existing logic) ━━━━━━━━━━━━━━━━━
  try {
    // Fetch approved assets for formula context
    const { data: assets } = await sb
      .from("teaching_assets")
      .select("asset_name, source_ref, problem_title, problem_context, survive_solution_text, important_formulas, concept_notes, problem_type")
      .eq("chapter_id", ch.id)
      .not("asset_approved_at", "is", null);

    const assetSummaries = (assets || []).map((a: any, i: number) => {
      const parts = [`--- Asset ${i + 1}: ${a.source_ref || a.asset_name} (${a.problem_type || "unknown"}) ---`];
      if (a.problem_title) parts.push(`Title: ${a.problem_title}`);
      if (a.problem_context) parts.push(`Context: ${a.problem_context?.slice(0, 500)}`);
      if (a.survive_solution_text) parts.push(`Solution: ${a.survive_solution_text?.slice(0, 800)}`);
      if (a.important_formulas) parts.push(`Existing formulas: ${a.important_formulas?.slice(0, 400)}`);
      if (a.concept_notes) parts.push(`Concepts: ${a.concept_notes?.slice(0, 300)}`);
      return parts.join("\n");
    }).join("\n\n");

    const { parsed, usage } = await callAnthropic(
      anthropicKey,
      `You are an expert accounting professor curating the most important formulas a student must memorize for an exam.\n\nReturn ONLY valid JSON, no markdown, no backticks:\n{\n  "formulas": [\n    {\n      "formula_name": "Bond Carrying Value",\n      "formula_expression": "Face Value − Unamortized Discount (or + Unamortized Premium)",\n      "formula_explanation": "The net amount at which a bond is carried on the balance sheet.",\n      "sort_order": 1\n    }\n  ]\n}\n\nRules:\n- Return between 3 and 12 formulas depending on chapter complexity\n- formula_name: short descriptive name\n- formula_expression: the actual formula using standard notation\n- formula_explanation: 1-2 sentences explaining when/why a student uses this\n- sort_order: integer starting at 1, most important first\n- Only include formulas actually used in calculations, not just definitions\n- Do NOT include formulas from other chapters`,
      `Generate key formulas for: ${label}.\n\nInclude formulas students need for exams:\n- Balance sheet / income statement calculations\n- Journal entry calculation formulas (e.g. interest = Face × rate × time)\n- Any ratios or metrics introduced in this chapter\n\nDo NOT include formulas from other chapters.\n\n${assetSummaries ? `Context from ${(assets || []).length} approved assets:\n${assetSummaries}` : ""}\n\nReturn valid JSON only.`
    );

    logCost(sb, { operation_type: "chapter_formula_generation", chapter_id: ch.id, model: "claude-sonnet-4-20250514", input_tokens: usage?.input_tokens, output_tokens: usage?.output_tokens, metadata: { chapter_name: ch.chapter_name } });

    const formulas = parsed.formulas || [];
    await sb.from("chapter_formulas").delete().eq("chapter_id", ch.id).eq("is_approved", false);
    if (formulas.length) {
      await sb.from("chapter_formulas").insert(formulas.map((f: any) => ({
        chapter_id: ch.id,
        formula_name: f.formula_name,
        formula_expression: f.formula_expression,
        formula_explanation: f.formula_explanation || null,
        sort_order: f.sort_order,
        is_approved: false,
        is_rejected: false,
        generated_at: now,
      })));
    }
    results.formulas = formulas.length;
  } catch (err: any) {
    console.error(`Formulas error for ${label}:`, err.message);
    results.formulas = "error";
  }

  return results;
}
