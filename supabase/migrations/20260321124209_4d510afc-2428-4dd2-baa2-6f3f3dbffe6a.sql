
-- Reset failed and pending items so they can be re-run
UPDATE bulk_fix_queue 
SET status = 'pending', 
    started_at = NULL, 
    completed_at = NULL, 
    assets_processed = 0, 
    assets_succeeded = 0, 
    assets_errored = 0, 
    assets_skipped = 0, 
    error_summary = NULL
WHERE id IN ('db0ac79c-f335-4f86-9341-7894785f832f', '07f3804d-2e92-4343-adc9-b36a6cda4fbf', '7c0fc46c-c968-47d3-9b13-8c2ebe3b23d0');
