-- Fix stuck chapter_problems where teaching_asset exists and is approved but pipeline_status is still 'generated'
UPDATE chapter_problems cp
SET pipeline_status = 'approved', status = 'approved'
WHERE cp.pipeline_status = 'generated'
AND EXISTS (
  SELECT 1 FROM teaching_assets ta
  WHERE ta.chapter_id = cp.chapter_id
  AND ta.source_ref = cp.source_code
  AND ta.asset_approved_at IS NOT NULL
);