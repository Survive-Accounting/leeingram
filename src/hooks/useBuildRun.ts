import { useCallback, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

export interface BuildRun {
  id: string;
  course_id: string;
  chapter_id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  imported_source_ids: string[];
  import_count: number;
  approved_count: number;
  needs_fix_count: number;
  terminal_count: number;
  avg_seconds_per_terminal: number | null;
  avg_seconds_per_approved: number | null;
  total_seconds: number | null;
  notes: string | null;
}

export function useBuildRun() {
  const qc = useQueryClient();
  const { workspace } = useActiveWorkspace();
  const chapterId = workspace?.chapterId || "";
  const courseId = workspace?.courseId || "";

  // Fetch the active or most recent run for this chapter
  const { data: activeRun, isLoading } = useQuery({
    queryKey: ["build-run", chapterId],
    queryFn: async () => {
      // First try to find a running one
      const { data: running } = await supabase
        .from("chapter_build_runs")
        .select("*")
        .eq("chapter_id", chapterId)
        .eq("status", "running")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (running) return running as unknown as BuildRun;

      // Otherwise get most recent completed/abandoned
      const { data: recent } = await supabase
        .from("chapter_build_runs")
        .select("*")
        .eq("chapter_id", chapterId)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (recent as unknown as BuildRun) || null;
    },
    enabled: !!chapterId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["build-run", chapterId] });

  const startRun = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("chapter_build_runs")
        .insert({
          course_id: courseId,
          chapter_id: chapterId,
          status: "running",
          imported_source_ids: [],
          import_count: 0,
          approved_count: 0,
          needs_fix_count: 0,
          terminal_count: 0,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const endRun = useMutation({
    mutationFn: async (status: "completed" | "abandoned") => {
      if (!activeRun || activeRun.status !== "running") return;
      const now = new Date().toISOString();
      const startMs = new Date(activeRun.started_at).getTime();
      const totalSec = (Date.now() - startMs) / 1000;
      const updates: any = {
        ended_at: now,
        status,
        total_seconds: totalSec,
        avg_seconds_per_terminal: activeRun.terminal_count > 0 ? totalSec / activeRun.terminal_count : null,
        avg_seconds_per_approved: activeRun.approved_count > 0 ? totalSec / activeRun.approved_count : null,
      };
      const { error } = await supabase
        .from("chapter_build_runs")
        .update(updates)
        .eq("id", activeRun.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Register a newly imported source to the active run
  const registerImport = useCallback(async (sourceId: string) => {
    if (!activeRun || activeRun.status !== "running") return;
    const ids = [...(activeRun.imported_source_ids || []), sourceId];
    const { error } = await supabase
      .from("chapter_build_runs")
      .update({
        imported_source_ids: ids,
        import_count: ids.length,
      } as any)
      .eq("id", activeRun.id);
    if (error) console.error("registerImport error:", error);
    // Also set build_run_id on the source problem
    await supabase
      .from("chapter_problems")
      .update({ build_run_id: activeRun.id } as any)
      .eq("id", sourceId);
    invalidate();
  }, [activeRun]);

  // Recompute progress after a variant status change
  const recomputeProgress = useCallback(async () => {
    if (!activeRun || activeRun.status !== "running") return;
    const sourceIds = activeRun.imported_source_ids || [];
    if (sourceIds.length === 0) return;

    // Get all variants for these sources
    const { data: variants } = await supabase
      .from("problem_variants")
      .select("base_problem_id, variant_status")
      .in("base_problem_id", sourceIds);

    if (!variants) return;

    // Group by source
    const sourceStatuses = new Map<string, Set<string>>();
    variants.forEach((v: any) => {
      if (!sourceStatuses.has(v.base_problem_id)) sourceStatuses.set(v.base_problem_id, new Set());
      sourceStatuses.get(v.base_problem_id)!.add(v.variant_status);
    });

    let approvedCount = 0;
    let needsFixCount = 0;
    let terminalCount = 0;

    sourceIds.forEach((sid: string) => {
      const statuses = sourceStatuses.get(sid);
      if (!statuses) return;
      const isApproved = statuses.has("approved");
      const isNeedsFix = statuses.has("needs_fix");
      if (isApproved || isNeedsFix) {
        terminalCount++;
        if (isApproved) approvedCount++;
        if (isNeedsFix && !isApproved) needsFixCount++;
      }
    });

    const updates: any = {
      approved_count: approvedCount,
      needs_fix_count: needsFixCount,
      terminal_count: terminalCount,
    };

    // Check if complete
    if (terminalCount === sourceIds.length && sourceIds.length > 0) {
      const now = new Date().toISOString();
      const totalSec = (Date.now() - new Date(activeRun.started_at).getTime()) / 1000;
      updates.ended_at = now;
      updates.status = "completed";
      updates.total_seconds = totalSec;
      updates.avg_seconds_per_terminal = terminalCount > 0 ? totalSec / terminalCount : null;
      updates.avg_seconds_per_approved = approvedCount > 0 ? totalSec / approvedCount : null;
    }

    const { error } = await supabase
      .from("chapter_build_runs")
      .update(updates)
      .eq("id", activeRun.id);
    if (error) console.error("recomputeProgress error:", error);
    invalidate();
  }, [activeRun]);

  return {
    activeRun,
    isLoading,
    isRunning: activeRun?.status === "running",
    startRun,
    endRun,
    registerImport,
    recomputeProgress,
    invalidate,
  };
}
