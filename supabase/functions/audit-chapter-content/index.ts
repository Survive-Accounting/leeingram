import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { logCost } from "../_shared/cost.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert accounting education reviewer for Survive Accounting, an exam prep platform built for college accounting students. Your job is to audit chapter study content and identify specific, actionable improvements.

The platform brand: students learn to think like an accountant, not just memorize. Content should be tutor-voiced, cause-and-effect driven, written in 'you' perspective. Never textbook-generic.

You will receive all study content for one chapter.
Analyze it and return a JSON audit report only — no preamble, no explanation outside the JSON.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    const { chapter_id } = await req.json();
    if (!chapter_id) throw new Error("chapter_id required");

    // Fetch all chapter data in parallel — include ALL items, not just approved
    const [
      chapterRes,
      purposeRes,
      keyTermsRes,
      memoryRes,
      formulasRes,
      assetsRes,
      mistakesRes,
    ] = await Promise.all([
      sb.from("chapters").select("chapter_number, chapter_name").eq("id", chapter_id).single(),
      sb.from("chapter_purpose").select("purpose_bullets, consequence_bullets, is_approved").eq("chapter_id", chapter_id).single(),
      sb.from("chapter_key_terms").select("term, definition, is_approved, is_rejected").eq("chapter_id", chapter_id).order("sort_order"),
      sb.from("chapter_memory_items").select("title, item_type, subtitle, items, is_approved, is_rejected").eq("chapter_id", chapter_id).order("sort_order"),
      sb.from("chapter_formulas").select("formula_name, formula_expression, formula_explanation, is_approved, is_rejected").eq("chapter_id", chapter_id).order("sort_order"),
      sb.from("teaching_assets")
        .select("source_ref, journal_entry_completed_json")
        .eq("chapter_id", chapter_id)
        .not("asset_approved_at", "is", null)
        .not("journal_entry_completed_json", "is", null)
        .order("asset_name")
        .limit(20),
      sb.from("chapter_exam_mistakes").select("mistake, explanation, is_approved, is_rejected").eq("chapter_id", chapter_id).order("sort_order"),
    ]);

    if (chapterRes.error || !chapterRes.data) throw new Error("Chapter not found");
    const chapter = chapterRes.data;

    // Assemble content block
    const parts: string[] = [];
    parts.push(`CHAPTER: Ch ${chapter.chapter_number} — ${chapter.chapter_name}`);

    // Helper to summarize approval status
    const statusSummary = (items: any[]) => {
      const approved = items.filter(i => i.is_approved).length;
      const hidden = items.filter(i => i.is_rejected).length;
      const pending = items.length - approved - hidden;
      return `Total: ${items.length} | Approved: ${approved} | Hidden: ${hidden} | Pending: ${pending}`;
    };

    // Purpose
    if (purposeRes.data) {
      const p = purposeRes.data as any;
      parts.push(`\n--- PURPOSE (${p.is_approved ? 'Approved' : 'Not yet approved'}) ---`);
      if (p.purpose_bullets) parts.push(`Purpose: ${JSON.stringify(p.purpose_bullets)}`);
      if (p.consequence_bullets) parts.push(`Consequences: ${JSON.stringify(p.consequence_bullets)}`);
    } else {
      parts.push(`\n--- PURPOSE ---\n(No purpose content found)`);
    }

    // Key Terms
    const allTerms = keyTermsRes.data || [];
    parts.push(`\n--- KEY TERMS — ${statusSummary(allTerms)} ---`);
    if (allTerms.length) {
      for (const t of allTerms) {
        const ti = t as any;
        const tag = ti.is_approved ? '✓' : ti.is_rejected ? '(hidden)' : '(pending)';
        parts.push(`• ${tag} ${ti.term}: ${ti.definition}`);
      }
    } else {
      parts.push(`(No key terms exist)`);
    }

    // Memory Items
    const allMemory = memoryRes.data || [];
    parts.push(`\n--- MEMORY ITEMS — ${statusSummary(allMemory)} ---`);
    if (allMemory.length) {
      for (const m of allMemory) {
        const mi = m as any;
        const tag = mi.is_approved ? '✓' : mi.is_rejected ? '(hidden)' : '(pending)';
        parts.push(`• ${tag} [${mi.item_type}] ${mi.title}${mi.subtitle ? ` — ${mi.subtitle}` : ""}`);
        if (mi.items) parts.push(`  Items: ${JSON.stringify(mi.items)}`);
      }
    } else {
      parts.push(`(No memory items exist)`);
    }

    // Formulas
    const allFormulas = formulasRes.data || [];
    parts.push(`\n--- FORMULAS — ${statusSummary(allFormulas)} ---`);
    if (allFormulas.length) {
      for (const f of allFormulas) {
        const fi = f as any;
        const tag = fi.is_approved ? '✓' : fi.is_rejected ? '(hidden)' : '(pending)';
        parts.push(`• ${tag} ${fi.formula_name}: ${fi.formula_expression}`);
        if (fi.formula_explanation) parts.push(`  Explanation: ${fi.formula_explanation}`);
      }
    } else {
      parts.push(`(No formulas exist)`);
    }

    // JE samples
    parts.push(`\n--- JOURNAL ENTRY SAMPLES (${assetsRes.data?.length || 0} assets) ---`);
    if (assetsRes.data?.length) {
      for (const a of assetsRes.data) {
        const asset = a as any;
        const jeData = asset.journal_entry_completed_json;
        if (!jeData?.scenario_sections) continue;
        parts.push(`\nAsset: ${asset.source_ref}`);
        for (const section of jeData.scenario_sections) {
          for (const entry of section.entries_by_date || []) {
            for (const row of entry.rows || []) {
              const side = row.credit ? "Cr" : "Dr";
              const amt = row.credit || row.debit || "?";
              parts.push(`  ${side} ${row.account_name} ${amt}${row.debit_credit_reason ? ` — ${row.debit_credit_reason}` : ""}`);
            }
          }
        }
      }
    } else {
      parts.push(`(No approved assets with JE data)`);
    }

    // Common Mistakes
    const allMistakes = mistakesRes.data || [];
    parts.push(`\n--- COMMON EXAM MISTAKES — ${statusSummary(allMistakes)} ---`);
    if (allMistakes.length) {
      for (const m of allMistakes) {
        const mi = m as any;
        const tag = mi.is_approved ? '✓' : mi.is_rejected ? '(hidden)' : '(pending)';
        parts.push(`• ${tag} ${mi.mistake}: ${mi.explanation || ""}`);
      }
    } else {
      parts.push(`(No exam mistakes exist)`);
    }

    const contentBlock = parts.join("\n");

    const userMessage = `Audit the following chapter content for educational value, crammability, and tutor voice quality.

IMPORTANT: Items marked with ✓ are approved, (pending) means they exist but haven't been reviewed yet, and (hidden) means they were hidden for now. When evaluating whether content EXISTS, count ALL items regardless of status. Only flag "missing" if there are truly ZERO items in a category. If items exist but are pending approval, note that they need review — don't say the section is missing.

Return ONLY valid JSON matching this schema exactly:

{
  "chapter": "Ch N — Chapter Name",
  "overall_score": 1-10,
  "overall_note": "2-3 sentence honest assessment",
  "findings": [
    {
      "category": "content_gap | tooltip_quality | cram_sequence | voice_off | missing_memory_item | formula_clarity | mistake_coverage",
      "severity": "high | medium | low",
      "title": "short finding title",
      "detail": "specific explanation of the issue — reference actual content by name",
      "lovable_prompt": "complete ready-to-paste Lovable prompt that fixes this specific issue. Must be self-contained and actionable. Start with the file or component to modify."
    }
  ],
  "quick_wins": [
    "one sentence each — smallest changes with biggest student impact, max 5"
  ],
  "do_not_change": [
    "things that are working well and should be left alone, max 3"
  ]
}

CONTENT TO AUDIT:

${contentBlock}`;

    const aiModel = "claude-opus-4-20250514";

    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        max_tokens: 4000,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      throw new Error(`Anthropic ${aiResp.status}: ${errText}`);
    }

    const aiData = await aiResp.json();
    const rawText = aiData.content?.[0]?.text || "";

    // Parse JSON from response
    let report: any;
    try {
      const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      report = JSON.parse(cleaned);
    } catch {
      throw new Error("Failed to parse Claude response as JSON");
    }

    // Calculate cost
    const inputTokens = aiData.usage?.input_tokens || 0;
    const outputTokens = aiData.usage?.output_tokens || 0;
    // Opus pricing: $15/1M input, $75/1M output
    const estimatedCost = (inputTokens / 1_000_000) * 15 + (outputTokens / 1_000_000) * 75;

    // Log cost
    await logCost(sb, {
      operation_type: "chapter_audit",
      chapter_id,
      model: aiModel,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      metadata: { chapter_number: chapter.chapter_number, chapter_name: chapter.chapter_name },
    });

    // Build content inventory for the UI
    const inventory = {
      purpose: purposeRes.data ? { exists: true, approved: !!(purposeRes.data as any).is_approved } : { exists: false, approved: false },
      key_terms: { total: allTerms.length, approved: allTerms.filter((t: any) => t.is_approved).length, hidden: allTerms.filter((t: any) => t.is_rejected).length },
      memory_items: { total: allMemory.length, approved: allMemory.filter((m: any) => m.is_approved).length, hidden: allMemory.filter((m: any) => m.is_rejected).length },
      formulas: { total: allFormulas.length, approved: allFormulas.filter((f: any) => f.is_approved).length, hidden: allFormulas.filter((f: any) => f.is_rejected).length },
      mistakes: { total: allMistakes.length, approved: allMistakes.filter((m: any) => m.is_approved).length, hidden: allMistakes.filter((m: any) => m.is_rejected).length },
      je_assets: assetsRes.data?.length || 0,
    };

    return new Response(JSON.stringify({
      report,
      inventory,
      cost_usd: estimatedCost,
      tokens: { input: inputTokens, output: outputTokens },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("audit-chapter-content error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
