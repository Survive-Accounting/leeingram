import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { logCost } from "../_shared/cost.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are auditing content for an accounting study platform called Survive Accounting. Content is for college accounting students preparing for exams.

Voice standard: second-person "you" tutor voice, concise, cause and effect, never textbook-generic.

Items may be tagged [approved] or [pending]. Audit ALL items regardless of status — pending items are real content awaiting review, not placeholders. Hidden items have already been excluded.

Return ONLY valid JSON. No preamble, no markdown fences.
Return empty findings array if content is genuinely strong.
Be specific to this chapter — never generic accounting advice.`;

type TabKey = "purpose" | "key_terms" | "accounts" | "memory" | "jes" | "mistakes";

const RETURN_SCHEMA = `Return:
{
  "findings": [
    {
      "severity": "high|medium|low",
      "title": "Max 8 words",
      "description": "2-3 sentences specific to this chapter"
    }
  ],
  "overall": "One sentence summary"
}`;

async function fetchTabData(sb: any, chapterId: string, tab: TabKey) {
  switch (tab) {
    case "purpose": {
      const { data } = await sb.from("chapter_purpose").select("purpose_bullets, consequence_bullets, is_approved").eq("chapter_id", chapterId).single();
      return data;
    }
    case "key_terms": {
      const { data } = await sb.from("chapter_key_terms").select("term, definition, category, is_approved, is_rejected").eq("chapter_id", chapterId).order("sort_order");
      return (data || []).filter((r: any) => !r.is_rejected);
    }
    case "accounts": {
      const { data } = await sb.from("chapter_accounts").select("account_name, account_type, normal_balance, account_description, is_approved, is_rejected").eq("chapter_id", chapterId).order("account_type").order("sort_order");
      return (data || []).filter((r: any) => !r.is_rejected);
    }
    case "memory": {
      const { data } = await sb.from("chapter_memory_items").select("title, item_type, subtitle, items, is_approved, is_rejected").eq("chapter_id", chapterId).order("sort_order");
      return (data || []).filter((r: any) => !r.is_rejected);
    }
    case "jes": {
      const [catRes, jeRes] = await Promise.all([
        sb.from("chapter_je_categories").select("id, category_name, sort_order").eq("chapter_id", chapterId).order("sort_order"),
        sb.from("chapter_journal_entries").select("transaction_label, je_lines, category_id, is_approved, is_rejected").eq("chapter_id", chapterId).order("sort_order"),
      ]);
      return { categories: catRes.data || [], entries: (jeRes.data || []).filter((r: any) => !r.is_rejected) };
    }
    case "mistakes": {
      const { data } = await sb.from("chapter_exam_mistakes").select("mistake, explanation, is_approved, is_rejected").eq("chapter_id", chapterId).order("sort_order");
      return (data || []).filter((r: any) => !r.is_rejected);
    }
  }
}

function buildPrompt(tab: TabKey, chapterName: string, courseCode: string, data: any): string {
  const header = `Audit the ${tab === "jes" ? "Journal Entries" : tab === "key_terms" ? "Key Terms" : tab.charAt(0).toUpperCase() + tab.slice(1)} content for: ${chapterName} (${courseCode})`;

  switch (tab) {
    case "purpose": {
      if (!data) return `${header}\n\nNo content generated yet for this tab.\n\nNote this is empty — return a single high-severity finding about missing purpose content.\n\n${RETURN_SCHEMA}`;
      return `${header}

Current content:
Purpose bullets: ${JSON.stringify(data.purpose_bullets || [])}
Consequence bullets: ${JSON.stringify(data.consequence_bullets || [])}

Evaluate:
1. Does it capture WHY this chapter matters — not just what it covers?
2. Is it written in "you" voice, tutor tone?
3. Are consequences specific and exam-relevant?
4. Does it frame the chapter as a skill to master?
5. Missing anything students need before diving in?

${RETURN_SCHEMA}`;
    }

    case "key_terms": {
      if (!data?.length) return `${header}\n\nNo content generated yet for this tab.\n\nNote this is empty — return a single high-severity finding about missing key terms.\n\n${RETURN_SCHEMA}`;
      const lines = data.map((t: any) => {
        const status = t.is_approved ? "[approved]" : "[pending]";
        return `${status} ${t.category ? `[${t.category}] ` : ""}${t.term}: ${t.definition}`;
      }).join("\n");
      return `${header}

Current terms (grouped by category):
${lines}

Evaluate:
1. Are all critical exam terms present?
2. Are definitions in "you" voice — not textbook?
3. Are categories logical?
4. Any terms too generic or from wrong chapter?
5. Missing terms students will definitely see on exams?

${RETURN_SCHEMA}`;
    }

    case "accounts": {
      if (!data?.length) return `${header}\n\nNo content generated yet for this tab.\n\nNote this is empty — return a single high-severity finding about missing accounts.\n\n${RETURN_SCHEMA}`;
      const lines = data.map((a: any) => `${a.account_name} | ${a.account_type} | ${a.normal_balance} | ${a.account_description || ""}`).join("\n");
      return `${header}

