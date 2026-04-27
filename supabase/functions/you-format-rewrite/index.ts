// Rewrite a single teaching asset into "you-format":
// - Replace "Survive Company A (the X)" with second-person "you" voice
// - Pick a fictitious business from curated library matching chapter's allowed domains
// - Preserve every numeric fact, date, account name, and instruction count
// - Validate: all original numbers still present; instruction count matches
//
// Writes to shadow columns: you_problem_text, you_instruction_1..5, you_business_name,
// you_format_status ('generated' on success, 'failed' on validation fail).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You rewrite accounting practice problems into second-person ("you") voice using a fictitious business name.

REWRITE RULES:
1. Replace every reference to "Survive Company A", "Survive Company A (the seller)", "Survive Company A (the buyer)", etc., with the assigned business name OR with "you / your business" — whichever reads more naturally.
2. Drop role parentheticals like "(the seller)", "(the buyer)", "(the lender)" UNLESS the problem involves 2+ different parties — then keep the role for clarity.
3. Use second person ("you", "your") wherever the original used the company as the actor: "Survive Company A purchased" → "You purchased" or "Your business, [Name], purchased".
4. Preserve EVERY:
   - Number, dollar amount, percentage, date
   - Account name (Cash, Inventory, Sales Revenue, etc.)
   - Quantity, unit, term length
   - Conjunction/sequence ("first", "then", "finally")
5. Do NOT change accounting facts. Do NOT add new transactions. Do NOT remove transactions.
6. Keep instruction count IDENTICAL. If there were 3 instructions, return exactly 3.
7. Keep instructions short and direct ("Prepare the journal entries", "Calculate gross profit").
8. Tone: confident, conversational, exam-tutor voice. No textbook hedging.

