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
    stopPolling();
    pollRef.current = setInterval(async () => {
      const { data: jobItems } = await supabase
        .from("background_jobs" as any)
        .select("status")
        .eq("batch_id", batchId);

      if (!jobItems) return;

      const completed = jobItems.filter((i: any) => i.status === "done" || i.status === "failed").length;
      const failedCount = jobItems.filter((i: any) => i.status === "failed").length;
      const isComplete = completed >= items.length;

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
        if (options?.invalidateKeys) {
          for (const key of options.invalidateKeys) {
            qc.invalidateQueries({ queryKey: [key] });
          }
        }
        // Clear after a short delay so UI can show 100%
        setTimeout(() => setActiveBatch(null), 3000);
      }
    }, 5000);

    return batchId;
  }, [qc, stopPolling]);

  return { enqueue, activeBatch };
}
