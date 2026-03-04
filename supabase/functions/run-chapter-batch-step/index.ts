import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Find next item: queued first, then failed with attempts < 2
    const { data: nextItems } = await sb.from("chapter_batch_run_items")
      .select("*")
      .eq("batch_run_id", batch_run_id)
      .in("status", ["queued", "failed"])
      .order("status", { ascending: true }) // 'failed' before 'queued' alphabetically, but we want queued first
      .order("seq", { ascending: true })
      .limit(10);

    // Sort: queued first, then failed with attempts < 2
    const eligible = (nextItems ?? [])
      .filter(item => item.status === "queued" || (item.status === "failed" && item.attempts < 2))
      .sort((a, b) => {
        if (a.status === "queued" && b.status !== "queued") return -1;
        if (a.status !== "queued" && b.status === "queued") return 1;
        return a.seq - b.seq;
      });

    const nextItem = eligible[0];

    if (!nextItem) {
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

    // Mark item as generating
    const itemStart = Date.now();
    await sb.from("chapter_batch_run_items").update({
      status: "generating",
      started_at: new Date().toISOString(),
      attempts: nextItem.attempts + 1,
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

      return respondWithProgress(sb, batch_run_id, run.total_sources, "failed", nextItem.source_problem_id);
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

      return respondWithProgress(sb, batch_run_id, run.total_sources, "failed", nextItem.source_problem_id);
    }

    // For combined groups, only process if this problem is the primary (first by label sort)
    if (sourceProblem.combined_group_id) {
      const { data: groupMembers } = await sb.from("chapter_problems")
        .select("id, source_label, ocr_detected_label")
        .eq("combined_group_id", sourceProblem.combined_group_id)
        .order("source_label", { ascending: true });

      if (groupMembers && groupMembers.length > 1) {
        // Sort by label numerically
        const sorted = groupMembers.sort((a: any, b: any) =>
          (a.ocr_detected_label || a.source_label || "").localeCompare(
            b.ocr_detected_label || b.source_label || "", undefined, { numeric: true }
          )
        );
        const primaryId = sorted[0].id;
        if (sourceProblem.id !== primaryId) {
          // This is a secondary member — skip it, the primary will handle the combined text
          await sb.from("chapter_batch_run_items").update({
            status: "success",
            last_error: "Skipped: secondary combined member (processed via primary)",
            ended_at: new Date().toISOString(),
            duration_ms: Date.now() - itemStart,
            updated_at: new Date().toISOString(),
          }).eq("id", nextItem.id);

          // Also advance pipeline status for secondary members
          await sb.from("chapter_problems").update({
            status: "generated",
            pipeline_status: "generated",
          }).eq("id", sourceProblem.id);

          return respondWithProgress(sb, batch_run_id, run.total_sources, "success", nextItem.source_problem_id);
        }
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
          // Sort by label for consistent ordering
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
          variant_count: 1, // Force V1 only in batch
          source_problem_id: sourceProblem.id,
          course_id: run.course_id,
          chapter_id: run.chapter_id,
        }),
      });

      if (!convertRes.ok) {
        const errText = await convertRes.text();
        throw new Error(`convert-to-asset failed: ${convertRes.status} ${errText.slice(0, 500)}`);
      }

      const result = await convertRes.json();

      if (result.error) {
        throw new Error(result.error);
      }

      // Parse candidates and persist variants
      // Use candidates directly from response (convert-to-asset returns them at top level now)
      const candidates = result.candidates || result.parsed?.candidates || result.parsed?.teaching_aids?.candidates || [];
      if (!Array.isArray(candidates) || candidates.length === 0) {
        throw new Error("No candidates returned from generation");
      }

      // Only persist V1 (first candidate)
      const variantIds: string[] = [];
      const c = candidates[0];
      const variantLabel = "Variation A";

      // Use parts[] from AI output (universal schema)
      const parts = Array.isArray(c.parts) && c.parts.length > 0 ? c.parts : null;

      // Build journal_entry_completed_json and je_skeleton_json from parts JE data
      let jeCompletedJson: any = c.je_structured || null;
      let jeSkeletonJson: any = c.je_skeleton || null;

      if (parts && !jeCompletedJson) {
        // Extract JE from parts[] for backward compat + skeleton workflow
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
          // Auto-build skeleton from JE parts
          jeSkeletonJson = {
            scenario_sections: scenarioSections.map((sc: any) => ({
              scenario_label: sc.label,
              entry_dates: sc.entries_by_date.map((e: any) => e.entry_date),
            })),
          };
        }
      }

      // Build je_entries_json and je_entry_status_json from skeleton + completed data
      let jeEntriesJson: any = null;
      let jeEntryStatusJson: any = null;
      if (jeSkeletonJson && jeCompletedJson?.scenario_sections) {
        const entriesMap: Record<string, any> = {};
        const statusMap: Record<string, string> = {};
        for (const sc of jeCompletedJson.scenario_sections) {
          for (const entry of (sc.entries_by_date || [])) {
            const key = `${sc.label}::${entry.entry_date}`;
            entriesMap[key] = { rows: entry.rows || [] };
            statusMap[key] = "validated"; // Auto-validate from AI generation
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
        candidate_data: c,
        journal_entry_completed_json: jeCompletedJson,
        journal_entry_template_json: c.je_template || null,
        je_skeleton_json: jeSkeletonJson,
        je_entries_json: jeEntriesJson,
        je_entry_status_json: jeEntryStatusJson,
        parts_json: parts,
        answer_parts_json: parts ? null : (c.answer_parts || null),
      }).select("id").single();

      if (vErr) {
        console.error("Failed to insert variant:", vErr);
      }
      if (variant) variantIds.push(variant.id);

      // Update source problem status
      await sb.from("chapter_problems").update({
        status: "generated",
        pipeline_status: "generated",
      }).eq("id", sourceProblem.id);

      // Mark item success (clear any last_error from previous attempt)
      const durationMs = Date.now() - itemStart;
      await sb.from("chapter_batch_run_items").update({
        status: "success",
        ended_at: new Date().toISOString(),
        duration_ms: durationMs,
        created_variant_ids: variantIds,
        last_error: null,
        updated_at: new Date().toISOString(),
      }).eq("id", nextItem.id);

      return await respondWithProgress(sb, batch_run_id, run.total_sources, "success", nextItem.source_problem_id);

    } catch (genError) {
      const durationMs = Date.now() - itemStart;
      await sb.from("chapter_batch_run_items").update({
        status: "failed",
        last_error: genError.message?.slice(0, 1000) || "Unknown error",
        ended_at: new Date().toISOString(),
        duration_ms: durationMs,
        updated_at: new Date().toISOString(),
      }).eq("id", nextItem.id);

      return await respondWithProgress(sb, batch_run_id, run.total_sources, "failed", nextItem.source_problem_id);
    }

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function respondWithProgress(sb: any, batchRunId: string, totalSources: number, itemStatus: string, sourceProblemId: string) {
  const { data: allItems } = await sb.from("chapter_batch_run_items")
    .select("status, duration_ms").eq("batch_run_id", batchRunId);

  const successCount = (allItems ?? []).filter((i: any) => i.status === "success").length;
  const failedCount = (allItems ?? []).filter((i: any) => i.status === "failed" && i.attempts >= 2).length;
  const successItems = (allItems ?? []).filter((i: any) => i.status === "success");
  const avgMs = successItems.length > 0
    ? successItems.reduce((s: number, i: any) => s + (i.duration_ms ?? 0), 0) / successItems.length
    : null;

  // Update run counters
  await sb.from("chapter_batch_runs").update({
    completed_sources: successCount,
    failed_sources: failedCount,
    avg_seconds_per_source: avgMs ? avgMs / 1000 : null,
  }).eq("id", batchRunId);

  return new Response(JSON.stringify({
    done: false,
    item_status: itemStatus,
    source_problem_id: sourceProblemId,
    progress: {
      completed: successCount,
      failed: failedCount,
      total: totalSources,
      avg_seconds_per_source: avgMs ? avgMs / 1000 : null,
    },
  }), { headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } });
}
