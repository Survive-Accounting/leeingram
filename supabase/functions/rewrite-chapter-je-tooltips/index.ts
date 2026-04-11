import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { logCost } from "../_shared/cost.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Lee, an accounting tutor who talks directly to students using "you" voice. You're rewriting journal entry tooltips to be conversational and student-focused — NOT textbook language.

For each journal entry line, write an account_tooltip that follows this pattern:
"You [debit/credit] [Account] because you're [what's happening in plain English]. [Account type]s [increase/decrease] with a [debit/credit]."

Rules:
- Use "you" and "you're" — talk TO the student
- One sentence, max two if needed for clarity
- End with the debit/credit rule so students learn WHY
- Be specific to the transaction context, not generic
- NO textbook definitions — explain what's actually happening
- Keep it under 30 words when possible

Examples of GOOD tooltips:
- "You debit Cash because you're receiving money from the customer. Assets increase with a debit."
- "You credit Sales Revenue because you earned revenue by delivering the product. Revenue increases with a credit."
- "You debit Pension Expense because you're recognizing this period's pension cost. Expenses increase with a debit."
- "You credit Plan Assets because you're paying benefits out of the fund. Assets decrease with a credit."

Examples of BAD tooltips (don't write like this):
- "Asset — increases with debit because cash is received from customer" (too textbook)
- "OCI component that increases with debit to record actuarial gains/losses" (definition, not teaching)
- "Liability — increases with credit when expenses are owed" (generic, not specific)

Input: JSON array of entries, each with transaction_label and lines (account + side).
Output: Same structure with account_tooltip added/rewritten for each line.

Return ONLY valid JSON: { "entries": [ { "id": "...", "lines": [ { "account": "...", "side": "...", "account_tooltip": "..." } ] } ] }`;

function extractJsonFromResponse(response: string): unknown {
  let cleaned = response
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const jsonStart = cleaned.search(/[\{\[]/);
  const jsonEnd = cleaned.lastIndexOf(jsonStart !== -1 && cleaned[jsonStart] === '[' ? ']' : '}');

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("No JSON object found in response");
  }

  cleaned = cleaned.substring(jsonStart, jsonEnd + 1);

  try {
    return JSON.parse(cleaned);
  } catch (_e) {
    // Fix common LLM JSON issues: trailing commas, control chars
    cleaned = cleaned
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]")
      .replace(/[\x00-\x1F\x7F]/g, (ch) => ch === '\n' || ch === '\t' ? ch : "");

    return JSON.parse(cleaned);
  }
}

async function callAnthropicWithRetry(
  apiKey: string,
  body: any,
  maxRetries = 2
): Promise<any> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 2s, 4s
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      console.log(`Retry attempt ${attempt}/${maxRetries}`);
    }

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (aiRes.ok) {
      return await aiRes.json();
    }

    const errText = await aiRes.text();
    lastError = new Error(`Anthropic API error ${aiRes.status}: ${errText}`);

    // Only retry on 500/502/503/529 (server errors / overloaded)
    if (aiRes.status < 500 && aiRes.status !== 429) {
      throw lastError;
    }

    // On 429, wait longer
    if (aiRes.status === 429 && attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  throw lastError!;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { chapterId, chapterName, courseCode, dryRun } = await req.json();
    if (!chapterId) throw new Error("chapterId required");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all non-rejected JEs for this chapter
    const { data: entries, error: fetchErr } = await sb
      .from("chapter_journal_entries")
      .select("id, transaction_label, je_lines")
      .eq("chapter_id", chapterId)
      .or("is_rejected.is.null,is_rejected.eq.false")
      .order("sort_order");

    if (fetchErr) throw new Error(`DB fetch error: ${fetchErr.message}`);
    if (!entries?.length) {
      return new Response(JSON.stringify({ updated: 0, message: "No entries found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize je_lines to canonical format for the AI
    const normalizedEntries = entries.map((e: any) => {
      const rawLines = Array.isArray(e.je_lines) ? e.je_lines : [];
      const lines = rawLines.map((l: any) => {
        if (l.side === "debit" || l.side === "credit") {
          return { account: l.account, side: l.side, account_tooltip: l.account_tooltip || "" };
        }
        const isDebit = l.debit != null && l.debit !== 0;
        return { account: l.account, side: isDebit ? "debit" : "credit", account_tooltip: l.account_tooltip || "" };
      });
      return { id: e.id, transaction_label: e.transaction_label, lines };
    });

    // Build prompt
    const userContent = JSON.stringify(normalizedEntries, null, 2);
    const contextLabel = chapterName ? `Chapter: ${chapterName}${courseCode ? ` (${courseCode})` : ""}` : "";

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");

    const aiData = await callAnthropicWithRetry(ANTHROPIC_API_KEY, {
      model: "claude-sonnet-4-20250514",
      max_tokens: 16384,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `${contextLabel}\n\nRewrite all account_tooltips for these ${normalizedEntries.length} journal entries:\n\n${userContent}`,
        },
      ],
    });

    const rawText = aiData.content?.[0]?.text || "";

    // Extract JSON with robust parser
    let parsed: any;
    try {
      parsed = extractJsonFromResponse(rawText);
    } catch (parseErr) {
      console.error("JSON parse failed. Raw text length:", rawText.length, "Last 200 chars:", rawText.slice(-200));
      throw new Error(`Failed to parse AI response: ${parseErr.message}`);
    }

    const rewrittenEntries = parsed.entries;
    if (!Array.isArray(rewrittenEntries)) throw new Error("Invalid AI response structure — missing entries array");

    // Log cost
    const inputTokens = aiData.usage?.input_tokens || 0;
    const outputTokens = aiData.usage?.output_tokens || 0;
    await logCost(sb, {
      operation_type: "rewrite_chapter_je_tooltips",
      chapter_id: chapterId,
      model: "claude-sonnet-4-20250514",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    });

    if (dryRun) {
      return new Response(JSON.stringify({ dryRun: true, preview: rewrittenEntries.slice(0, 3) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update each entry in the DB
    let updated = 0;
    for (const rewritten of rewrittenEntries) {
      const original = entries.find((e: any) => e.id === rewritten.id);
      if (!original) continue;

      const originalLines = Array.isArray(original.je_lines) ? original.je_lines : [];
      const updatedLines = originalLines.map((origLine: any, idx: number) => {
        const rewrittenLine = rewritten.lines?.[idx];
        if (!rewrittenLine) return origLine;

        if (origLine.side === "debit" || origLine.side === "credit") {
          return { ...origLine, account_tooltip: rewrittenLine.account_tooltip || origLine.account_tooltip };
        }
        const isDebit = origLine.debit != null && origLine.debit !== 0;
        return {
          account: origLine.account,
          account_tooltip: rewrittenLine.account_tooltip || "",
          side: isDebit ? "debit" : "credit",
          amount: origLine.amount || "???",
        };
      });

      const { error: updateErr } = await sb
        .from("chapter_journal_entries")
        .update({ je_lines: updatedLines })
        .eq("id", rewritten.id);

      if (!updateErr) updated++;
    }

    return new Response(
      JSON.stringify({ updated, total: entries.length, inputTokens, outputTokens }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("rewrite-chapter-je-tooltips error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
