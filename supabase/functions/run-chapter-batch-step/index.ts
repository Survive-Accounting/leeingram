import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CONCURRENCY = 3; // Process up to 3 items in parallel

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    const { batch_run_id } = await req.json();
    if (!batch_run_id) throw new Error("batch_run_id required");

    // Fetch the batch run
    const { data: run, error: runErr } = await sb.from("chapter_batch_runs")
      .select("*").eq("id", batch_run_id).single();
    if (runErr || !run) throw new Error("Batch run not found");

    if (run.status === "completed" || run.status === "canceled") {
      return new Response(JSON.stringify({ done: true, status: run.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find next items: queued first, then failed with attempts < 2
    const { data: nextItems } = await sb.from("chapter_batch_run_items")
      .select("*")
      .eq("batch_run_id", batch_run_id)
      .in("status", ["queued", "failed"])
      .order("seq", { ascending: true })
      .limit(20);

    // Sort: queued first, then failed with attempts < 2
    const eligible = (nextItems ?? [])
      .filter(item => item.status === "queued" || (item.status === "failed" && item.attempts < 2))
      .sort((a, b) => {
        if (a.status === "queued" && b.status !== "queued") return -1;
        if (a.status !== "queued" && b.status === "queued") return 1;
        return a.seq - b.seq;
      });

    // Take up to CONCURRENCY items
    const batch = eligible.slice(0, CONCURRENCY);

    if (batch.length === 0) {
      // All done - compute final stats
      const { data: allItems } = await sb.from("chapter_batch_run_items")
        .select("status, duration_ms").eq("batch_run_id", batch_run_id);

      const successItems = (allItems ?? []).filter(i => i.status === "success");
      const failedItems = (allItems ?? []).filter(i => i.status === "failed");
      const avgMs = successItems.length > 0
        ? successItems.reduce((s, i) => s + (i.duration_ms ?? 0), 0) / successItems.length
        : null;

      await sb.from("chapter_batch_runs").update({
        status: "completed",
        ended_at: new Date().toISOString(),
        completed_sources: successItems.length,
        failed_sources: failedItems.length,
        avg_seconds_per_source: avgMs ? avgMs / 1000 : null,
      }).eq("id", batch_run_id);

      return new Response(JSON.stringify({
        done: true,
        progress: {
          completed: successItems.length,
          failed: failedItems.length,
          total: run.total_sources,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Mark run as running if needed
    if (run.status !== "running") {
      await sb.from("chapter_batch_runs").update({
        status: "running",
        started_at: run.started_at || new Date().toISOString(),
      }).eq("id", batch_run_id);
    }

    // Process all items in parallel
    const results = await Promise.allSettled(
      batch.map(item => processItem(sb, supabaseUrl, serviceKey, item, run))
    );

    // Summarize results
    const itemResults = results.map((r, i) => ({
      source_problem_id: batch[i].source_problem_id,
      status: r.status === "fulfilled" ? r.value : "failed",
    }));

    return await respondWithProgress(sb, batch_run_id, run.total_sources, itemResults);

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processItem(sb: any, supabaseUrl: string, serviceKey: string, nextItem: any, run: any): Promise<string> {
  const itemStart = Date.now();
  const isRetry = nextItem.attempts > 0;

  // ── Soft-reset on retry: clear orphan variants and stale source problem state ──
  if (isRetry) {
    // Delete any orphan variants from the previous failed attempt
    const { data: orphanVariants } = await sb.from("problem_variants")
      .select("id")
      .eq("base_problem_id", nextItem.source_problem_id)
      .eq("variant_status", "draft");

    if (orphanVariants && orphanVariants.length > 0) {
      const orphanIds = orphanVariants.map((v: any) => v.id);
      await sb.from("problem_variants").delete().in("id", orphanIds);
      console.log(`[soft-reset] Cleared ${orphanIds.length} orphan variant(s) for source ${nextItem.source_problem_id}`);
    }

    // Reset source problem back to 'ready' if it was left in 'generated' by a partial failure
    await sb.from("chapter_problems").update({
      status: "ready",
      pipeline_status: "imported",
    }).eq("id", nextItem.source_problem_id)
      .in("status", ["generated"]);

    console.log(`[soft-reset] Reset source problem ${nextItem.source_problem_id} state for retry attempt ${nextItem.attempts + 1}`);
  }

  // Mark item as generating
  await sb.from("chapter_batch_run_items").update({
    status: "generating",
    started_at: new Date().toISOString(),
    attempts: nextItem.attempts + 1,
    last_error: null,  // Clear previous error on new attempt
    updated_at: new Date().toISOString(),
  }).eq("id", nextItem.id);

  // Fetch the source problem
  const { data: sourceProblem } = await sb.from("chapter_problems")
    .select("*").eq("id", nextItem.source_problem_id).single();

  if (!sourceProblem) {
    await sb.from("chapter_batch_run_items").update({
      status: "failed",
      last_error: "Source problem not found",
      ended_at: new Date().toISOString(),
      duration_ms: Date.now() - itemStart,
      updated_at: new Date().toISOString(),
    }).eq("id", nextItem.id);
    return "failed";
  }

  // Skip dependent problems that haven't been combined yet
  if (sourceProblem.dependency_type === "dependent_problem" && sourceProblem.dependency_status !== "combined") {
    await sb.from("chapter_batch_run_items").update({
      status: "failed",
      last_error: "Skipped: dependent problem (needs review)",
      ended_at: new Date().toISOString(),
      duration_ms: Date.now() - itemStart,
      updated_at: new Date().toISOString(),
    }).eq("id", nextItem.id);
    return "failed";
  }

  // For combined groups, only skip secondary if the primary is ALSO in this batch
  if (sourceProblem.combined_group_id) {
    const { data: groupMembers } = await sb.from("chapter_problems")
      .select("id, source_label, ocr_detected_label")
      .eq("combined_group_id", sourceProblem.combined_group_id)
      .order("source_label", { ascending: true });

    if (groupMembers && groupMembers.length > 1) {
      const sorted = groupMembers.sort((a: any, b: any) =>
        (a.ocr_detected_label || a.source_label || "").localeCompare(
          b.ocr_detected_label || b.source_label || "", undefined, { numeric: true }
        )
      );
      const primaryId = sorted[0].id;
      if (sourceProblem.id !== primaryId) {
        // Check if the primary is also in this batch run
        const { data: primaryInBatch } = await sb.from("chapter_batch_run_items")
          .select("id")
          .eq("batch_run_id", run.id)
          .eq("source_problem_id", primaryId)
          .maybeSingle();

        if (primaryInBatch) {
          // Primary is in this batch — skip secondary, it'll be handled via primary
          await sb.from("chapter_batch_run_items").update({
            status: "success",
            last_error: "Skipped: secondary combined member (processed via primary)",
            ended_at: new Date().toISOString(),
            duration_ms: Date.now() - itemStart,
            updated_at: new Date().toISOString(),
          }).eq("id", nextItem.id);

          await sb.from("chapter_problems").update({
            status: "generated",
            pipeline_status: "generated",
          }).eq("id", sourceProblem.id);

          return "success";
        }
        // Primary is NOT in this batch — process this secondary as if it were standalone
      }
    }
  }

  // Check if there's an existing teaching asset with learning structure flags
  let learningStructureFlags: any = {};
  {
    const { data: existingAsset } = await sb.from("teaching_assets")
      .select("uses_t_accounts, uses_tables, uses_financial_statements")
      .eq("base_raw_problem_id", sourceProblem.id)
      .limit(1)
      .maybeSingle();
    if (existingAsset) {
      if (existingAsset.uses_t_accounts) learningStructureFlags.uses_t_accounts = true;
      if (existingAsset.uses_tables) learningStructureFlags.uses_tables = true;
      if (existingAsset.uses_financial_statements) learningStructureFlags.uses_financial_statements = true;
    }
  }

  // Call the convert-to-asset function
  try {
    let problemText = sourceProblem.ocr_extracted_problem_text || sourceProblem.problem_text || "";
    let solutionText = sourceProblem.ocr_extracted_solution_text || sourceProblem.solution_text || "";
    const sourceLabel = sourceProblem.ocr_detected_label || sourceProblem.source_label || "";
    const title = sourceProblem.ocr_detected_title || sourceProblem.title || "";

    // If this problem is part of a combined group, concatenate text from all group members
    if (sourceProblem.combined_group_id) {
      const { data: groupMembers } = await sb.from("chapter_problems")
        .select("source_label, ocr_extracted_problem_text, problem_text, ocr_extracted_solution_text, solution_text, ocr_detected_label")
        .eq("combined_group_id", sourceProblem.combined_group_id)
        .neq("id", sourceProblem.id);

      if (groupMembers && groupMembers.length > 0) {
        const sorted = groupMembers.sort((a: any, b: any) =>
          (a.ocr_detected_label || a.source_label || "").localeCompare(
            b.ocr_detected_label || b.source_label || "", undefined, { numeric: true }
          )
        );
        for (const member of sorted) {
          const memberLabel = member.ocr_detected_label || member.source_label || "Related Problem";
          const memberProblem = member.ocr_extracted_problem_text || member.problem_text || "";
          const memberSolution = member.ocr_extracted_solution_text || member.solution_text || "";
          if (memberProblem) problemText += `\n\n--- ${memberLabel} (Combined) ---\n${memberProblem}`;
          if (memberSolution) solutionText += `\n\n--- ${memberLabel} Solution (Combined) ---\n${memberSolution}`;
        }
      }
    }

    const convertRes = await fetch(`${supabaseUrl}/functions/v1/convert-to-asset`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        mode: "candidates",
        problemId: sourceProblem.id,
        courseId: run.course_id,
        chapterId: run.chapter_id,
        sourceLabel,
        title,
        problemText,
        solutionText,
        journalEntryText: sourceProblem.journal_entry_text,
        provider: run.provider,
        variant_count: 1,
        source_problem_id: sourceProblem.id,
        course_id: run.course_id,
        chapter_id: run.chapter_id,
        ...learningStructureFlags,
      }),
    });

    if (!convertRes.ok) {
      const errText = await convertRes.text();
      throw new Error(`convert-to-asset failed: ${convertRes.status} ${errText.slice(0, 500)}`);
    }

    const result = await convertRes.json();
    if (result.error) throw new Error(result.error);

    const candidates = result.candidates || result.parsed?.candidates || result.parsed?.teaching_aids?.candidates || [];
    if (!Array.isArray(candidates) || candidates.length === 0) {
      throw new Error("No candidates returned from generation");
    }

    // Only persist V1 (first candidate)
    const variantIds: string[] = [];
    const c = candidates[0];
    const variantLabel = "Variation A";

    const parts = Array.isArray(c.parts) && c.parts.length > 0 ? c.parts : null;

    let jeCompletedJson: any = c.je_structured || null;
    let jeSkeletonJson: any = c.je_skeleton || null;

    if (parts && !jeCompletedJson) {
      const jeParts = parts.filter((p: any) => p.type === "je" && Array.isArray(p.je_structured));
      if (jeParts.length > 0) {
        const scenarioSections = jeParts.map((jp: any, i: number) => ({
          label: jp.label ? `Part ${jp.label}` : `Part ${String.fromCharCode(97 + i)}`,
          entries_by_date: (jp.je_structured || []).map((entry: any) => ({
            entry_date: entry.date || "Undated",
            rows: (entry.entries || []).map((e: any) => ({
              account_name: e.account || "",
              debit: e.debit != null ? Number(e.debit) : null,
              credit: e.credit != null ? Number(e.credit) : null,
            })),
          })),
        }));
        jeCompletedJson = { scenario_sections: scenarioSections };
        jeSkeletonJson = {
          scenario_sections: scenarioSections.map((sc: any) => ({
            scenario_label: sc.label,
            entry_dates: sc.entries_by_date.map((e: any) => e.entry_date),
          })),
        };
      }
    }

    let jeEntriesJson: any = null;
    let jeEntryStatusJson: any = null;
    if (jeSkeletonJson && jeCompletedJson?.scenario_sections) {
      const entriesMap: Record<string, any> = {};
      const statusMap: Record<string, string> = {};
      for (const sc of jeCompletedJson.scenario_sections) {
        for (const entry of (sc.entries_by_date || [])) {
          const key = `${sc.label}::${entry.entry_date}`;
          entriesMap[key] = { rows: entry.rows || [] };
          statusMap[key] = "validated";
        }
      }
      jeEntriesJson = entriesMap;
      jeEntryStatusJson = statusMap;
    }

    const { data: variant, error: vErr } = await sb.from("problem_variants").insert({
      base_problem_id: sourceProblem.id,
      variant_label: variantLabel,
      variant_problem_text: c.survive_problem_text || "",
      variant_solution_text: c.survive_solution_text || "",
      variant_status: "draft",
      candidate_data: {
        ...c,
        // Carry learning structures in candidate_data for review UI access
        t_accounts_json: c.t_accounts_json || null,
        tables_json: c.tables_json || null,
        financial_statements_json: c.financial_statements_json || null,
      },
      journal_entry_completed_json: jeCompletedJson,
      journal_entry_template_json: c.je_template || null,
      je_skeleton_json: jeSkeletonJson,
      je_entries_json: jeEntriesJson,
      je_entry_status_json: jeEntryStatusJson,
      parts_json: parts,
      answer_parts_json: parts ? null : (c.answer_parts || null),
    }).select("id").single();

    if (vErr) console.error("Failed to insert variant:", vErr);
    if (variant) variantIds.push(variant.id);

    await sb.from("chapter_problems").update({
      status: "generated",
      pipeline_status: "generated",
    }).eq("id", sourceProblem.id);

    const durationMs = Date.now() - itemStart;
    await sb.from("chapter_batch_run_items").update({
      status: "success",
      ended_at: new Date().toISOString(),
      duration_ms: durationMs,
      created_variant_ids: variantIds,
      last_error: null,
      updated_at: new Date().toISOString(),
    }).eq("id", nextItem.id);

    return "success";

  } catch (genError) {
    const durationMs = Date.now() - itemStart;
    await sb.from("chapter_batch_run_items").update({
      status: "failed",
      last_error: genError.message?.slice(0, 1000) || "Unknown error",
      ended_at: new Date().toISOString(),
      duration_ms: durationMs,
      updated_at: new Date().toISOString(),
    }).eq("id", nextItem.id);
    return "failed";
  }
}

async function respondWithProgress(sb: any, batchRunId: string, totalSources: number, itemResults: any[]) {
  const { data: allItems } = await sb.from("chapter_batch_run_items")
    .select("status, duration_ms, attempts").eq("batch_run_id", batchRunId);

  const successCount = (allItems ?? []).filter((i: any) => i.status === "success").length;
  const failedCount = (allItems ?? []).filter((i: any) => i.status === "failed" && i.attempts >= 2).length;
  const successItems = (allItems ?? []).filter((i: any) => i.status === "success");
  const avgMs = successItems.length > 0
    ? successItems.reduce((s: number, i: any) => s + (i.duration_ms ?? 0), 0) / successItems.length
    : null;

  await sb.from("chapter_batch_runs").update({
    completed_sources: successCount,
    failed_sources: failedCount,
    avg_seconds_per_source: avgMs ? avgMs / 1000 : null,
  }).eq("id", batchRunId);

  return new Response(JSON.stringify({
    done: false,
    items_processed: itemResults.length,
    item_results: itemResults,
    progress: {
      completed: successCount,
      failed: failedCount,
      total: totalSources,
      avg_seconds_per_source: avgMs ? avgMs / 1000 : null,
    },
  }), { headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } });
}