OUTPUT a JSON object ONLY — no prose, no markdown fences:
{
  "problem_text": "rewritten problem in you-voice using the assigned business name",
  "instructions": ["instruction 1", "instruction 2", ...]
}`;

type Asset = {
  id: string;
  asset_name: string;
  chapter_id: string;
  survive_problem_text: string | null;
  problem_text_backup: string | null;
  instruction_1: string | null;
  instruction_2: string | null;
  instruction_3: string | null;
  instruction_4: string | null;
  instruction_5: string | null;
};

function collectInstructions(a: Asset): string[] {
  return [a.instruction_1, a.instruction_2, a.instruction_3, a.instruction_4, a.instruction_5]
    .map((x) => (x ?? "").trim())
    .filter(Boolean);
}

// Extract every dollar amount, integer, percentage, and date-like token from a string.
function extractFacts(text: string): string[] {
  const facts = new Set<string>();
  // Dollar amounts: $1,200 / $1,200.50
  for (const m of text.matchAll(/\$[0-9,]+(?:\.[0-9]+)?/g)) facts.add(m[0].replace(/,/g, ""));
  // Percentages
  for (const m of text.matchAll(/[0-9]+(?:\.[0-9]+)?\s*%/g)) facts.add(m[0].replace(/\s+/g, ""));
  // Standalone numbers >= 100 (skip tiny noise like "1 year")
  for (const m of text.matchAll(/\b[0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]+)?\b|\b[0-9]{3,}(?:\.[0-9]+)?\b/g)) {
    facts.add(m[0].replace(/,/g, ""));
  }
  return Array.from(facts);
}

function pickBusiness(
  available: { name: string; domain: string }[],
  allowedDomains: string[],
  seedKey: string,
): { name: string; domain: string } | null {
  const pool = allowedDomains.length
    ? available.filter((b) => allowedDomains.includes(b.domain))
    : available;
  if (!pool.length) return null;
  // Deterministic pick by hash of asset id so re-runs give same business
  let hash = 0;
  for (let i = 0; i < seedKey.length; i++) hash = (hash * 31 + seedKey.charCodeAt(i)) | 0;
  const idx = Math.abs(hash) % pool.length;
  return pool[idx];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { asset_id, force } = await req.json();
    if (!asset_id) throw new Error("asset_id is required");

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: asset, error: assetErr } = await sb
      .from("teaching_assets")
      .select(
        "id, asset_name, chapter_id, survive_problem_text, problem_text_backup, instruction_1, instruction_2, instruction_3, instruction_4, instruction_5, you_format_status",
      )
      .eq("id", asset_id)
      .single();

    if (assetErr || !asset) throw new Error(`Asset not found: ${assetErr?.message}`);

    if (!force && (asset.you_format_status === "generated" || asset.you_format_status === "approved")) {
      return new Response(
        JSON.stringify({ skipped: true, reason: `already ${asset.you_format_status}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const problemSource =
      asset.survive_problem_text?.trim() || asset.problem_text_backup?.trim() || "";
    const instructions = collectInstructions(asset as Asset);

    if (!problemSource) {
      await sb
        .from("teaching_assets")
        .update({ you_format_status: "skipped", you_format_notes: "No source problem text" })
        .eq("id", asset_id);
      return new Response(JSON.stringify({ skipped: true, reason: "no source text" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pick a business from the curated library, restricted to chapter's allowed domains
    const [{ data: bizRows }, { data: domainRows }] = await Promise.all([
      sb.from("you_format_businesses").select("name, domain").eq("is_active", true),
      sb.from("you_format_chapter_domains").select("domain").eq("chapter_id", asset.chapter_id),
    ]);

    const allowedDomains = (domainRows ?? []).map((d) => d.domain);
    const business = pickBusiness(
      (bizRows ?? []) as { name: string; domain: string }[],
      allowedDomains,
      asset.id,
    );
    if (!business) throw new Error("No active businesses available for chapter");

    // Count parties referenced in original (for role-keeping rule)
    const roleMatches = (problemSource.match(/Survive Company [A-Z]\s*\((the\s+\w+)\)/gi) ?? [])
      .map((m) => m.toLowerCase());
    const uniqueRoles = new Set(roleMatches.map((m) => m.replace(/.*\(|\).*/g, "")));
    const multiParty = uniqueRoles.size >= 2;

    const userMessage = `Assigned business name: ${business.name}
Business domain: ${business.domain}
Multiple distinct parties in this problem: ${multiParty ? "YES — keep role parentheticals" : "NO — drop role parentheticals"}

ORIGINAL PROBLEM:
${problemSource}

ORIGINAL INSTRUCTIONS (return exactly ${instructions.length}):
${instructions.map((x, i) => `${i + 1}. ${x}`).join("\n")}

Rewrite into you-format following all rules. Return JSON only.`;

    const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_completion_tokens: 2000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      throw new Error(`OpenAI ${aiResp.status}: ${errText.slice(0, 500)}`);
    }

    const aiData = await aiResp.json();
    const raw = aiData.choices?.[0]?.message?.content?.trim() ?? "{}";
    let parsed: { problem_text?: string; instructions?: string[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`AI returned invalid JSON: ${raw.slice(0, 200)}`);
    }

    const newProblem = (parsed.problem_text ?? "").trim();
    const newInstructions = (parsed.instructions ?? []).map((x) => String(x).trim()).filter(Boolean);

    // Validate: instruction count
    const validationErrors: string[] = [];
    if (newInstructions.length !== instructions.length) {
      validationErrors.push(
        `Instruction count mismatch: expected ${instructions.length}, got ${newInstructions.length}`,
      );
    }

    // Validate: facts preserved
    const originalCombined = problemSource + "\n" + instructions.join("\n");
    const newCombined = newProblem + "\n" + newInstructions.join("\n");
    const originalFacts = extractFacts(originalCombined);
    const newFacts = extractFacts(newCombined);
    const missingFacts = originalFacts.filter((f) => !newFacts.includes(f));
    if (missingFacts.length > 0) {
      validationErrors.push(`Missing facts: ${missingFacts.slice(0, 8).join(", ")}`);
    }

    // Validate: didn't keep "Survive Company"
    if (/survive company/i.test(newCombined)) {
      validationErrors.push("Output still contains 'Survive Company'");
    }

    const status = validationErrors.length === 0 ? "generated" : "failed";
    const notes =
      validationErrors.length === 0
        ? `Rewritten with ${business.name} (${business.domain})${multiParty ? " · multi-party kept roles" : ""}`
        : validationErrors.join(" | ");

    const update: Record<string, unknown> = {
      you_format_status: status,
      you_format_notes: notes,
      you_format_generated_at: new Date().toISOString(),
      you_business_name: business.name,
    };

    if (status === "generated") {
      update.you_problem_text = newProblem;
      update.you_instruction_1 = newInstructions[0] ?? null;
      update.you_instruction_2 = newInstructions[1] ?? null;
      update.you_instruction_3 = newInstructions[2] ?? null;
      update.you_instruction_4 = newInstructions[3] ?? null;
      update.you_instruction_5 = newInstructions[4] ?? null;
    }

    const { error: updErr } = await sb
      .from("teaching_assets")
      .update(update)
      .eq("id", asset_id);
    if (updErr) throw new Error(`Update failed: ${updErr.message}`);

    return new Response(
      JSON.stringify({
        success: true,
        status,
        business: business.name,
        validation_errors: validationErrors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("you-format-rewrite error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
