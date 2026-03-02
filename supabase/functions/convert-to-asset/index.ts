import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOG_PREVIEW_CHARS = 1000;

function previewText(input: unknown, length = LOG_PREVIEW_CHARS) {
  const text = typeof input === "string"
    ? input
    : JSON.stringify(input ?? "", null, 0);

  return {
    first: text.slice(0, length),
    last: text.slice(-length),
    length: text.length,
  };
}

async function sha256Hex(input: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Helper to log generation events when run_id is provided
async function logGenEvent(
  sb: any,
  runId: string | null,
  seq: number,
  scope: string,
  level: string,
  eventType: string,
  message: string,
  payload?: any
) {
  if (!runId) return;
  try {
    await sb.from("generation_events").insert({
      run_id: runId,
      seq,
      scope,
      level,
      event_type: eventType,
      message,
      payload_json: payload ?? null,
    });
  } catch (_) { /* swallow */ }
}

function validateCandidates(candidates: any[], expectedCount: number) {
  const errors: string[] = [];

  if (!Array.isArray(candidates)) {
    return ["candidates must be an array"];
  }

  if (candidates.length !== expectedCount) {
    errors.push(`expected ${expectedCount} candidates, got ${candidates.length}`);
  }

  candidates.forEach((candidate, index) => {
    const prefix = `candidates[${index}]`;
    if (!candidate || typeof candidate !== "object") {
      errors.push(`${prefix} must be an object`);
      return;
    }

    if (typeof candidate.asset_name !== "string" || !candidate.asset_name.trim()) {
      errors.push(`${prefix}.asset_name is required`);
    }
    if (!Array.isArray(candidate.tags)) {
      errors.push(`${prefix}.tags must be an array`);
    }
    if (typeof candidate.survive_problem_text !== "string" || !candidate.survive_problem_text.trim()) {
      errors.push(`${prefix}.survive_problem_text is required`);
    }
    if (typeof candidate.answer_only !== "string" || !candidate.answer_only.trim()) {
      errors.push(`${prefix}.answer_only is required`);
    }
    if (typeof candidate.survive_solution_text !== "string" || !candidate.survive_solution_text.trim()) {
      errors.push(`${prefix}.survive_solution_text is required`);
    }
  });

  return errors;
}

function runCandidateValidators(candidates: any[], requiresJournalEntry: boolean) {
  const results: Array<Record<string, any>> = [];

  const hasCandidates = Array.isArray(candidates) && candidates.length > 0;
  results.push({
    name: "candidate_presence",
    status: hasCandidates ? "pass" : "fail",
    details_if_fail: hasCandidates ? undefined : "No candidates were generated",
  });

  const allHaveAnswerOnly = hasCandidates && candidates.every((c) => typeof c?.answer_only === "string" && c.answer_only.trim().length > 0);
  results.push({
    name: "answer_only_present",
    status: allHaveAnswerOnly ? "pass" : "fail",
    details_if_fail: allHaveAnswerOnly ? undefined : "One or more candidates are missing answer_only",
  });

  if (!requiresJournalEntry) {
    results.push({
      name: "journal_entry_presence",
      status: "skip",
      reason_if_skip: "Journal entry not required for this source problem",
    });
  } else {
    const allHaveJE = hasCandidates && candidates.every((c) =>
      typeof c?.journal_entry_block === "string"
        ? c.journal_entry_block.trim().length > 0
        : !!c?.journal_entry_template_json || !!c?.journal_entry_completed_json
    );

    results.push({
      name: "journal_entry_presence",
      status: allHaveJE ? "pass" : "fail",
      details_if_fail: allHaveJE ? undefined : "One or more candidates are missing structured/templated journal entry data",
    });
  }

  return results;
}

async function finalizeRunRecord(
  sb: any,
  params: {
    runId: string | null;
    status: "success" | "failed";
    durationMs: number;
    errorSummary?: string | null;
    variantId?: string | null;
    provider?: string | null;
    model?: string | null;
    courseId?: string | null;
    chapterId?: string | null;
    sourceProblemId?: string | null;
  }
) {
  if (!params.runId) return;

  try {
    const { data: timeline } = await sb
      .from("generation_events")
      .select("seq,scope,level,event_type,message,payload_json,created_at")
      .eq("run_id", params.runId)
      .order("seq", { ascending: true });

    const debugBundle = {
      run_id: params.runId,
      status: params.status,
      provider: params.provider ?? null,
      model: params.model ?? null,
      course_id: params.courseId ?? null,
      chapter_id: params.chapterId ?? null,
      source_problem_id: params.sourceProblemId ?? null,
      variant_id: params.variantId ?? null,
      duration_ms: params.durationMs,
      error_summary: params.errorSummary ?? null,
      timeline: (timeline ?? []).map((evt: any) => ({
        seq: evt.seq,
        scope: evt.scope,
        level: evt.level,
        event_type: evt.event_type,
        message: evt.message,
        payload: evt.payload_json,
        created_at: evt.created_at,
      })),
    };

    await sb
      .from("generation_runs")
      .update({
        status: params.status,
        duration_ms: params.durationMs,
        error_summary: params.errorSummary ?? null,
        variant_id: params.variantId ?? null,
        debug_bundle_json: debugBundle,
      })
      .eq("id", params.runId);
  } catch (error) {
    console.error("Failed to finalize generation run:", error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let runId: string | null = null;
  let eventSeq = 100;
  const runStartedAt = Date.now();
  let sbService: any = null;
  let runMeta: {
    provider: string | null;
    model: string | null;
    course_id: string | null;
    chapter_id: string | null;
    source_problem_id: string | null;
  } = {
    provider: null,
    model: null,
    course_id: null,
    chapter_id: null,
    source_problem_id: null,
  };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { mode } = body;

    runId = body.run_id ?? null;
    runMeta = {
      provider: body.provider ?? body.ui_provider_selected ?? "lovable",
      model: body.model ?? null,
      course_id: body.courseId ?? body.course_id ?? null,
      chapter_id: body.chapterId ?? body.chapter_id ?? null,
      source_problem_id: body.problemId ?? body.source_problem_id ?? null,
    };

    // Service client for backend logging + run finalization (RLS bypass)
    sbService = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (runId) {
      const { data: lastEvent } = await sbService
        .from("generation_events")
        .select("seq")
        .eq("run_id", runId)
        .order("seq", { ascending: false })
        .limit(1)
        .maybeSingle();

      eventSeq = Math.max(100, Number(lastEvent?.seq ?? 0));
    }

    // ─── MODE: save ─── Save a chosen candidate to DB
    if (mode === "save") {
      const problemId = body.problemId ?? body.source_problem_id;
      const courseId = body.courseId ?? body.course_id;
      const chapterId = body.chapterId ?? body.chapter_id;
      const candidate = body.candidate;
      const requiresJournalEntry = !!body.requiresJournalEntry;

      runMeta = {
        ...runMeta,
        course_id: courseId ?? runMeta.course_id,
        chapter_id: chapterId ?? runMeta.chapter_id,
        source_problem_id: problemId ?? runMeta.source_problem_id,
      };

      await logGenEvent(sbService, runId, ++eventSeq, "db", "info", "SAVE_VARIANT_START", "Starting variant persistence", {
        mode: "save",
        problem_id: problemId,
        course_id: courseId,
        chapter_id: chapterId,
        candidate_fields_present: {
          survive_problem_text: !!candidate?.survive_problem_text,
          survive_solution_text: !!candidate?.survive_solution_text,
          answer_only: !!candidate?.answer_only,
          journal_entry_block: !!candidate?.journal_entry_block,
          journal_entry_completed_json: !!candidate?.journal_entry_completed_json,
          journal_entry_template_json: !!candidate?.journal_entry_template_json,
        },
      });

      await logGenEvent(sbService, runId, ++eventSeq, "validator", "info", "RUN_VALIDATORS_START", "Running save-path validators");
      const saveValidatorResults = [
        {
          name: "candidate_payload_present",
          status: candidate && typeof candidate === "object" ? "pass" : "fail",
          details_if_fail: candidate && typeof candidate === "object" ? undefined : "Candidate payload is missing or invalid",
        },
        !requiresJournalEntry
          ? {
              name: "journal_entry_requirement",
              status: "skip",
              reason_if_skip: "Journal entry not required for this save operation",
            }
          : {
              name: "journal_entry_requirement",
              status:
                candidate?.journal_entry_block ||
                candidate?.journal_entry_completed_json ||
                candidate?.journal_entry_template_json
                  ? "pass"
                  : "fail",
              details_if_fail:
                candidate?.journal_entry_block ||
                candidate?.journal_entry_completed_json ||
                candidate?.journal_entry_template_json
                  ? undefined
                  : "Journal entry is required but no JE payload was provided",
            },
      ];

      await logGenEvent(
        sbService,
        runId,
        ++eventSeq,
        "validator",
        saveValidatorResults.some((v) => v.status === "fail") ? "warn" : "info",
        "RUN_VALIDATORS_END",
        "Save-path validators completed",
        { validator_results: saveValidatorResults }
      );

      // ── Auto-generate Instance ID ──
      const { data: course, error: courseErr } = await supabase
        .from("courses").select("code").eq("id", courseId).single();
      if (courseErr || !course) throw new Error("Course not found");

      const { data: chapter, error: chErr } = await supabase
        .from("chapters").select("chapter_number").eq("id", chapterId).single();
      if (chErr || !chapter) throw new Error("Chapter not found");

      const courseCode = course.code || "UNK";
      const chNum = chapter.chapter_number;

      const { count: existingVariants } = await supabase
        .from("teaching_assets")
        .select("id", { count: "exact", head: true })
        .eq("base_raw_problem_id", problemId);
      const variantLetter = String.fromCharCode(65 + (existingVariants || 0));

      let seqNum: number;
      if ((existingVariants || 0) === 0) {
        const { data: distinctSources } = await supabase
          .from("teaching_assets")
          .select("base_raw_problem_id")
          .eq("chapter_id", chapterId)
          .not("base_raw_problem_id", "is", null);
        const uniqueSources = new Set((distinctSources || []).map((d: any) => d.base_raw_problem_id));
        seqNum = uniqueSources.size + 1;
      } else {
        const { data: siblings } = await supabase
          .from("teaching_assets")
          .select("asset_name")
          .eq("base_raw_problem_id", problemId)
          .limit(1);
        const match = siblings?.[0]?.asset_name?.match(/_P(\d+)/);
        seqNum = match ? parseInt(match[1], 10) : 1;
      }

      const instanceId = `${courseCode}_CH${chNum}_P${String(seqNum).padStart(3, "0")}${variantLetter}`;

      const { data: newAsset, error: insertErr } = await supabase
        .from("teaching_assets")
        .insert({
          course_id: courseId,
          chapter_id: chapterId,
          base_raw_problem_id: problemId,
          asset_name: instanceId,
          tags: candidate.tags || [],
          survive_problem_text: candidate.survive_problem_text,
          journal_entry_block: requiresJournalEntry ? (candidate.journal_entry_block || null) : null,
          survive_solution_text: candidate.survive_solution_text,
          source_ref: candidate.answer_only || null,
          journal_entry_completed_json: candidate.journal_entry_completed_json || null,
          journal_entry_template_json: candidate.journal_entry_template_json || null,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      const { error: updateErr } = await supabase
        .from("chapter_problems")
        .update({ status: "approved" })
        .eq("id", problemId);
      if (updateErr) console.error("Failed to update problem status:", updateErr);

      await logGenEvent(sbService, runId, ++eventSeq, "db", "info", "SAVE_VARIANT_END", "Variant persisted", {
        variant_id: newAsset?.id ?? null,
        variant_name: newAsset?.asset_name ?? null,
        fields_written: {
          source_ref: !!newAsset?.source_ref,
          journal_entry_block: !!newAsset?.journal_entry_block,
          journal_entry_completed_json: !!newAsset?.journal_entry_completed_json,
          journal_entry_template_json: !!newAsset?.journal_entry_template_json,
        },
      });

      const durationMs = Date.now() - runStartedAt;
      await logGenEvent(sbService, runId, ++eventSeq, "backend", "info", "FINALIZE_RUN", "Finalizing save run", {
        status: "success",
        duration_ms: durationMs,
        variant_id: newAsset?.id ?? null,
      });

      await finalizeRunRecord(sbService, {
        runId,
        status: "success",
        durationMs,
        variantId: newAsset?.id ?? null,
        provider: runMeta.provider,
        model: runMeta.model,
        courseId: runMeta.course_id,
        chapterId: runMeta.chapter_id,
        sourceProblemId: runMeta.source_problem_id,
      });

      return new Response(JSON.stringify({ success: true, asset: newAsset }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── MODE: candidates (default) ─── Generate N variants with V2 prompt
    const problemId = body.problemId ?? body.source_problem_id;
    const sourceLabel = body.sourceLabel;
    const title = body.title;
    const problemText = body.problemText;
    const solutionText = body.solutionText;
    const journalEntryText = body.journalEntryText;
    const notes = body.notes;
    const requiresJournalEntry = !!body.requiresJournalEntry;
    const difficultyToggles = body.difficultyToggles;
    const reqProvider = body.provider ?? body.ui_provider_selected;
    const reqModel = body.model;
    const reqChapterId = body.chapterId ?? body.chapter_id;
    const reqScenarioBlocks = body.scenarioBlocks;
    const uiSettings = body.ui_settings ?? null;

    const provider = reqProvider || "lovable";
    const aiModel = reqModel || "google/gemini-3-flash-preview";

    runMeta = {
      provider,
      model: aiModel,
      course_id: body.courseId ?? body.course_id ?? runMeta.course_id,
      chapter_id: reqChapterId ?? runMeta.chapter_id,
      source_problem_id: problemId ?? runMeta.source_problem_id,
    };

    const scenarioBlocks = reqScenarioBlocks as Array<{ label: string; text: string }> | undefined;
    const hasScenarios = !!(scenarioBlocks && scenarioBlocks.length >= 2);

    await logGenEvent(sbService, runId, ++eventSeq, "backend", "info", "FETCH_SOURCE_START", "Starting source fetch and preprocessing", {
      course_id: runMeta.course_id,
      chapter_id: runMeta.chapter_id,
      source_problem_id: runMeta.source_problem_id,
      source_label: sourceLabel,
      has_ui_settings: !!uiSettings,
    });

    await logGenEvent(sbService, runId, ++eventSeq, "backend", "info", "FETCH_SOURCE_END", "Source payload prepared", {
      problem_text_length: problemText?.length ?? 0,
      solution_text_length: solutionText?.length ?? 0,
      journal_entry_text_length: journalEntryText?.length ?? 0,
      has_scenarios: hasScenarios,
      scenario_count: scenarioBlocks?.length ?? 0,
      problem_image_count: Array.isArray(body.problemImageUrls) ? body.problemImageUrls.length : null,
      solution_image_count: Array.isArray(body.solutionImageUrls) ? body.solutionImageUrls.length : null,
    });

    if (provider === "lovable") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    } else if (provider === "openai") {
      const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
      if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
    }

    // Fetch user's variant generation settings
    const userId = claimsData.claims.sub;
    const { data: genSettings } = await supabase
      .from("variant_generation_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const variantCount = genSettings?.variants_per_request ?? 3;

    const teachingTone: string[] = genSettings?.teaching_tone || [
      "Neutral but memorable", "Mix of playful and professional",
      "No campus-specific language", "No fluff or storytelling filler",
    ];
    const examRealism: string[] = genSettings?.exam_realism || [
      "All generated problems must be exam-style", "No bolded numbers",
      "Round all calculations to whole dollars", "Use short, concise sentences",
    ];
    const useCompanyNames = genSettings?.use_company_names ?? true;

    // Fetch random active company names
    let companyList = "Riverstone Corp (realistic), Moonbeam Industries (playful), Granite Financial (realistic)";
    if (useCompanyNames) {
      const { data: companyNames } = await supabase
        .from("company_names")
        .select("name, style")
        .eq("active", true);
      const shuffled = (companyNames || []).sort(() => Math.random() - 0.5);
      const selectedCompanies = shuffled.slice(0, 3);
      if (selectedCompanies.length >= 3) {
        companyList = selectedCompanies.map((c: any) => `${c.name} (${c.style})`).join(", ");
      }
    }

    // Fetch recent correction events for lightweight learning
    let constraintsBlock = "";
    if (reqChapterId) {
      const { data: recentFixes } = await supabase
        .from("correction_events")
        .select("summary, auto_tags")
        .eq("chapter_id", reqChapterId)
        .order("created_at", { ascending: false })
        .limit(3);
      if (recentFixes && recentFixes.length > 0) {
        constraintsBlock = `\nCONSTRAINTS FROM RECENT FIXES (apply these to avoid repeating errors):
${recentFixes.map((f: any, i: number) => `${i + 1}. ${f.summary} [tags: ${(f.auto_tags || []).join(", ")}]`).join("\n")}
`;
      }
    }

    // Merge saved tricky toggles with per-request overrides
    const savedTrickyToggles: string[] = [];
    if (genSettings?.tricky_partial_period) savedTrickyToggles.push("Partial period / stub period");
    if (genSettings?.tricky_missing_info) savedTrickyToggles.push("Missing information requiring inference");
    if (genSettings?.tricky_sign_reversal) savedTrickyToggles.push("Premium vs discount sign reversal traps");
    if (genSettings?.tricky_multi_step_decoy) savedTrickyToggles.push("Multi-step with decoy step");
    if (genSettings?.tricky_numerical_decoys) savedTrickyToggles.push("Decoy numerical values");
    if (genSettings?.tricky_je_direction_trap) savedTrickyToggles.push("Journal entry debit/credit direction traps");
    const allToggles = [...new Set([...savedTrickyToggles, ...(difficultyToggles || [])])];

    // Build difficulty toggles instruction
    let difficultySection = "";
    if (allToggles.length > 0) {
      difficultySection = `\nEXAM DIFFICULTY PATTERNS (incorporate at least one per variant):
${allToggles.map((t: string) => `- ${t}`).join("\n")}

For each variant, include an "exam_trap_note" explaining what makes this variant tricky.`;
    }

    const journalInstruction = requiresJournalEntry
      ? `JOURNAL ENTRY HANDLING:
- Generate journal entries using the entries_by_date format:
  { "entry_date": "YYYY-MM-DD or label", "rows": [{ "account_name": "...", "debit": number|null, "credit": number|null }] }
- Each entry_by_date must balance (sum debits == sum credits)
- Each row: exactly ONE of debit or credit (not both, not neither)
- account_name must be CLEAN: no "$", no ":", no "a./b./c.", no "1./2.", no narrative text
- Do NOT include reasoning checklists — just JE rows
- Format for easy Google Sheets copy/paste`
      : "JOURNAL ENTRY: Leave journal_entry_block as null. This problem does not require a journal entry.";

    let scenarioInstruction = "";
    if (scenarioBlocks && scenarioBlocks.length >= 2) {
      scenarioInstruction = `
MULTI-SCENARIO PROBLEM (${scenarioBlocks.length} independent scenarios detected):
This problem contains multiple independent scenarios. For EACH variant:
- Generate SEPARATE entries_by_date for EACH scenario
- Use the scenario_sections wrapper format:
  { "scenario_sections": [{ "label": "Situation 1", "entries_by_date": [...] }, ...] }
- Do NOT merge all scenarios into a single journal entry blob
- Each scenario should include entries for: a) issuance, b) interest payment, c) accrual (if applicable)
- Keep scenario numbering consistent

SCENARIO BLOCKS:
${scenarioBlocks.map((b: any) => `--- ${b.label} ---\n${b.text}`).join("\n\n")}
`;
    }

    // Fetch approved account whitelist for this chapter
    let accountWhitelistBlock = "";
    if (reqChapterId) {
      const { data: approvedAccounts } = await supabase
        .from("chapter_accounts")
        .select("account_name")
        .eq("chapter_id", reqChapterId)
        .eq("is_approved", true);
      if (approvedAccounts && approvedAccounts.length > 0) {
        const accountList = approvedAccounts.map((a: any) => a.account_name).join(", ");
        accountWhitelistBlock = `
APPROVED ACCOUNT WHITELIST (STRICT — use ONLY these account names in journal entries):
${accountList}
Do NOT invent or use account names outside this list. If an account is needed but not listed, use the closest match.
`;
      }
    }

    const systemPrompt = `You are an expert accounting instructor creating Scalable Teaching Assets for exam prep.

TEACHING TONE:
${teachingTone.map((t: string) => `- ${t}`).join("\n")}

EXAM REALISM RULES:
${examRealism.map((r: string) => `- ${r}`).join("\n")}

CORE RULES:
- Generate exactly ${variantCount} exam-style practice problem variants from the source.
- Each variant must teach the SAME core accounting concept as the source.
- Use DIFFERENT numerical values across all ${variantCount} variants.
- Each variant MUST use a different company name and short scenario.
- All scenarios must feel realistic and finance/accounting related.
- Do NOT include "Survive Accounting" in student-facing text.

COMPANY NAMES TO USE (one per variant, in order):
${companyList}

${difficultySection}
${constraintsBlock}
${accountWhitelistBlock}

${journalInstruction}
${scenarioInstruction}

SOLUTION STORAGE — For every variant, provide BOTH:
1. answer_only: Final numeric answers + JE summary (concise)
2. survive_solution_text: Fully worked steps with all internal solution logic (step-by-step)
- Do not generate written teaching explanations — student-facing explanation will be video-linked.

OUTPUT: Return exactly ${variantCount} candidates using tool calling.`;

    const userPrompt = `Source Problem: ${sourceLabel} — ${title}

Original Problem Text:
${problemText || "Not provided"}

Original Solution:
${solutionText || "Not provided"}

${journalEntryText ? `Original Journal Entry:\n${journalEntryText}` : ""}

${notes ? `Instructor Notes:\n${notes}` : ""}

Generate ${variantCount} exam-style practice variants.`;

    await logGenEvent(sbService, runId, ++eventSeq, "backend", "info", "BUILD_PROMPT", "Prompt built", {
      prompt_version: "convert_to_asset_v3_trace",
      provider,
      model: aiModel,
      variant_count: variantCount,
      structured_mode: {
        requires_journal_entry: requiresJournalEntry,
        scenario_split: hasScenarios,
        account_whitelist_enabled: accountWhitelistBlock.length > 0,
      },
      ui_settings: uiSettings,
      constraints_applied: constraintsBlock.length > 0,
      system_prompt_length: systemPrompt.length,
      user_prompt_length: userPrompt.length,
    });

    const promptCombined = `${systemPrompt}\n\n${userPrompt}`;
    const promptHash = await sha256Hex(promptCombined);
    const systemPreview = previewText(systemPrompt);
    const userPreview = previewText(userPrompt);

    const temperature = 0.2;
    const maxTokens = 8000;

    await logGenEvent(sbService, runId, ++eventSeq, "ai", "info", "AI_REQUEST", `Calling ${provider}/${aiModel}`, {
      provider,
      model: aiModel,
      temperature,
      max_tokens: maxTokens,
      json_mode: true,
      prompt_hash: promptHash,
      system_prompt_preview: { first: systemPreview.first, last: systemPreview.last },
      user_prompt_preview: { first: userPreview.first, last: userPreview.last },
    });

    const toolSpec = [
      {
        type: "function",
        function: {
          name: "create_teaching_asset_candidates",
          description: `Create ${variantCount} candidate scalable teaching assets from a raw problem`,
          parameters: {
            type: "object",
            properties: {
              candidates: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    asset_name: { type: "string", description: "Short clear name for this variant" },
                    tags: { type: "array", items: { type: "string" }, description: "2-6 concise concept tags" },
                    survive_problem_text: { type: "string", description: "Student-facing practice problem text" },
                    journal_entry_block: { type: "string", description: "Account | Debit | Credit grid or null" },
                    answer_only: { type: "string", description: "Final numeric answers + JE summary only" },
                    survive_solution_text: { type: "string", description: "Fully worked step-by-step solution" },
                    exam_trap_note: { type: "string", description: "Internal note on what makes this tricky (if difficulty toggles active)" },
                  },
                  required: ["asset_name", "tags", "survive_problem_text", "answer_only", "survive_solution_text"],
                  additionalProperties: false,
                },
                description: `Exactly ${variantCount} candidate teaching assets`,
              },
            },
            required: ["candidates"],
            additionalProperties: false,
          },
        },
      },
    ];

    const aiStartTime = Date.now();
    let response: Response;

    if (provider === "openai") {
      const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: aiModel,
          temperature,
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: toolSpec,
          tool_choice: { type: "function", function: { name: "create_teaching_asset_candidates" } },
        }),
      });
    } else {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: aiModel,
          temperature,
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: toolSpec,
          tool_choice: { type: "function", function: { name: "create_teaching_asset_candidates" } },
        }),
      });
    }

    const aiLatencyMs = Date.now() - aiStartTime;

    if (!response.ok) {
      const errStatus = response.status;
      const errText = await response.text();
      const errPreview = previewText(errText);

      await logGenEvent(sbService, runId, ++eventSeq, "ai", "error", "AI_RESPONSE", `AI error: ${errStatus}`, {
        status: errStatus,
        response_text_truncated: {
          first: errPreview.first,
          last: errPreview.last,
        },
        response_length_chars: errPreview.length,
        finish_reason: null,
        latency_ms: aiLatencyMs,
      });

      if (errStatus === 429) {
        throw new Error("Rate limit exceeded. Try again shortly.");
      }
      if (errStatus === 402) {
        throw new Error("AI credits exhausted. Add funds in Settings.");
      }
      throw new Error(`AI generation failed (${errStatus})`);
    }

    const data = await response.json();
    const rawResponseMessage = JSON.stringify(data?.choices?.[0]?.message ?? {});
    const aiResponsePreview = previewText(rawResponseMessage);

    await logGenEvent(sbService, runId, ++eventSeq, "ai", "info", "AI_RESPONSE", `Response received (${aiLatencyMs}ms)`, {
      response_text_truncated: {
        first: aiResponsePreview.first,
        last: aiResponsePreview.last,
      },
      response_length_chars: aiResponsePreview.length,
      finish_reason: data.choices?.[0]?.finish_reason ?? null,
      usage: data.usage ?? null,
      latency_ms: aiLatencyMs,
    });

    await logGenEvent(sbService, runId, ++eventSeq, "backend", "info", "PARSE_JSON_START", "Parsing tool call JSON");

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      await logGenEvent(sbService, runId, ++eventSeq, "backend", "error", "PARSE_JSON_END", "Tool call arguments missing", {
        parse_success: false,
        parse_error: "AI did not return structured output (no tool_calls)",
      });
      throw new Error("AI did not return structured output");
    }

    let parsed: any;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      await logGenEvent(sbService, runId, ++eventSeq, "backend", "error", "PARSE_JSON_END", "JSON parsing failed", {
        parse_success: false,
        parse_error: parseError instanceof Error ? parseError.message : "Unknown JSON parse error",
      });
      throw new Error(parseError instanceof Error ? parseError.message : "Failed to parse JSON");
    }

    const candidates = parsed.candidates || [];

    await logGenEvent(sbService, runId, ++eventSeq, "backend", "info", "PARSE_JSON_END", `Parsed ${candidates.length} candidates`, {
      parse_success: true,
      extracted_top_level_keys: Object.keys(parsed || {}),
      candidate_count: candidates.length,
    });

    await logGenEvent(sbService, runId, ++eventSeq, "validator", "info", "VALIDATE_SCHEMA_START", "Validating candidate schema", {
      schema_name: "create_teaching_asset_candidates",
      expected_candidate_count: variantCount,
    });

    const schemaErrors = validateCandidates(candidates, variantCount);
    if (schemaErrors.length > 0) {
      await logGenEvent(sbService, runId, ++eventSeq, "validator", "error", "VALIDATE_SCHEMA_END", "Schema validation failed", {
        schema_name: "create_teaching_asset_candidates",
        success: false,
        zod_errors: schemaErrors,
      });
      throw new Error(`Schema validation failed: ${schemaErrors[0]}`);
    }

    await logGenEvent(sbService, runId, ++eventSeq, "validator", "info", "VALIDATE_SCHEMA_END", "Schema validation passed", {
      schema_name: "create_teaching_asset_candidates",
      success: true,
      zod_errors: [],
    });

    await logGenEvent(sbService, runId, ++eventSeq, "validator", "info", "RUN_VALIDATORS_START", "Running candidate validators");

    const validatorResults = runCandidateValidators(candidates, requiresJournalEntry);
    const validatorFailed = validatorResults.some((r) => r.status === "fail");

    await logGenEvent(
      sbService,
      runId,
      ++eventSeq,
      "validator",
      validatorFailed ? "warn" : "info",
      "RUN_VALIDATORS_END",
      "Validator pass complete",
      { validator_results: validatorResults }
    );

    await logGenEvent(sbService, runId, ++eventSeq, "db", "info", "SAVE_VARIANT_START", "No backend variant persistence for candidates mode", {
      persisted: false,
      reason: "Variants are persisted by frontend after review",
    });

    await logGenEvent(sbService, runId, ++eventSeq, "db", "info", "SAVE_VARIANT_END", "No variant rows inserted by backend", {
      inserted_variant_ids: [],
      persisted: false,
    });

    const durationMs = Date.now() - runStartedAt;
    await logGenEvent(sbService, runId, ++eventSeq, "backend", "info", "FINALIZE_RUN", "Finalizing generation run", {
      status: "success",
      duration_ms: durationMs,
      variant_id: null,
    });

    await finalizeRunRecord(sbService, {
      runId,
      status: "success",
      durationMs,
      variantId: null,
      provider: runMeta.provider,
      model: runMeta.model,
      courseId: runMeta.course_id,
      chapterId: runMeta.chapter_id,
      sourceProblemId: runMeta.source_problem_id,
    });

    const constraintsCount = constraintsBlock
      ? constraintsBlock.split("\n").filter((l: string) => l.match(/^\d+\./)).length
      : 0;
    const scenarioLabels = scenarioBlocks?.map((b: any) => b.label) ?? [];

    return new Response(JSON.stringify({
      success: true,
      candidates,
      constraints_count: constraintsCount,
      scenario_labels: scenarioLabels,
      validator_results: validatorResults,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("convert-to-asset error:", e);

    const errorMessage = e instanceof Error ? e.message : "Unknown error";

    if (sbService && runId) {
      const durationMs = Date.now() - runStartedAt;

      await logGenEvent(sbService, runId, ++eventSeq, "backend", "error", "FINALIZE_RUN", "Finalizing generation run with failure", {
        status: "failed",
        duration_ms: durationMs,
        error_summary: errorMessage,
      });

      await finalizeRunRecord(sbService, {
        runId,
        status: "failed",
        durationMs,
        errorSummary: errorMessage,
        variantId: null,
        provider: runMeta.provider,
        model: runMeta.model,
        courseId: runMeta.course_id,
        chapterId: runMeta.chapter_id,
        sourceProblemId: runMeta.source_problem_id,
      });
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

