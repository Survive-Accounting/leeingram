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

// ── Helper: extract unique JE structures from teaching assets ──
async function extractJEStructures(chapterId: string) {
  const { data: assets } = await supabase
    .from("teaching_assets")
    .select("id, asset_name, journal_entry_completed_json")
    .eq("chapter_id", chapterId)
    .not("journal_entry_completed_json", "is", null);

  const uniqueStructures: { accounts: string[]; sides: string[] }[] = [];
  const allAccountNames = new Set<string>();
  const seenKeys = new Set<string>();

  for (const asset of (assets || [])) {
    const jeJson = asset.journal_entry_completed_json;
    if (!jeJson) continue;
    const payload = typeof jeJson === "string" ? JSON.parse(jeJson) : jeJson;

    const extractFromRows = (rows: any[]) => {
      if (!rows || rows.length === 0) return;
      const accounts = rows.map((r: any) => r.account_name || r.account || "").filter(Boolean);
      const sides = rows.map((r: any) => {
        if (r.debit !== null && r.debit !== undefined && r.debit !== 0) return "debit";
        if (r.credit !== null && r.credit !== undefined && r.credit !== 0) return "credit";
        return r.side || "debit";
      });
      accounts.forEach((a: string) => allAccountNames.add(a));
      const key = accounts.map((a: string, i: number) => `${a}:${sides[i]}`).sort().join("|");
      if (seenKeys.has(key)) return;
      seenKeys.add(key);
      uniqueStructures.push({ accounts, sides });
    };

    const sections = payload?.scenario_sections || [];
    for (const section of sections) {
      for (const dateGroup of (section.entries_by_date || [])) {
        extractFromRows(dateGroup.rows || []);
      }
    }
    if (!sections.length && Array.isArray(payload)) {
      extractFromRows(payload);
    }
  }

  return { uniqueStructures, allAccountNames: Array.from(allAccountNames) };
}

// ── AI-only generators ──

async function generatePurpose(chapterId: string, chapterName: string, courseCode: string) {
  const json = await callAnthropic(
    `Return ONLY valid JSON: { "purpose_bullets": ["First bullet — leads logically to second", "Second bullet — builds on first", "Third bullet — conclusion or payoff"], "consequence_bullets": ["First consequence — most immediate", "Second consequence — downstream effect"] }

Rules:
- Max 3 purpose bullets, max 2 consequence bullets
- Each bullet: one concise sentence, no fluff
- Bullets should flow logically — each leads to next
- Write in second-person ("you") tutor voice. Address the student directly. Example: "You're learning how to record what actually happened in a transaction so the books stay accurate." NOT "This chapter covers recording transactions."
- Purpose bullets: explain what the student is learning to do and why it matters for their exam/career
- Consequence bullets: what goes wrong if YOU get this wrong — make it personal and specific`,
    `Chapter: ${chapterName} (${courseCode})`
  );
  const purposeBullets = json.purpose_bullets || [];
  const consequenceBullets = json.consequence_bullets || [];
  
  const existing = await supabase.from("chapter_purpose").select("id").eq("chapter_id", chapterId).maybeSingle();
  if (existing.data) {
    await supabase.from("chapter_purpose").update({ purpose_bullets: purposeBullets, consequence_bullets: consequenceBullets, generated_at: new Date().toISOString(), is_approved: false }).eq("id", existing.data.id);
  } else {
    await supabase.from("chapter_purpose").insert({ chapter_id: chapterId, purpose_bullets: purposeBullets, consequence_bullets: consequenceBullets, generated_at: new Date().toISOString() });
  }
  return "ok";
}

