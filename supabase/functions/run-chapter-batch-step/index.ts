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
          // Universal mode: let convert-to-asset auto-detect problem type
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

      const variantIds: string[] = [];
      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        const variantLabel = `Variation ${String.fromCharCode(65 + i)}`;

        // Use parts[] from AI output (universal schema)
        const parts = Array.isArray(c.parts) && c.parts.length > 0 ? c.parts : null;

        const { data: variant, error: vErr } = await sb.from("problem_variants").insert({
          base_problem_id: sourceProblem.id,
          variant_label: variantLabel,
          variant_problem_text: c.survive_problem_text || "",
          variant_solution_text: c.survive_solution_text || "",
          variant_status: "draft",
          candidate_data: c,
          journal_entry_completed_json: c.je_structured || null,
          journal_entry_template_json: c.je_template || null,
          je_skeleton_json: c.je_skeleton || null,
          parts_json: parts,
          answer_parts_json: parts ? null : (c.answer_parts || null),
        }).select("id").single();

        if (vErr) {
          console.error("Failed to insert variant:", vErr);
          continue;
        }
        if (variant) variantIds.push(variant.id);
      }

      // Update source problem status
      await sb.from("chapter_problems").update({
        status: "generated",
        pipeline_status: "generated",
      }).eq("id", sourceProblem.id);

      // Mark item success
      const durationMs = Date.now() - itemStart;
      await sb.from("chapter_batch_run_items").update({
        status: "success",
        ended_at: new Date().toISOString(),
        duration_ms: durationMs,
        created_variant_ids: variantIds,
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
