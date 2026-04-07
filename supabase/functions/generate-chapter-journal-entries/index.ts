import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { all, chapterId, chapterName, courseCode, extraPrompt } = body;

    // Build list of chapters to process
    let chapters: { id: string; chapter_name: string; chapter_number: number; course_code: string }[] = [];

    if (all) {
      const { data: allChapters } = await supabase
        .from("chapters")
        .select("id, chapter_name, chapter_number, course_id")
        .order("chapter_number");
      const { data: courses } = await supabase.from("courses").select("id, code");
      const courseMap = Object.fromEntries((courses || []).map((c: any) => [c.id, c.code]));
      chapters = (allChapters || []).map((ch: any) => ({
        id: ch.id,
        chapter_name: ch.chapter_name,
        chapter_number: ch.chapter_number,
        course_code: courseMap[ch.course_id] || "Unknown",
      }));
    } else if (chapterId) {
      chapters = [{ id: chapterId, chapter_name: chapterName || "", chapter_number: 0, course_code: courseCode || "" }];
    } else {
      return new Response(JSON.stringify({ error: "Provide chapterId or all:true" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const errors: string[] = [];
    let completed = 0;

    for (const ch of chapters) {
      try {
        // ── Step 1: Extract JE structures from real teaching assets ──
        const { data: assets } = await supabase
          .from("teaching_assets")
          .select("id, asset_name, journal_entry_completed_json")
          .eq("chapter_id", ch.id)
          .not("journal_entry_completed_json", "is", null);

        const uniqueStructures: { accounts: string[]; sides: string[]; assetName: string }[] = [];
        const seenKeys = new Set<string>();

        for (const asset of (assets || [])) {
          const jeJson = asset.journal_entry_completed_json;
          if (!jeJson) continue;

          const payload = typeof jeJson === "string" ? JSON.parse(jeJson) : jeJson;

          // Handle canonical format: { scenario_sections: [{ entries_by_date: [{ rows }] }] }
          const sections = payload?.scenario_sections || [];
          for (const section of sections) {
            for (const dateGroup of (section.entries_by_date || [])) {
              const rows = dateGroup.rows || [];
              if (rows.length === 0) continue;

              const accounts = rows.map((r: any) => r.account_name || r.account || "").filter(Boolean);
              const sides = rows.map((r: any) => {
                if (r.debit !== null && r.debit !== undefined && r.debit !== 0) return "debit";
                if (r.credit !== null && r.credit !== undefined && r.credit !== 0) return "credit";
                return r.side || "debit";
              });

              // Deduplicate by sorted account set + sides
              const key = accounts.map((a: string, i: number) => `${a}:${sides[i]}`).sort().join("|");
              if (seenKeys.has(key)) continue;
              seenKeys.add(key);

              uniqueStructures.push({ accounts, sides, assetName: asset.asset_name });
            }
          }

          // Handle legacy flat format: array of { account, side, debit, credit }
          if (!sections.length && Array.isArray(payload)) {
            const accounts = payload.map((r: any) => r.account_name || r.account || "").filter(Boolean);
            const sides = payload.map((r: any) => {
              if (r.debit) return "debit";
              if (r.credit) return "credit";
              return r.side || "debit";
            });
            if (accounts.length > 0) {
              const key = accounts.map((a: string, i: number) => `${a}:${sides[i]}`).sort().join("|");
              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                uniqueStructures.push({ accounts, sides, assetName: asset.asset_name });
              }
            }
          }
        }

        // ── Step 2: Send to Claude for enrichment ──
        const systemPrompt = `You are an accounting expert enriching a list of journal entry structures extracted from real textbook problems.

Return ONLY valid JSON, no markdown, no backticks:
{
  "categories": [
    {
      "category_name": "Bond Issuance",
      "sort_order": 1,
      "entries": [
        {
          "transaction_label": "Bond issuance at face value",
          "sort_order": 1,
          "source": "extracted",
          "je_lines": [
            {
              "account": "Cash",
              "account_tooltip": "Asset — increases with debit because you're receiving cash",
              "side": "debit",
              "amount": "???"
            },
            {
              "account": "Bonds Payable",
              "account_tooltip": "Long-term liability — increases with credit because you owe bondholders",
              "side": "credit",
              "amount": "???"
            }
          ]
        }
      ]
    }
  ]
}

Rules:
1. Group the extracted entries into 2-5 logical categories
2. Write a short transaction_label for each (4-7 words, plain English)
3. Write an account_tooltip for each account line (one sentence: what the account is and why it increases/decreases here)
4. Use EXACTLY the account names from the extracted data — do NOT rename or reword any account names
5. Use ??? for all amounts — never use numbers
6. For entries from the extracted data, set source: "extracted"
7. If there are clearly missing entries for a complete chapter treatment, add them with source: "suggested"
8. Keep suggested entries minimal — only add what's truly missing
9. Do NOT include entries from other chapters
10. GAIN/LOSS RULE: When a transaction type can result in either a gain or a loss depending on circumstances, you MUST generate SEPARATE entries for each outcome. For example, instead of one "Bond redemption" entry, generate "Discount bond redemption at a loss", "Discount bond redemption at a gain", "Premium bond redemption at a loss", and "Premium bond redemption at a gain". This applies to all disposals, retirements, redemptions, sales, and impairments where the outcome depends on carrying value vs. proceeds.`;

        let userPrompt: string;

        if (uniqueStructures.length > 0) {
          userPrompt = `Chapter: ${ch.chapter_name} (${ch.course_code})

Extracted journal entries from ${uniqueStructures.length} real problems in this chapter:

${JSON.stringify(uniqueStructures, null, 2)}

Enrich these with categories, labels, and tooltips. Suggest any clearly missing transaction types.`;
        } else {
          // No assets with JE data — fall back to generation
          userPrompt = `Chapter: ${ch.chapter_name} (${ch.course_code})

No journal entry data was found in existing assets for this chapter. Generate a complete master list of journal entries for this chapter. Mark all entries as source: "suggested".

Include every major transaction type a student needs to know for exams. Group into logical categories (2-5 categories, 2-6 entries each).`;
        }

        if (extraPrompt) {
          // Fetch existing entries so AI only generates NEW ones
          const { data: existingEntries } = await supabase.from("chapter_journal_entries").select("transaction_label, category_id").eq("chapter_id", ch.id);
          const { data: existingCatsForCtx } = await supabase.from("chapter_je_categories").select("id, category_name").eq("chapter_id", ch.id);
          const catMap = Object.fromEntries((existingCatsForCtx || []).map((c: any) => [c.id, c.category_name]));
          const existingList = (existingEntries || []).map((e: any) => `• [${catMap[e.category_id] || "Uncategorized"}] ${e.transaction_label}`).join("\n");

          userPrompt += `\n\nIMPORTANT — These journal entries already exist (do NOT regenerate them):\n${existingList}\n\nAdditional instructions from admin: ${extraPrompt}\n\nGenerate ONLY the new entries requested above. Do not include any entries from the existing list. All new entries should be marked source: "suggested".`;
        }

        userPrompt += "\n\nReturn valid JSON only.";

        const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4096,
            messages: [{ role: "user", content: userPrompt }],
            system: systemPrompt,
          }),
        });

        if (!aiRes.ok) {
          const errText = await aiRes.text();
          throw new Error(`Anthropic ${aiRes.status}: ${errText}`);
        }

        const aiData = await aiRes.json();
        const rawText = aiData.content?.[0]?.text || "";
        console.log(`[JE] ${ch.chapter_name}: AI response length=${rawText.length}`);

        // Parse JSON
        let parsed: any;
        try {
          parsed = JSON.parse(rawText);
        } catch {
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
          else throw new Error("Could not parse AI response as JSON");
        }

        const categories = parsed.categories || [];
        console.log(`[JE] ${ch.chapter_name}: ${categories.length} categories, ${categories.reduce((s: number, c: any) => s + (c.entries?.length || 0), 0)} entries`);

        // ── Clean up old non-approved data ──
        if (!extraPrompt) {
          // Delete non-approved entries
          await supabase
            .from("chapter_journal_entries")
            .delete()
            .eq("chapter_id", ch.id)
            .eq("is_approved", false);

          // Delete empty categories
          const { data: existingCats } = await supabase
            .from("chapter_je_categories")
            .select("id")
            .eq("chapter_id", ch.id);
          const catIds = (existingCats || []).map((c: any) => c.id);

          if (catIds.length > 0) {
            const { data: remainingEntries } = await supabase
              .from("chapter_journal_entries")
              .select("category_id")
              .eq("chapter_id", ch.id);
            const usedCatIds = new Set((remainingEntries || []).map((e: any) => e.category_id));
            const emptyCats = catIds.filter((id: string) => !usedCatIds.has(id));
            if (emptyCats.length > 0) {
              await supabase.from("chapter_je_categories").delete().in("id", emptyCats);
            }
          }
        }

        // ── Step 3: Insert results ──
        for (const cat of categories) {
          let categoryId: string;

          if (extraPrompt) {
            const { data: existing } = await supabase
              .from("chapter_je_categories")
              .select("id")
              .eq("chapter_id", ch.id)
              .eq("category_name", cat.category_name)
              .maybeSingle();
            if (existing) {
              categoryId = existing.id;
            } else {
              const { data: newCat } = await supabase
                .from("chapter_je_categories")
                .insert({ chapter_id: ch.id, category_name: cat.category_name, sort_order: cat.sort_order || 0 })
                .select("id")
                .single();
              categoryId = newCat!.id;
            }
          } else {
            const { data: newCat } = await supabase
              .from("chapter_je_categories")
              .insert({ chapter_id: ch.id, category_name: cat.category_name, sort_order: cat.sort_order || 0 })
              .select("id")
              .single();
            categoryId = newCat!.id;
          }

          for (const entry of cat.entries || []) {
          if (extraPrompt) {
              // Case-insensitive dedup
              const { data: dup } = await supabase
                .from("chapter_journal_entries")
                .select("id")
                .eq("chapter_id", ch.id)
                .ilike("transaction_label", entry.transaction_label)
                .maybeSingle();
              if (dup) {
                console.log(`[JE] Skipped duplicate: "${entry.transaction_label}"`);
                continue;
              }
            }

            const entrySource = entry.source === "extracted" ? "extracted" : "suggested";

            await supabase
              .from("chapter_journal_entries")
              .insert({
                chapter_id: ch.id,
                category_id: categoryId,
                transaction_label: entry.transaction_label,
                je_lines: entry.je_lines,
                sort_order: entry.sort_order || 0,
                is_approved: false,
                source: entrySource,
                generated_at: new Date().toISOString(),
              });
          }
        }

        completed++;
      } catch (err: any) {
        errors.push(`${ch.chapter_name}: ${err.message}`);
      }
    }

    return new Response(
      JSON.stringify({ completed, total: chapters.length, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("generate-chapter-journal-entries error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
