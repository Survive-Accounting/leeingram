UPDATE public.bulk_fix_queue
SET status = 'failed',
    completed_at = now(),
    error_summary = 'Reset: queryErr ReferenceError caused stall. Function patched.'
WHERE operation_key = 'generate_supplementary_je'
  AND status = 'running';
