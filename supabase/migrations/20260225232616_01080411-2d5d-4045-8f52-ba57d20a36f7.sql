ALTER TABLE public.chapter_problems 
ADD COLUMN IF NOT EXISTS problem_screenshot_urls text[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS solution_screenshot_urls text[] NOT NULL DEFAULT '{}';