async function generateCollection(chapterId: string, chapterName: string, courseCode: string, table: string, systemPrompt: string, userPrompt: string, arrayKey: string, extraPrompt?: string, nameField: string = "term") {
  let finalUser = userPrompt;

  if (extraPrompt) {
    // Fetch existing items so AI knows what's already there
    const { data: existingRows } = await supabase.from(table).select("*").eq("chapter_id", chapterId);
    const existingNames = (existingRows || []).map((r: any) => r[nameField] || r.term || r.formula_name || r.mistake || "");

    finalUser += `\n\nIMPORTANT — These items already exist (do NOT regenerate them, only generate NEW ones):\n${existingNames.map((n: string) => `• ${n}`).join("\n")}\n\nAdditional instructions: ${extraPrompt}\n\nReturn ONLY the new items to add. Do not include any items from the existing list above.`;
  }

  const json = await callAnthropic(systemPrompt, finalUser);
  const items = json[arrayKey] || [];

  if (!extraPrompt) {
    await supabase.from(table).delete().eq("chapter_id", chapterId).or("is_approved.eq.false,is_approved.is.null");
  }

  // Dedup on extra prompt: skip items that match existing names (case-insensitive)
  let toInsert = items;
  let skipped = 0;
  if (extraPrompt && items.length > 0) {
    const { data: existingRows } = await supabase.from(table).select("*").eq("chapter_id", chapterId);
    const existingSet = new Set((existingRows || []).map((r: any) => (r[nameField] || r.term || r.formula_name || r.mistake || "").toLowerCase().trim()));
    toInsert = items.filter((item: any) => {
      const itemName = (item[nameField] || item.term || item.formula_name || item.mistake || "").toLowerCase().trim();
      if (existingSet.has(itemName)) { skipped++; return false; }
      return true;
    });
  }

  if (toInsert.length > 0) {
    const rows = toInsert.map((item: any, i: number) => ({
      chapter_id: chapterId,
      ...item,
      sort_order: item.sort_order ?? i + 1,
      generated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from(table).insert(rows);
    if (error) throw error;
  }

  console.log(`[${table}] extra=${!!extraPrompt} generated=${items.length} inserted=${toInsert.length} skipped=${skipped}`);
  return { added: toInsert.length, skipped, generated: items.length };
}

async function generateKeyTerms(chapterId: string, chapterName: string, courseCode: string, extraPrompt?: string) {
  return generateCollection(chapterId, chapterName, courseCode, "chapter_key_terms",
    `Return ONLY valid JSON: { "terms": [{ "term": "Bond Premium", "definition": "Plain-English one sentence in second-person tutor voice. Address the student as 'you'. Example: 'You're recording the extra amount above face value that investors paid because the stated rate was higher than the market rate.' NOT 'A bond premium is the excess of the issue price over face value.'", "sort_order": 1 }] }`,
    `Generate 6-10 key terms a student must know for exams in: ${chapterName} (${courseCode}). Only terms introduced or heavily used in this chapter. Write every definition in second-person "you" voice — the student is doing the work.`,
    "terms", extraPrompt, "term"
  );
}

async function generateExamMistakes(chapterId: string, chapterName: string, courseCode: string, extraPrompt?: string) {
  return generateCollection(chapterId, chapterName, courseCode, "chapter_exam_mistakes",
    `Return ONLY valid JSON: { "mistakes": [{ "mistake": "Short label for the mistake (8 words max)", "explanation": "One sentence in second-person 'you' voice explaining why YOU make this mistake and what to do instead.", "example_text": "A concise 2-3 sentence example in second-person 'you' voice that illustrates this mistake with a specific scenario a student would encounter. E.g. 'Say you buy supplies for $500 cash. You might record it as an expense right away, but you actually need to debit Supplies (asset) first. It only becomes an expense when you use them up.'", "sort_order": 1 }] }`,
    `Generate exactly 3 common exam mistakes for: ${chapterName} (${courseCode}).

Rank them:
#1 — Most dangerous: the mistake that costs the most points and trips up the most students
#2 — Most common: students make this constantly even when they think they understand the material
#3 — Most subtle: easy to overlook, hard to catch without really understanding the concept

Each mistake needs:
- "mistake": short label (8 words max)
- "explanation": one sentence in second-person "you" voice. Tell the student what THEY do wrong and what to do instead. Be specific to this chapter — not generic accounting advice.
- "example_text": a concise 2-3 sentence example in second-person "you" voice. Use a specific dollar amount or scenario the student would see on an exam. Make it concrete and easy to follow.

Return sort_order 1 for #1, 2 for #2, 3 for #3.`,
    "mistakes", extraPrompt, "mistake"
  );
}

async function generateFormulas(chapterId: string, chapterName: string, courseCode: string, extraPrompt?: string) {
  return generateCollection(chapterId, chapterName, courseCode, "chapter_formulas",
    `Return ONLY valid JSON: { "formulas": [{ "formula_name": "Present Value of Annuity", "formula_expression": "PV = PMT × [(1 - (1+r)^-n) / r]", "formula_explanation": "Write in second-person ('you') tutor voice — e.g. 'Use this when you need to...' or 'You're checking that...' Keep it to 1-2 sentences, specific and actionable, not textbook-generic.", "sort_order": 1 }] }`,
    `Generate 3-12 key formulas students must memorize for exams in: ${chapterName} (${courseCode}). Focus on calculation-heavy formulas, not conceptual rules. Only formulas introduced or heavily used in this chapter.`,
    "formulas", extraPrompt, "formula_name"
  );
}

// ── EXTRACTION-FIRST: Journal Entries ──
async function generateJournalEntries(chapterId: string, chapterName: string, courseCode: string, extraPrompt?: string) {
  const { uniqueStructures } = await extractJEStructures(chapterId);

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
          "suggested": false,
          "je_lines": [
            {
              "account": "Cash",
              "account_tooltip": "Asset — increases with debit because you're receiving cash",
              "side": "debit",
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
6. For entries from the extracted data, set suggested: false
7. If there are clearly missing entries for a complete chapter treatment, add them with suggested: true
8. Keep suggested entries minimal — only add what's truly missing
9. Do NOT include entries from other chapters`;

  let userPrompt: string;
  if (uniqueStructures.length > 0) {
    userPrompt = `Chapter: ${chapterName} (${courseCode})\n\nExtracted journal entries from ${uniqueStructures.length} approved problems in this chapter:\n\n${JSON.stringify(uniqueStructures, null, 2)}\n\nEnrich these entries and suggest any that are clearly missing for complete chapter coverage.`;
  } else {
    userPrompt = `Chapter: ${chapterName} (${courseCode})\n\nNo journal entry data was found in existing assets for this chapter. Generate a complete master list of journal entries for this chapter. Mark all entries as suggested: true.\n\nInclude every major transaction type a student needs to know for exams. Group into logical categories (2-5 categories, 2-6 entries each).`;
  }

  if (extraPrompt) {
    // Fetch existing entries so AI only generates NEW ones
    const { data: existingEntries } = await supabase.from("chapter_journal_entries").select("transaction_label, category_id").eq("chapter_id", chapterId);
    const { data: existingCats } = await supabase.from("chapter_je_categories").select("id, category_name").eq("chapter_id", chapterId);
    const catMap = Object.fromEntries((existingCats || []).map((c: any) => [c.id, c.category_name]));
    const existingList = (existingEntries || []).map((e: any) => `• [${catMap[e.category_id] || "Uncategorized"}] ${e.transaction_label}`).join("\n");

    userPrompt += `\n\nIMPORTANT — These journal entries already exist (do NOT regenerate them):\n${existingList}\n\nAdditional instructions from admin: ${extraPrompt}\n\nGenerate ONLY the new entries requested above. Do not include any entries from the existing list. All new entries should be marked suggested: true.`;
  }

  userPrompt += "\n\nReturn valid JSON only.";

  const parsed = await callAnthropic(systemPrompt, userPrompt);
  const categories = parsed.categories || [];

  if (!extraPrompt) {
    await supabase.from("chapter_journal_entries").delete().eq("chapter_id", chapterId).eq("is_approved", false);

    const { data: existingCats } = await supabase.from("chapter_je_categories").select("id").eq("chapter_id", chapterId);
    const catIds = (existingCats || []).map((c: any) => c.id);
    if (catIds.length > 0) {
      const { data: remainingEntries } = await supabase.from("chapter_journal_entries").select("category_id").eq("chapter_id", chapterId);
      const usedCatIds = new Set((remainingEntries || []).map((e: any) => e.category_id));
      const emptyCats = catIds.filter((id: string) => !usedCatIds.has(id));
      if (emptyCats.length > 0) {
        await supabase.from("chapter_je_categories").delete().in("id", emptyCats);
      }
    }
  }

  let totalEntries = 0;
  for (const cat of categories) {
    let categoryId: string;
    if (extraPrompt) {
      const { data: existing } = await supabase.from("chapter_je_categories").select("id").eq("chapter_id", chapterId).eq("category_name", cat.category_name).maybeSingle();
      if (existing) {
        categoryId = existing.id;
      } else {
        const { data: newCat } = await supabase.from("chapter_je_categories").insert({ chapter_id: chapterId, category_name: cat.category_name, sort_order: cat.sort_order || 0 }).select("id").single();
        categoryId = newCat!.id;
      }
    } else {
      const { data: newCat } = await supabase.from("chapter_je_categories").insert({ chapter_id: chapterId, category_name: cat.category_name, sort_order: cat.sort_order || 0 }).select("id").single();
      categoryId = newCat!.id;
    }

    let skipped = 0;
    for (const entry of cat.entries || []) {
      if (extraPrompt) {
        // Case-insensitive dedup on transaction_label
        const { data: dup } = await supabase.from("chapter_journal_entries").select("id").eq("chapter_id", chapterId).ilike("transaction_label", entry.transaction_label).maybeSingle();
        if (dup) { skipped++; continue; }
      }
      const entrySource = entry.suggested ? "suggested" : "extracted";
      await supabase.from("chapter_journal_entries").insert({
        chapter_id: chapterId,
        category_id: categoryId,
        transaction_label: entry.transaction_label,
        je_lines: entry.je_lines,
        sort_order: entry.sort_order || 0,
        is_approved: false,
        source: entrySource,
        generated_at: new Date().toISOString(),
      });
      totalEntries++;
    }
    if (skipped > 0) console.log(`[JE] Skipped ${skipped} duplicate entries in category "${cat.category_name}"`);
  }
  return totalEntries;
}

// ── EXTRACTION-FIRST: Accounts ──
async function generateAccounts(chapterId: string, chapterName: string, courseCode: string, extraPrompt?: string) {
  const { allAccountNames } = await extractJEStructures(chapterId);

  let systemPrompt: string;
  let userPrompt: string;

  if (allAccountNames.length > 0) {
    systemPrompt = `You are an accounting expert. You are given a list of account names extracted from real journal entries in a chapter's approved teaching assets.

Return ONLY valid JSON: { "accounts": [{ "account_name": "Bonds Payable", "account_type": "Long-Term Liability", "normal_balance": "Credit", "account_description": "One sentence. Plain English. What does this account represent and when is it used in this chapter?", "sort_order": 1 }] }

account_type must be one of exactly: Current Asset | Long-Term Asset | Contra Asset | Current Liability | Long-Term Liability | Equity | Revenue | Expense | Contra Revenue
normal_balance must be: Debit | Credit | Both

Rules:
1. Use EXACTLY the account names provided — do NOT rename, reword, or abbreviate
2. Classify each account with the correct account_type and normal_balance
3. Write a plain-English account_description for each
4. Order by A = L + E hierarchy: Current Asset → Long-Term Asset → Contra Asset → Current Liability → Long-Term Liability → Equity → Revenue → Expense → Contra Revenue
5. If any accounts are clearly missing for complete chapter coverage, add them with suggested: true
6. Extracted accounts should have suggested: false`;

    userPrompt = `Chapter: ${chapterName} (${courseCode})\n\nAccount names extracted from approved teaching assets in this chapter:\n\n${JSON.stringify(allAccountNames, null, 2)}\n\nClassify each account and suggest any that are clearly missing.`;
  } else {
    systemPrompt = `Return ONLY valid JSON: { "accounts": [{ "account_name": "Bonds Payable", "account_type": "Long-Term Liability", "normal_balance": "Credit", "account_description": "One sentence. Plain English. What does this account represent and when is it used in this chapter?", "sort_order": 1, "suggested": true }] }
account_type must be one of exactly: Current Asset | Long-Term Asset | Contra Asset | Current Liability | Long-Term Liability | Equity | Revenue | Expense | Contra Revenue
normal_balance must be: Debit | Credit | Both`;

    userPrompt = `No teaching asset data found. List every account used in journal entries in: ${chapterName} (${courseCode}). Include ALL accounts that appear in any journal entry in this chapter. Mark all as suggested: true. Order by account_type following A = L + E hierarchy.`;
  }

  if (extraPrompt) {
    userPrompt += `\n\nAdditional instructions: ${extraPrompt}`;
  }

  const json = await callAnthropic(systemPrompt, userPrompt);
  const items = json.accounts || [];

  if (!extraPrompt) {
    await supabase.from("chapter_accounts").delete().eq("chapter_id", chapterId).or("is_approved.eq.false,is_approved.is.null");
  }

  if (items.length > 0) {
    const rows = items.map((item: any, i: number) => ({
      chapter_id: chapterId,
      account_name: item.account_name,
      account_type: item.account_type,
      normal_balance: item.normal_balance,
      account_description: item.account_description,
      sort_order: item.sort_order ?? i + 1,
      generated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("chapter_accounts").insert(rows);
    if (error) throw error;
  }
  return items.length;
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
            if (only === "accounts") return generateAccounts(ch.id, ch.chapter_name, ch.courseCode, extraPrompt);
            if (only === "formulas") return generateFormulas(ch.id, ch.chapter_name, ch.courseCode, extraPrompt);
            if (only === "journal_entries") return generateJournalEntries(ch.id, ch.chapter_name, ch.courseCode, extraPrompt);
            throw new Error(`Unknown only: ${only}`);
          }]]
        : [
            ["purpose", () => generatePurpose(ch.id, ch.chapter_name, ch.courseCode)],
            ["key_terms", () => generateKeyTerms(ch.id, ch.chapter_name, ch.courseCode)],
            ["exam_mistakes", () => generateExamMistakes(ch.id, ch.chapter_name, ch.courseCode)],
            ["accounts", () => generateAccounts(ch.id, ch.chapter_name, ch.courseCode)],
            ["formulas", () => generateFormulas(ch.id, ch.chapter_name, ch.courseCode)],
            ["journal_entries", () => generateJournalEntries(ch.id, ch.chapter_name, ch.courseCode)],
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
