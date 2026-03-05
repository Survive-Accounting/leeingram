ALTER TABLE public.teaching_assets 
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_number text,
  ADD COLUMN IF NOT EXISTS problem_type text;