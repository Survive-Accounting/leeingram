import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    const { chapter_id } = await req.json();
    if (!chapter_id) throw new Error("Missing chapter_id");

    // ── 1. Fetch chapter info ──
    const { data: chapter, error: chErr } = await sb
      .from("chapters")
      .select("id, chapter_number, course_id, courses(code)")
      .eq("id", chapter_id)
      .single();
    if (chErr || !chapter) throw new Error("Chapter not found: " + (chErr?.message ?? ""));

    const courseCode = (chapter as any).courses?.code ?? "";
    const chapterNumber = chapter.chapter_number;

    // ── 2. Fetch approved teaching assets for this chapter ──
    const { data: assets, error: aErr } = await sb
      .from("teaching_assets")
      .select(
        "id, asset_name, source_ref, concept_notes, exam_traps, important_formulas, " +
        "journal_entry_block, survive_solution_text, problem_context, survive_problem_text"
      )
      .eq("chapter_id", chapter_id)
      .not("asset_approved_at", "is", null);

    if (aErr) throw new Error("Failed to fetch assets: " + aErr.message);
    if (!assets || assets.length === 0) throw new Error("No approved assets found for this chapter");

    const assetIds = assets.map((a: any) => a.id);

    // ── 3. Fetch banked questions for these assets ──
    const { data: questions } = await sb
      .from("banked_questions")
      .select("question_text, correct_answer, short_explanation, question_type, teaching_asset_id")
      .in("teaching_asset_id", assetIds)
      .eq("review_status", "approved");

    // ── 4. Build the AI prompt ──
    const assetSummaries = assets.map((a: any) => {
      const parts: string[] = [`Asset: ${a.asset_name || "Unnamed"} (ref: ${a.source_ref || "none"})`];
      if (a.concept_notes) parts.push(`Concepts: ${a.concept_notes}`);
      if (a.exam_traps) parts.push(`Exam Traps: ${a.exam_traps}`);
      if (a.important_formulas) parts.push(`Formulas: ${a.important_formulas}`);
      if (a.journal_entry_block) parts.push(`Journal Entry: ${a.journal_entry_block}`);
      if (a.survive_solution_text) parts.push(`Solution Summary: ${a.survive_solution_text.slice(0, 800)}`);
      if (a.problem_context) parts.push(`Context: ${a.problem_context}`);
      if (a.survive_problem_text) parts.push(`Problem: ${a.survive_problem_text.slice(0, 500)}`);
      return parts.join("\n");
    });

    const questionSummaries = (questions || []).map((q: any) =>
      `Q: ${q.question_text}\nA: ${q.correct_answer} — ${q.short_explanation}`
    );

    const systemPrompt = `You are a flashcard generator for an accounting study app.

Generate a balanced flashcard deck for Chapter ${chapterNumber} (${courseCode}).

Card type targets (approximate percentages of total cards):
- concept (30%): Front = concept name or question. Back = clear plain-English explanation.
- journal_entry (25%): Front = transaction description. Back = account names only, no amounts. Format: "Dr [Account] / Cr [Account], [Account]"
- account_classification (20%): Front = account name. Back = type (Asset/Liability/Equity/Revenue/Expense) + normal balance (Debit/Credit).
- formula (15%): Front = formula name. Back = the formula written out.
- analysis (10%): Front = "What happens to [X] when [Y]?" Back = explanation of the relationship.

Target 20-30 total cards.

CRITICAL RULES:
- Only use content from the teaching asset data provided below. Do NOT make up content.
- Each card must have a non-empty front and back.
- Include source_asset_name for traceability (the asset_name the card was derived from).
- Return ONLY a JSON array of objects with keys: card_type, front, back, source_asset_name

Teaching Asset Data:
${assetSummaries.join("\n\n---\n\n")}

${questionSummaries.length > 0 ? `\nBanked Questions (for reference):\n${questionSummaries.join("\n\n")}` : ""}`;

    // ── 5. Call generate-ai-output ──
    const aiPayload = {
      provider: "lovable",
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Generate the flashcard deck now. Return ONLY the JSON array." },
      ],
      temperature: 0.3,
      max_output_tokens: 4000,
    };

    const aiRes = await fetch(`${supabaseUrl}/functions/v1/generate-ai-output`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(aiPayload),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`AI generation failed: ${aiRes.status} ${errText}`);
    }

    const aiData = await aiRes.json();
    if (aiData.error) throw new Error("AI error: " + aiData.error);

    // Parse the cards from AI response
    let cards: any[] = [];
    const raw = aiData.parsed ?? aiData.raw;
    if (Array.isArray(raw)) {
      cards = raw;
    } else if (typeof raw === "string") {
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      cards = JSON.parse(cleaned);
    } else if (raw && typeof raw === "object" && Array.isArray(raw.cards)) {
      cards = raw.cards;
    } else if (raw && typeof raw === "object" && Array.isArray(raw.flashcards)) {
      cards = raw.flashcards;
    }

    if (!Array.isArray(cards) || cards.length === 0) {
      throw new Error("AI returned no valid cards");
    }

    // ── 6. Create flashcard_decks record ──
    const { data: deck, error: deckErr } = await sb
      .from("flashcard_decks")
      .insert({
        course_id: chapter.course_id,
        chapter_id: chapter_id,
        chapter_number: chapterNumber,
        course_code: courseCode,
        status: "draft",
        total_cards: cards.length,
      })
      .select("id")
      .single();

    if (deckErr || !deck) throw new Error("Failed to create deck: " + (deckErr?.message ?? ""));

    // ── 7. Build asset name → id lookup for source_asset_id ──
    const assetNameMap: Record<string, string> = {};
    for (const a of assets as any[]) {
      if (a.asset_name) assetNameMap[a.asset_name.toLowerCase()] = a.id;
    }

    // ── 8. Insert flashcards ──
    const validTypes = ["concept", "journal_entry", "account_classification", "formula", "analysis"];
    const cardRows = cards.map((c: any, i: number) => {
      const sourceAssetId = c.source_asset_name
        ? assetNameMap[c.source_asset_name.toLowerCase()] ?? null
        : null;
      return {
        deck_id: deck.id,
        card_type: validTypes.includes(c.card_type) ? c.card_type : "concept",
        front: String(c.front || "").slice(0, 2000),
        back: String(c.back || "").slice(0, 2000),
        source_asset_id: sourceAssetId,
        sort_order: i,
        deleted: false,
      };
    });

    const { error: insertErr } = await sb.from("flashcards").insert(cardRows);
    if (insertErr) throw new Error("Failed to insert cards: " + insertErr.message);

    // ── 9. Return success ──
    return new Response(
      JSON.stringify({
        success: true,
        deck_id: deck.id,
        cards_generated: cards.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-flashcard-deck error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
