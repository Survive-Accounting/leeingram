const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const MODEL = "claude-sonnet-4-20250514";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function callAnthropic(system: string, user: string): Promise<any> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  return JSON.parse(cleaned);
}

async function generatePurpose(chapterId: string, chapterName: string, courseCode: string) {
  const json = await callAnthropic(
    `Return ONLY valid JSON: { "purpose_text": "2-3 sentence paragraph explaining what accountants are trying to accomplish in this chapter and why it matters in the real world.", "consequence_text": "1-2 sentences describing the biggest consequence for a business that gets this wrong or ignores it entirely. Be specific and concrete — what actually goes wrong?" }`,
    `Chapter: ${chapterName} (${courseCode})`
  );
  const existing = await supabase.from("chapter_purpose").select("id").eq("chapter_id", chapterId).maybeSingle();
  if (existing.data) {
    await supabase.from("chapter_purpose").update({ purpose_text: json.purpose_text, consequence_text: json.consequence_text, generated_at: new Date().toISOString(), is_approved: false }).eq("id", existing.data.id);
  } else {
    await supabase.from("chapter_purpose").insert({ chapter_id: chapterId, purpose_text: json.purpose_text, consequence_text: json.consequence_text, generated_at: new Date().toISOString() });
  }
  return "ok";
}