Current accounts:
${lines}

Evaluate:
1. Are all chapter JE accounts represented?
2. Are contra accounts correctly identified?
3. Are descriptions in "you" voice?
4. Any accounts that don't belong here?
5. Missing accounts students will encounter?

${RETURN_SCHEMA}`;
    }

    case "memory": {
      if (!data?.length) return `${header}\n\nNo content generated yet for this tab.\n\nNote this is empty — return a single high-severity finding about missing memory items.\n\n${RETURN_SCHEMA}`;
      const lines = data.map((m: any) => {
        const itemLabels = Array.isArray(m.items) ? m.items.map((i: any) => typeof i === "string" ? i : i.label || i.text || JSON.stringify(i)).join(", ") : "";
        return `${m.title} | ${m.item_type} | ${m.subtitle || ""} | ${itemLabels}`;
      }).join("\n");
      return `${header}

Current memory items:
${lines}

Evaluate:
1. Are the most exam-critical memorizable items present?
2. Are subtitles exam-specific and in "you" voice?
3. Are item labels concise (max 6 words)?
4. Any items overlapping with formulas?
5. Missing lists, criteria, or rules students need cold?

${RETURN_SCHEMA}`;
    }

    case "jes": {
      const { categories, entries } = data;
      if (!entries?.length) return `${header}\n\nNo content generated yet for this tab.\n\nNote this is empty — return a single high-severity finding about missing journal entries.\n\n${RETURN_SCHEMA}`;
      const catMap: Record<string, string> = {};
      for (const c of categories) catMap[c.id] = c.category_name;
      const lines: string[] = [];
      for (const e of entries) {
        const catName = e.category_id ? catMap[e.category_id] || "Uncategorized" : "Uncategorized";
        const accounts = Array.isArray(e.je_lines) ? e.je_lines.map((l: any) => `${l.side === "debit" ? "Dr" : "Cr"} ${l.account}`).join(", ") : "";
        lines.push(`${catName}: ${e.transaction_label} | ${accounts}`);
      }
      return `${header}

Current JE categories and entries:
${lines.join("\n")}

Evaluate:
1. Are all major transaction types covered?
2. Are gain/loss scenarios shown as separate entries?
3. Are category names logical and student-friendly?
4. Missing scenarios students will see on exams?
5. Any entries that seem incorrect or from wrong chapter?

${RETURN_SCHEMA}`;
    }

    case "mistakes": {
      if (!data?.length) return `${header}\n\nNo content generated yet for this tab.\n\nNote this is empty — return a single high-severity finding about missing exam mistakes.\n\n${RETURN_SCHEMA}`;
      const lines = data.map((m: any) => `${m.mistake}: ${m.explanation || ""}`).join("\n");
      return `${header}

Current mistakes:
${lines}

Evaluate:
1. Are these the most dangerous exam mistakes for this chapter?
2. Are explanations in "you" voice — specific not generic?
3. Do they cover traps students actually fall into?
4. Should any be replaced with more chapter-specific ones?
5. Are there additional critical mistakes not listed?

Note: do not hardcode a number of mistakes. Judge quality and completeness on merit.

${RETURN_SCHEMA}`;
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    const { chapter_id, tab, chapter_name, course_code } = await req.json();
    if (!chapter_id || !tab) throw new Error("chapter_id and tab required");

    const validTabs: TabKey[] = ["purpose", "key_terms", "accounts", "memory", "jes", "mistakes"];
    if (!validTabs.includes(tab)) throw new Error(`Invalid tab: ${tab}`);

    const data = await fetchTabData(sb, chapter_id, tab as TabKey);
    const userPrompt = buildPrompt(tab as TabKey, chapter_name || "Unknown", course_code || "???", data);

    const aiModel = "claude-sonnet-4-20250514";
    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        max_tokens: 1500,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      throw new Error(`Anthropic ${aiResp.status}: ${errText}`);
    }

    const aiData = await aiResp.json();
    const rawText = aiData.content?.[0]?.text || "";

    let result: any;
    try {
      const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      result = JSON.parse(cleaned);
    } catch {
      throw new Error("Failed to parse Claude response as JSON");
    }

    // Log cost — Sonnet pricing: $3/1M input, $15/1M output
    const inputTokens = aiData.usage?.input_tokens || 0;
    const outputTokens = aiData.usage?.output_tokens || 0;
    const estimatedCost = (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15;

    await logCost(sb, {
      operation_type: `chapter_audit_${tab}`,
      chapter_id,
      model: aiModel,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      metadata: { tab, chapter_name },
    });

    return new Response(JSON.stringify({
      tab,
      findings: result.findings || [],
      overall: result.overall || "",
      cost_usd: estimatedCost,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("audit-chapter-tab error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
