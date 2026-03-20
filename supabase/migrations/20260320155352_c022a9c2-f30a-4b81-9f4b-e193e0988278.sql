-- Fix: Intro 1 and Intro 2 problems stuck at 'pending' import_status
-- These courses have no solutions manual, so they skip the PDF upload step
-- and should go directly to 'needs_problem_screenshot' for VA screenshot capture.
UPDATE chapter_problems
SET import_status = 'needs_problem_screenshot'
WHERE course_id IN (
  SELECT id FROM courses WHERE code IN ('INTRO1', 'INTRO2')
)
AND import_status = 'pending'
AND problem_screenshot_url IS NULL;