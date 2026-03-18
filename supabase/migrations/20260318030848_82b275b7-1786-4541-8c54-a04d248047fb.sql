ALTER TABLE teaching_assets ADD COLUMN IF NOT EXISTS problem_title text;

UPDATE teaching_assets ta
SET problem_title = cp.title
FROM chapter_problems cp
WHERE cp.id = ta.base_raw_problem_id
  AND cp.title IS NOT NULL
  AND cp.title != ''
  AND ta.problem_title IS NULL;