import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TAB_PROMPTS: Record<string, string> = {
  purpose: `You are fixing Purpose content for a chapter. Return JSON:
{
  "purpose_bullets": ["bullet 1", "bullet 2", "bullet 3"],
  "consequence_bullets": ["consequence 1", "consequence 2"]
}
Max 3 purpose bullets, max 2 consequence bullets.
Use "you" voice — second-person, concise, cause and effect.
Return ONLY valid JSON, no markdown fences.`,

  key_terms: `You are adding/fixing Key Terms for a chapter. Return JSON:
{
  "terms": [
    { "term": "Term Name", "definition": "Definition text", "category": "Category Name" }
  ]
}
Use "you" voice. Definitions should be exam-focused, not textbook-generic.
Return ONLY valid JSON, no markdown fences.`,

  accounts: `You are adding/fixing Accounts for a chapter. Return JSON:
{
  "accounts": [
    {
      "account_name": "Account Name",
      "account_type": "asset|liability|equity|revenue|expense|contra_asset|contra_liability|contra_equity|contra_revenue|contra_expense",
      "normal_balance": "debit|credit",
      "account_description": "Description in you-voice"
    }
  ]
}
Return ONLY valid JSON, no markdown fences.`,

  memory: `You are adding/fixing Memory Items for a chapter. Return JSON:
{
  "items": [
    {
      "title": "Item Title",
      "subtitle": "Brief exam-focused subtitle",
      "item_type": "list|criteria|rule|steps",
      "items": ["item 1", "item 2", "item 3"]
    }
  ]
}
Use "you" voice. Item labels max 6 words each.
Return ONLY valid JSON, no markdown fences.`,

  jes: `You are adding/fixing Journal Entries for a chapter. Return JSON:
{
  "entries": [
    {
      "transaction_label": "Transaction description",
      "category_name": "Category Name",
      "je_lines": [
        { "account": "Account Name", "debit": 1000, "credit": null },
        { "account": "Account Name", "debit": null, "credit": 1000 }
      ]
    }
  ]
}
Use realistic dollar amounts. Each entry must balance (total debits = total credits).
Return ONLY valid JSON, no markdown fences.`,

  formulas: `You are adding/fixing Formulas for a chapter. Return JSON:
{
  "formulas": [
    {
      "formula_name": "Formula Name",
      "formula_expression": "A = B + C",
      "formula_explanation": "Explanation in you-voice",
      "components": [
        { "symbol": "A", "label": "What A represents" },
        { "symbol": "B", "label": "What B represents" }
      ]
    }
  ]
}
Only include calculation-heavy formulas with mathematical expressions.
Do not include conceptual frameworks or memo items — those belong in Memory Items.
Use "you" voice for explanations.
Return ONLY valid JSON, no markdown fences.`,

  mistakes: `You are adding/fixing Common Exam Mistakes for a chapter. Return JSON:
{
  "mistakes": [
    {
      "mistake": "What students get wrong",
      "explanation": "Why it matters and correct approach"
    }
  ]
}
Use "you" voice. Be specific to this chapter — never generic.
Return ONLY valid JSON, no markdown fences.`,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const { chapter_id, chapter_name, course_code, tab, findings, admin_notes } = await req.json();

    if (!chapter_id || !tab || !findings) {
      throw new Error("chapter_id, tab, and findings required");
    }

    const tabPrompt = TAB_PROMPTS[tab];
    if (!tabPrompt) throw new Error(`Unknown tab: ${tab}`);

    const userPrompt = `Fix/add content for: ${chapter_name} (${course_code})
Tab: ${tab}

Issues to fix:
${findings}

Admin notes: ${admin_notes || "None"}

Generate the corrected/additional content now.`;

    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        temperature: 0,
        system: `You generate content for Survive Accounting, an accounting exam prep platform.\n\n${tabPrompt}`,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      throw new Error(`Anthropic ${aiResp.status}: ${errText}`);
    }

    const aiData = await aiResp.json();
    const rawText = aiData.content?.[0]?.text || "";
    const cleaned = rawText.replace(/^```[\w]*\n?/gm, "").replace(/```\n?$/gm, "").trim();
    const parsed = JSON.parse(cleaned);

    let insertedCount = 0;

    // ── Insert based on tab ──
    if (tab === "purpose") {
      const { error } = await sb.from("chapter_purpose").upsert({
        chapter_id,
        purpose_bullets: parsed.purpose_bullets || [],
        consequence_bullets: parsed.consequence_bullets || [],
        is_approved: false,
        generated_at: new Date().toISOString(),
      }, { onConflict: "chapter_id" });
      if (error) throw new Error(`DB error: ${error.message}`);
      insertedCount = 1;
    }

    if (tab === "key_terms" && parsed.terms?.length) {
      // Get max sort_order
      const { data: existing } = await sb.from("chapter_key_terms")
        .select("sort_order")
        .eq("chapter_id", chapter_id)
        .order("sort_order", { ascending: false })
        .limit(1);
      let nextSort = (existing?.[0]?.sort_order ?? -1) + 1;

      const rows = parsed.terms.map((t: any) => ({
        chapter_id,
        term: t.term,
        definition: t.definition,
        category: t.category || null,
        is_approved: false,
        sort_order: nextSort++,
        generated_at: new Date().toISOString(),
      }));
      const { error } = await sb.from("chapter_key_terms").insert(rows);
      if (error) throw new Error(`DB error: ${error.message}`);
      insertedCount = rows.length;
    }

    if (tab === "accounts" && parsed.accounts?.length) {
      const { data: existing } = await sb.from("chapter_accounts")
        .select("sort_order")
        .eq("chapter_id", chapter_id)
        .order("sort_order", { ascending: false })
        .limit(1);
      let nextSort = (existing?.[0]?.sort_order ?? -1) + 1;

      const rows = parsed.accounts.map((a: any) => ({
        chapter_id,
        account_name: a.account_name,
        account_type: a.account_type,
        normal_balance: a.normal_balance,
        account_description: a.account_description || "",
        is_approved: false,
        sort_order: nextSort++,
      }));
      const { error } = await sb.from("chapter_accounts").insert(rows);
      if (error) throw new Error(`DB error: ${error.message}`);
      insertedCount = rows.length;
    }

    if (tab === "memory" && parsed.items?.length) {
      const { data: existing } = await sb.from("chapter_memory_items")
        .select("sort_order")
        .eq("chapter_id", chapter_id)
        .order("sort_order", { ascending: false })
        .limit(1);
      let nextSort = (existing?.[0]?.sort_order ?? -1) + 1;

      const rows = parsed.items.map((m: any) => ({
        chapter_id,
        title: m.title,
        subtitle: m.subtitle || null,
        item_type: m.item_type || "list",
        items: m.items || [],
        is_approved: false,
        sort_order: nextSort++,
        generated_at: new Date().toISOString(),
      }));
      const { error } = await sb.from("chapter_memory_items").insert(rows);
      if (error) throw new Error(`DB error: ${error.message}`);
      insertedCount = rows.length;
    }

    if (tab === "jes" && parsed.entries?.length) {
      // Ensure categories exist
      const categoryNames = [...new Set(parsed.entries.map((e: any) => e.category_name).filter(Boolean))];
      const { data: existingCats } = await sb.from("chapter_je_categories")
        .select("id, category_name")
        .eq("chapter_id", chapter_id);
      const catMap = new Map((existingCats || []).map((c: any) => [c.category_name, c.id]));

      for (const catName of categoryNames) {
        if (!catMap.has(catName)) {
          const { data: newCat } = await sb.from("chapter_je_categories")
            .insert({ chapter_id, category_name: catName as string, sort_order: catMap.size })
            .select("id")
            .single();
          if (newCat) catMap.set(catName as string, newCat.id);
        }
      }

      const { data: existing } = await sb.from("chapter_journal_entries")
        .select("sort_order")
        .eq("chapter_id", chapter_id)
        .order("sort_order", { ascending: false })
        .limit(1);
      let nextSort = (existing?.[0]?.sort_order ?? -1) + 1;

      const rows = parsed.entries.map((e: any) => ({
        chapter_id,
        transaction_label: e.transaction_label,
        je_lines: e.je_lines || [],
        category_id: catMap.get(e.category_name) || null,
        source: "suggested",
        is_approved: false,
        sort_order: nextSort++,
        generated_at: new Date().toISOString(),
      }));
      const { error } = await sb.from("chapter_journal_entries").insert(rows);
      if (error) throw new Error(`DB error: ${error.message}`);
      insertedCount = rows.length;
    }

    if (tab === "mistakes" && parsed.mistakes?.length) {
      const { data: existing } = await sb.from("chapter_exam_mistakes")
        .select("sort_order")
        .eq("chapter_id", chapter_id)
        .order("sort_order", { ascending: false })
        .limit(1);
      let nextSort = (existing?.[0]?.sort_order ?? -1) + 1;

      const rows = parsed.mistakes.map((m: any) => ({
        chapter_id,
        mistake: m.mistake,
        explanation: m.explanation || "",
        is_approved: false,
        sort_order: nextSort++,
      }));
      const { error } = await sb.from("chapter_exam_mistakes").insert(rows);
      if (error) throw new Error(`DB error: ${error.message}`);
      insertedCount = rows.length;
    }

    return new Response(JSON.stringify({ success: true, inserted_count: insertedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("apply-content-fixes error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
