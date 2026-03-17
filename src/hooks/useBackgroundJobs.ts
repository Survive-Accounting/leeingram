import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface BackgroundBatch {
  batchId: string;
  jobType: string;
  total: number;
  done: number;
  failed: number;
  isComplete: boolean;
}

export function useBackgroundJobs() {
  const qc = useQueryClient();
  const [activeBatch, setActiveBatch] = useState<BackgroundBatch | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Clean up on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  // Poll function that can be shared between enqueue and resume
  const startPolling = useCallback((batchId: string, total: number, label: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const { data: jobItems } = await supabase
        .from("background_jobs" as any)
        .select("status")
        .eq("batch_id", batchId);

      if (!jobItems) return;

      const completed = (jobItems as any[]).filter((i: any) => i.status === "done" || i.status === "failed").length;
      const failedCount = (jobItems as any[]).filter((i: any) => i.status === "failed").length;
      const isComplete = completed >= total;

      setActiveBatch(prev => prev?.batchId === batchId ? {
        ...prev,
        done: completed,
        failed: failedCount,
        isComplete,
      } : prev);

      if (isComplete) {
        stopPolling();
        const succeeded = completed - failedCount;
        toast.success(
          `Done — ${succeeded} ${label}${succeeded !== 1 ? "s" : ""} completed${failedCount > 0 ? `, ${failedCount} failed` : ""}`
        );
        qc.invalidateQueries({ queryKey: ["teaching-assets"] });
        // Clear after a short delay so UI can show 100%
        setTimeout(() => {
          setActiveBatch(null);
          try { sessionStorage.removeItem("bg_active_batch"); } catch {}
        }, 3000);
      }
    }, 5000);
  }, [qc, stopPolling]);

  // On mount, check for any in-progress batch and resume tracking
  useEffect(() => {
    const resumeFromSession = async () => {
      // First check sessionStorage for a batch we were tracking
      try {
        const stored = sessionStorage.getItem("bg_active_batch");
        if (stored) {
          const parsed = JSON.parse(stored) as { batchId: string; jobType: string; total: number; label: string };
          // Verify it's still running
          const { data: jobItems } = await supabase
            .from("background_jobs" as any)
            .select("status")
            .eq("batch_id", parsed.batchId);

          if (jobItems && (jobItems as any[]).length > 0) {
            const completed = (jobItems as any[]).filter((i: any) => i.status === "done" || i.status === "failed").length;
            const failedCount = (jobItems as any[]).filter((i: any) => i.status === "failed").length;
            const total = (jobItems as any[]).length;
            const isComplete = completed >= total;

            if (!isComplete) {
              setActiveBatch({
                batchId: parsed.batchId,
                jobType: parsed.jobType,
                total,
                done: completed,
                failed: failedCount,
                isComplete: false,
              });
              startPolling(parsed.batchId, total, parsed.label || parsed.jobType);
              return;
            } else {
              sessionStorage.removeItem("bg_active_batch");
            }
          }
        }
      } catch {}

      // Fallback: check DB for any batch with queued/processing items
      const { data: activeBatches } = await supabase
        .from("background_jobs" as any)
        .select("batch_id, job_type, status")
        .in("status", ["queued", "processing"])
        .limit(500);

      if (!activeBatches || (activeBatches as any[]).length === 0) return;

      // Find the most common batch_id (the active one)
      const batchCounts: Record<string, { jobType: string; count: number }> = {};
      for (const row of activeBatches as any[]) {
        if (!batchCounts[row.batch_id]) {
          batchCounts[row.batch_id] = { jobType: row.job_type, count: 0 };
        }
        batchCounts[row.batch_id].count++;
      }

      const topBatch = Object.entries(batchCounts).sort((a, b) => b[1].count - a[1].count)[0];
      if (!topBatch) return;

      const [batchId, { jobType }] = topBatch;

      // Get full count for this batch
      const { data: allItems } = await supabase
        .from("background_jobs" as any)
        .select("status")
        .eq("batch_id", batchId);

      if (!allItems) return;

      const total = (allItems as any[]).length;
      const completed = (allItems as any[]).filter((i: any) => i.status === "done" || i.status === "failed").length;
      const failedCount = (allItems as any[]).filter((i: any) => i.status === "failed").length;
      const label = jobType.replace(/_/g, " ");

      setActiveBatch({
        batchId,
        jobType,
        total,
        done: completed,
        failed: failedCount,
        isComplete: false,
      });

      startPolling(batchId, total, label);
    };

    resumeFromSession();
  }, [startPolling]);

  const enqueue = useCallback(async (
    jobType: string,
    items: { teaching_asset_id: string; [key: string]: any }[],
    options?: { invalidateKeys?: string[]; label?: string }
  ) => {
    if (!items.length) {
      toast.info("Nothing to process");
      return null;
    }

    const batchId = crypto.randomUUID();
    const rows = items.map(item => ({
      batch_id: batchId,
      job_type: jobType,
      payload: item,
      status: "queued",
    }));

    const { error: insertErr } = await supabase.from("background_jobs" as any).insert(rows);
    if (insertErr) {
      toast.error("Failed to enqueue: " + insertErr.message);
      return null;
    }

    const label = options?.label || jobType.replace(/_/g, " ");
    toast.success(`Queued ${items.length} ${label} job${items.length > 1 ? "s" : ""} — processing server-side`);

    // Persist to sessionStorage so we can resume after refresh
    try {
      sessionStorage.setItem("bg_active_batch", JSON.stringify({ batchId, jobType, total: items.length, label }));
    } catch {}

    setActiveBatch({
      batchId,
      jobType,
      total: items.length,
      done: 0,
      failed: 0,
      isComplete: false,
    });

    // Kick off processing
    supabase.functions.invoke("process-background-jobs").catch(() => {});

    // Start polling
    startPolling(batchId, items.length, label);

    return batchId;
  }, [startPolling]);

  return { enqueue, activeBatch };
}
