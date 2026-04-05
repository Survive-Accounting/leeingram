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
      const { data: courses } = await supabase
        .from("courses")
        .select("id, code");
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
        const systemPrompt = `You are an accounting expert building a master reference list of journal entries for a college accounting chapter.

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
          "je_lines": [
            {
              "account": "Cash",
              "account_tooltip": "Asset — increases with debit",
              "side": "debit",
              "amount": "???"
            },
            {
              "account": "Bonds Payable",
              "account_tooltip": "Long-term liability — increases with credit",
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
- Use ??? for all amounts — never use numbers
- Keep transaction_label short (4–7 words)
- account_tooltip: one sentence explaining the account and why it increases/decreases here
- 2–5 categories max, 2–6 entries per category
- Cover every major transaction type for the chapter
- Do NOT include entries from other chapters`;

        let userPrompt = `Generate a complete master list of journal entries for: ${ch.chapter_name} (${ch.course_code}).

Include every major transaction type a student needs to know for exams in this chapter. Group into logical categories (e.g. Bond Issuance, Interest Payments, Bond Retirement).`;

        if (extraPrompt) {
          userPrompt += `\n\nAdditional instructions from admin: ${extraPrompt}. Incorporate these additions without removing existing approved entries.`;
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
            messages: [
              { role: "user", content: userPrompt },
            ],
            system: systemPrompt,
          }),
        });

        if (!aiRes.ok) {
          const errText = await aiRes.text();
          throw new Error(`Anthropic ${aiRes.status}: ${errText}`);
        }

        const aiData = await aiRes.json();
        const rawText = aiData.content?.[0]?.text || "";
        
        // Parse JSON - try to extract from potential markdown
        let parsed: any;
        try {
          parsed = JSON.parse(rawText);
        } catch {
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
          else throw new Error("Could not parse AI response as JSON");
        }

        const categories = parsed.categories || [];

        if (!extraPrompt) {
          // Delete existing non-approved entries for fresh generation
          // First get category IDs
          const { data: existingCats } = await supabase
            .from("chapter_je_categories")
            .select("id")
            .eq("chapter_id", ch.id);
          const catIds = (existingCats || []).map((c: any) => c.id);
          
          if (catIds.length > 0) {
            // Delete non-approved entries in these categories
            await supabase
              .from("chapter_journal_entries")
              .delete()
              .eq("chapter_id", ch.id)
              .eq("is_approved", false);
          }
          // Delete categories that have no remaining entries
          // Actually for clean generation, delete all categories and entries
          await supabase
            .from("chapter_journal_entries")
            .delete()
            .eq("chapter_id", ch.id)
            .eq("is_approved", false);
          // Delete empty categories
          const { data: remainingEntries } = await supabase
            .from("chapter_journal_entries")
            .select("category_id")
            .eq("chapter_id", ch.id);
          const usedCatIds = new Set((remainingEntries || []).map((e: any) => e.category_id));
          if (catIds.length > 0) {
            const emptyCats = catIds.filter((id: string) => !usedCatIds.has(id));
            if (emptyCats.length > 0) {
              await supabase
                .from("chapter_je_categories")
                .delete()
                .in("id", emptyCats);
            }
          }
        }

        // Insert new categories and entries
        for (const cat of categories) {
          // For extraPrompt: check if category exists
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
            // Deduplicate by transaction_label if extraPrompt
            if (extraPrompt) {
              const { data: dup } = await supabase
                .from("chapter_journal_entries")
                .select("id")
                .eq("chapter_id", ch.id)
                .eq("transaction_label", entry.transaction_label)
                .maybeSingle();
              if (dup) continue; // skip duplicate
            }

            await supabase
              .from("chapter_journal_entries")
              .insert({
                chapter_id: ch.id,
                category_id: categoryId,
                transaction_label: entry.transaction_label,
                je_lines: entry.je_lines,
                sort_order: entry.sort_order || 0,
                is_approved: false,
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
