ALTER TABLE public.chapter_problems 
  ADD COLUMN IF NOT EXISTS problem_screenshot_url text,
  ADD COLUMN IF NOT EXISTS solution_screenshot_url text;