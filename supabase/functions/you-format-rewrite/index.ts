// Rewrite a single teaching asset into "you-format":
// - Replace "Survive Company A (the X)" with second-person "you" voice
// - No business names. Use a generic domain hint (e.g., "you own a car dealership")
//   only when the original problem implies a business activity that benefits from context.
// - Drop role parentheticals unless 2+ distinct parties are referenced.
// - Preserve every numeric fact, account name, and instruction count.
//
// Writes to shadow columns: you_problem_text, you_instruction_1..5,
// you_business_name (used to store the *domain hint* for traceability),
// you_format_status ('generated' on success, 'failed' on validation fail).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You rewrite accounting practice problems into second-person ("you") voice. NO BUSINESS NAMES. Keep it generic and contextual.

REWRITE RULES:
1. Replace every reference to "Survive Company A", "Survive Company A (the seller)", etc., with "you" / "your" / "your business".
2. When the problem benefits from context, you may say things like "You own a [domain hint]..." or "You run a [domain hint]..." ONCE near the start. Otherwise just use "you/your" throughout.
3. NEVER invent or use a fictitious business name. No proper-noun business names of any kind.
4. Drop role parentheticals like "(the seller)", "(the buyer)" UNLESS the problem involves 2+ different parties — then keep the role for clarity.
5. Use second person consistently. "Survive Company A purchased" → "You purchased".
6. Preserve EVERY:
   - Number, dollar amount, percentage, date
   - Account name (Cash, Inventory, Sales Revenue, etc.)
   - Quantity, unit, term length
   - Sub-part labels: "(a)", "(b)", "(c)" — keep them exactly
7. Do NOT change accounting facts. Do NOT add/remove transactions or sub-parts.
8. If the original has separate numbered instructions, return the SAME number of instructions.
9. If the original has instructions inline (e.g., "(a) Calculate... (b) Prepare..."), keep them inline in the rewritten problem text and return an empty instructions array.
10. Tone: confident, conversational, exam-tutor voice. No textbook hedging.

OUTPUT a JSON object ONLY — no prose, no markdown fences:
{
  "problem_text": "rewritten problem in you-voice",
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
  you_format_status?: string;
};

function collectInstructions(a: Asset): string[] {
  return [a.instruction_1, a.instruction_2, a.instruction_3, a.instruction_4, a.instruction_5]
    .map((x) => (x ?? "").trim())
    .filter(Boolean);
}

// Extract dollar amounts, percentages, and large standalone numbers
function extractFacts(text: string): string[] {
  const facts = new Set<string>();
  for (const m of text.matchAll(/\$[\d,]+(?:\.\d+)?/g)) facts.add(m[0].replace(/,/g, ""));
  for (const m of text.matchAll(/\d+(?:\.\d+)?\s*%/g)) facts.add(m[0].replace(/\s+/g, ""));
  for (const m of text.matchAll(/\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b|\b\d{4,}(?:\.\d+)?\b/g)) {
    facts.add(m[0].replace(/,/g, ""));
  }
  return Array.from(facts);
}

// Pick a domain hint deterministically from chapter mapping
function pickDomainHint(allowedDomains: string[], seedKey: string): string | null {
  if (!allowedDomains.length) return null;
  let hash = 0;
  for (let i = 0; i < seedKey.length; i++) hash = (hash * 31 + seedKey.charCodeAt(i)) | 0;
  return allowedDomains[Math.abs(hash) % allowedDomains.length];
}

// Map raw domain slug → human-friendly description for the "you own a ___" frame
const DOMAIN_DESCRIPTIONS: Record<string, string> = {
  retail: "small retail business",
  manufacturing: "small manufacturing business",
  services: "service business",
  professional: "professional firm (law, accounting, or consulting)",
  tech: "small tech / software business",
  hospitality: "small hospitality business (restaurant, hotel, or cafe)",
  construction: "construction business",
  real_estate: "real estate business",
  logistics: "logistics / shipping business",
  automotive: "car dealership or auto-related business",
  healthcare: "healthcare practice",
};

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
    const instructionsAreInline = instructions.length === 0;

    if (!problemSource) {
      await sb
        .from("teaching_assets")
        .update({ you_format_status: "skipped", you_format_notes: "No source problem text" })
        .eq("id", asset_id);
      return new Response(JSON.stringify({ skipped: true, reason: "no source text" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Domain hint from chapter mapping (optional flavor only)
    const { data: domainRows } = await sb
      .from("you_format_chapter_domains")
      .select("domain")
      .eq("chapter_id", asset.chapter_id);
    const allowedDomains = (domainRows ?? []).map((d) => d.domain);
    const domainSlug = pickDomainHint(allowedDomains, asset.id);
    const domainHint = domainSlug ? DOMAIN_DESCRIPTIONS[domainSlug] ?? domainSlug : null;

    // Multi-party detection
    const roleMatches = (problemSource.match(/Survive Company [A-Z]\s*\((the\s+\w+)\)/gi) ?? [])
      .map((m) => m.toLowerCase());
    const uniqueRoles = new Set(roleMatches.map((m) => m.replace(/.*\(|\).*/g, "")));
    const multiParty = uniqueRoles.size >= 2;

    const userMessage = `Domain hint (use ONLY if a business-context phrase fits naturally; never invent a name): ${domainHint ?? "none — just use 'you/your business'"}
Multiple distinct parties in this problem: ${multiParty ? "YES — keep role parentheticals like (the seller)" : "NO — drop role parentheticals"}
Instruction format: ${instructionsAreInline ? "INLINE inside the problem text — return empty instructions array" : `SEPARATE — return exactly ${instructions.length} instructions`}

ORIGINAL PROBLEM:
${problemSource}

${instructionsAreInline ? "" : `ORIGINAL INSTRUCTIONS (return exactly ${instructions.length}):\n${instructions.map((x, i) => `${i + 1}. ${x}`).join("\n")}`}

Rewrite into you-format following all rules. Return JSON only.`;

    const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        max_completion_tokens: 3000,
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

    const validationErrors: string[] = [];

    // Validate instruction count ONLY if originals were stored separately
    if (!instructionsAreInline && newInstructions.length !== instructions.length) {
      validationErrors.push(
        `Instruction count mismatch: expected ${instructions.length}, got ${newInstructions.length}`,
      );
    }

    // Facts preservation
    const originalCombined = problemSource + "\n" + instructions.join("\n");
    const newCombined = newProblem + "\n" + newInstructions.join("\n");
    const originalFacts = extractFacts(originalCombined);
    const newFacts = extractFacts(newCombined);
    const missingFacts = originalFacts.filter((f) => !newFacts.includes(f));
    if (missingFacts.length > 0) {
      validationErrors.push(`Missing facts: ${missingFacts.slice(0, 8).join(", ")}`);
    }

    // No "Survive Company" should remain
    if (/survive company/i.test(newCombined)) {
      validationErrors.push("Output still contains 'Survive Company'");
    }

    const status = validationErrors.length === 0 ? "generated" : "failed";
    const notes =
      validationErrors.length === 0
        ? `Rewritten${domainHint ? ` (hint: ${domainHint})` : ""}${multiParty ? " · multi-party kept roles" : ""}`
        : validationErrors.join(" | ");

    const update: Record<string, unknown> = {
      you_format_status: status,
      you_format_notes: notes,
      you_format_generated_at: new Date().toISOString(),
      you_business_name: domainHint, // store the domain hint for traceability (no proper name)
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
        domain_hint: domainHint,
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