async function generateCollection(chapterId: string, chapterName: string, courseCode: string, table: string, systemPrompt: string, userPrompt: string, arrayKey: string, extraPrompt?: string) {
  const finalUser = extraPrompt ? `${userPrompt}\n\nAdditional instructions: ${extraPrompt}` : userPrompt;
  const json = await callAnthropic(systemPrompt, finalUser);
  const items = json[arrayKey] || [];

  if (!extraPrompt) {
    await supabase.from(table).delete().eq("chapter_id", chapterId).or("is_approved.eq.false,is_approved.is.null");
  }

  if (items.length > 0) {
    const rows = items.map((item: any, i: number) => ({
      chapter_id: chapterId,
      ...item,
      sort_order: item.sort_order ?? i + 1,
      generated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from(table).insert(rows);
    if (error) throw error;
  }
  return items.length;
}

async function generateKeyTerms(chapterId: string, chapterName: string, courseCode: string, extraPrompt?: string) {
  return generateCollection(chapterId, chapterName, courseCode, "chapter_key_terms",
    `Return ONLY valid JSON: { "terms": [{ "term": "Bond Premium", "definition": "Plain-English one sentence. No textbook language. Write like a tutor explaining to a confused student.", "sort_order": 1 }] }`,
    `Generate 6-10 key terms a student must know for exams in: ${chapterName} (${courseCode}). Only terms introduced or heavily used in this chapter.`,
    "terms", extraPrompt
  );
}

async function generateExamMistakes(chapterId: string, chapterName: string, courseCode: string, extraPrompt?: string) {
  return generateCollection(chapterId, chapterName, courseCode, "chapter_exam_mistakes",
    `Return ONLY valid JSON: { "mistakes": [{ "mistake": "Short label for the mistake (8 words max)", "explanation": "One sentence explaining why students make this mistake and what to do instead.", "sort_order": 1 }] }`,
    `Generate 4-6 common exam mistakes students make in: ${chapterName} (${courseCode}). Focus on mistakes that cost exam points. Be specific — not generic accounting advice.`,
    "mistakes", extraPrompt
  );
}

async function generateExamChecklist(chapterId: string, chapterName: string, courseCode: string, extraPrompt?: string) {
  return generateCollection(chapterId, chapterName, courseCode, "chapter_exam_checklist",
    `Return ONLY valid JSON: { "items": [{ "checklist_item": "Before your exam, make sure you can: [specific skill or task]", "sort_order": 1 }] }`,
    `Generate 5-8 exam prep checklist items for: ${chapterName} (${courseCode}). Each item starts with 'Before your exam, make sure you can:' followed by a specific, testable skill. Focus on what actually appears on exams.`,
    "items", extraPrompt
  );
}

async function generateAccounts(chapterId: string, chapterName: string, courseCode: string, extraPrompt?: string) {
  return generateCollection(chapterId, chapterName, courseCode, "chapter_accounts",
    `Return ONLY valid JSON: { "accounts": [{ "account_name": "Bonds Payable", "account_type": "Long-Term Liability", "normal_balance": "Credit", "account_description": "One sentence. Plain English. What does this account represent and when is it used in this chapter?", "sort_order": 1 }] }
account_type must be one of exactly: Current Asset | Long-Term Asset | Contra Asset | Current Liability | Long-Term Liability | Equity | Revenue | Expense | Contra Revenue
normal_balance must be: Debit | Credit | Both`,
    `List every account used in journal entries in: ${chapterName} (${courseCode}). Include ALL accounts that appear in any journal entry in this chapter. Order by account_type following A = L + E hierarchy: Current Asset → Long-Term Asset → Contra Asset → Current Liability → Long-Term Liability → Equity → Revenue → Expense → Contra Revenue.`,
    "accounts", extraPrompt
  );
}

async function generateFormulas(chapterId: string, chapterName: string, courseCode: string, extraPrompt?: string) {
  return generateCollection(chapterId, chapterName, courseCode, "chapter_formulas",
    `Return ONLY valid JSON: { "formulas": [{ "formula_name": "Present Value of Annuity", "formula_expression": "PV = PMT × [(1 - (1+r)^-n) / r]", "formula_explanation": "One sentence plain-English explanation of when students use this formula.", "sort_order": 1 }] }`,
    `Generate 3-12 key formulas students must memorize for exams in: ${chapterName} (${courseCode}). Focus on calculation-heavy formulas, not conceptual rules. Only formulas introduced or heavily used in this chapter.`,
    "formulas", extraPrompt
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { chapterId, chapterName, courseCode, all, only, extraPrompt } = body;

    let chapters: { id: string; chapter_name: string; courseCode: string }[] = [];

    if (all) {
      const { data: allCh } = await supabase
        .from("chapters")
        .select("id, chapter_name, course_id, courses!chapters_course_id_fkey(code)")
        .order("chapter_number");
      chapters = (allCh || []).map((ch: any) => ({
        id: ch.id,
        chapter_name: ch.chapter_name,
        courseCode: ch.courses?.code || "UNK",
      }));
    } else if (chapterId) {
      let cName = chapterName;
      let cCode = courseCode;
      if (!cName || !cCode) {
        const { data: ch } = await supabase.from("chapters").select("chapter_name, courses!chapters_course_id_fkey(code)").eq("id", chapterId).single();
        cName = ch?.chapter_name || "Unknown";
        cCode = (ch as any)?.courses?.code || "UNK";
      }
      chapters = [{ id: chapterId, chapter_name: cName, courseCode: cCode }];
    } else {
      return new Response(JSON.stringify({ error: "Provide chapterId or all:true" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const allResults: any[] = [];
    const errors: string[] = [];

    for (const ch of chapters) {
      const result: any = { chapterId: ch.id, chapterName: ch.chapter_name, results: {} };

      const generators: [string, () => Promise<any>][] = only
        ? [[only, async () => {
            if (only === "purpose") return generatePurpose(ch.id, ch.chapter_name, ch.courseCode);
            if (only === "key_terms") return generateKeyTerms(ch.id, ch.chapter_name, ch.courseCode, extraPrompt);
            if (only === "exam_mistakes") return generateExamMistakes(ch.id, ch.chapter_name, ch.courseCode, extraPrompt);
            if (only === "exam_checklist") return generateExamChecklist(ch.id, ch.chapter_name, ch.courseCode, extraPrompt);
            if (only === "accounts") return generateAccounts(ch.id, ch.chapter_name, ch.courseCode, extraPrompt);
            if (only === "formulas") return generateFormulas(ch.id, ch.chapter_name, ch.courseCode, extraPrompt);
            throw new Error(`Unknown only: ${only}`);
          }]]
        : [
            ["purpose", () => generatePurpose(ch.id, ch.chapter_name, ch.courseCode)],
            ["key_terms", () => generateKeyTerms(ch.id, ch.chapter_name, ch.courseCode)],
            ["exam_mistakes", () => generateExamMistakes(ch.id, ch.chapter_name, ch.courseCode)],
            ["exam_checklist", () => generateExamChecklist(ch.id, ch.chapter_name, ch.courseCode)],
            ["accounts", () => generateAccounts(ch.id, ch.chapter_name, ch.courseCode)],
            ["formulas", () => generateFormulas(ch.id, ch.chapter_name, ch.courseCode)],
          ];

      for (const [key, fn] of generators) {
        try {
          result.results[key] = await fn();
        } catch (err: any) {
          result.results[key] = "error";
          errors.push(`${ch.chapter_name} / ${key}: ${err.message}`);
        }
      }
      allResults.push(result);
    }

    const response = chapters.length === 1
      ? { ...allResults[0], errors }
      : { completed: allResults.length, total: chapters.length, results: allResults, errors };

    return new Response(JSON.stringify(response), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
