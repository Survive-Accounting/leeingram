import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const MODEL = "claude-sonnet-4-20250514";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const MEMORY_SYSTEM_PROMPT = `You are generating "Memory Items" for an accounting chapter.
These are structured lists, criteria, classifications, rules,
steps, mnemonics, and mappings that students must memorize
for exams. This applies to ALL accounting courses from
introductory through intermediate level.

ITEM TYPES — use whichever fits:
- list: ordered or unordered items to know cold
- criteria: numbered tests/conditions that must be met
- classification: categories to distinguish between
- rule: if X then Y decision rules
- mnemonic: memory device for ordered content
- steps: sequential process to follow
- mapping: what goes where (e.g. financial statement placement)

FOR EACH ITEM generate:
- title: short label, max 8 words
- item_type: from the list above
- subtitle: one sentence, "you" voice, why this matters on exams specifically. Never generic.
- items: array, each with:
  - label: concise, max 6 words
  - tooltip: 1-2 sentences "you" voice. Like a tutor whispering the key insight. Cause and effect. Never textbook-generic. Never start with "This is..." or "This account..."
  - order: integer starting at 1

TOOLTIP VOICE EXAMPLES — match this energy exactly:
GOOD: "You debit this every time — it always increases pension expense. No exceptions."
GOOD: "If all 5 criteria are met, you're looking at a finance lease. Miss even one and it's operating."
GOOD: "Rising costs mean FIFO gives you higher ending inventory and higher net income. LIFO does the opposite — and that's why companies use it for tax savings."
BAD: "Service cost represents the actuarial present value of benefits earned by employees during the period."
BAD: "This classification is used when..."

RULES:
- Only include real, testable accounting content
- Never invent rules or criteria that don't exist
- If a chapter has fewer memorizable items, generate fewer — quality over quantity
- Prioritize items most likely to appear on exams
- Do not include items already covered by formulas or key terms for this chapter
- Return ONLY a valid JSON array, no preamble, no markdown fences

Return format:
[
  {
    "title": "5 Components of Pension Expense",
    "item_type": "list",
    "subtitle": "Every pension problem tests at least one of these — know all five cold.",
    "items": [
      { "label": "Service Cost", "tooltip": "New benefit employees earned this year by working. You always debit this — it increases pension expense.", "order": 1 }
    ]
  }
]`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { chapterId } = await req.json();
    if (!chapterId) {
      return new Response(JSON.stringify({ error: "chapterId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get chapter info
    const { data: chapter } = await sb
      .from("chapters")
      .select("chapter_name, course_id, courses!chapters_course_id_fkey(code)")
      .eq("id", chapterId)
      .single();
    if (!chapter) throw new Error("Chapter not found");

    const chapterName = chapter.chapter_name;
    const courseCode = (chapter as any).courses?.code || "UNK";

    // Skip if already has approved items
    const { data: approved } = await sb
      .from("chapter_memory_items")
      .select("id")
      .eq("chapter_id", chapterId)
      .eq("is_approved", true)
      .limit(1);

    if ((approved || []).length > 0) {
      return new Response(JSON.stringify({
        success: true, chapterId, itemsGenerated: 0, skipped: true,
        reason: "Chapter already has approved memory items",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1.5s delay before API call
    await new Promise(r => setTimeout(r, 1500));

    const userPrompt = `Chapter: ${chapterName}\nCourse: ${courseCode}\n\nGenerate 3-8 memory items depending on chapter complexity.`;

    const startMs = Date.now();
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16384,
        system: MEMORY_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    const durationMs = Date.now() - startMs;

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`Anthropic API error ${aiRes.status}: ${errText}`);
    }

    const aiData = await aiRes.json();
    const text = aiData.content?.[0]?.text || "";
    const inputTokens = aiData.usage?.input_tokens || 0;
    const outputTokens = aiData.usage?.output_tokens || 0;

    // Parse JSON
    let cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    let parsed: any[];
    try { parsed = JSON.parse(cleaned); } catch {
      const match = cleaned.match(/(\[[\s\S]*\])/);
      if (match) parsed = JSON.parse(match[1]);
      else throw new Error("Could not parse AI response as JSON");
    }
    if (!Array.isArray(parsed)) parsed = parsed.memory_items || parsed.items || [];

    // Clear unapproved, insert fresh
    await sb.from("chapter_memory_items").delete().eq("chapter_id", chapterId).or("is_approved.eq.false,is_approved.is.null");

    if (parsed.length > 0) {
      const rows = parsed.map((item: any, i: number) => ({
        chapter_id: chapterId,
        title: item.title,
        item_type: item.item_type,
        subtitle: item.subtitle || null,
        items: item.items || [],
        sort_order: i + 1,
        is_approved: false,
        generated_at: new Date().toISOString(),
      }));
      const { error } = await sb.from("chapter_memory_items").insert(rows);
      if (error) throw error;
    }

    // Log to ai_cost_log
    const costPerInputToken = 3 / 1_000_000;
    const costPerOutputToken = 15 / 1_000_000;
    const estimatedCost = (inputTokens * costPerInputToken) + (outputTokens * costPerOutputToken);

    await sb.from("ai_cost_log").insert({
      operation_type: "generate_memory_items",
      chapter_id: chapterId,
      model: MODEL,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost_usd: estimatedCost,
      metadata: { chapterName, courseCode, itemCount: parsed.length, durationMs },
    });

    return new Response(JSON.stringify({
      success: true,
      chapterId,
      itemsGenerated: parsed.length,
      skipped: false,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("run-memory-items-batch error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "Unknown error",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
