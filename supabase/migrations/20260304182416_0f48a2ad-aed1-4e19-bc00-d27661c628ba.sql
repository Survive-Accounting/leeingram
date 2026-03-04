ALTER TABLE public.chapter_problems 
  ADD COLUMN IF NOT EXISTS dependency_type text NOT NULL DEFAULT 'standalone',
  ADD COLUMN IF NOT EXISTS dependency_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS detected_dependency_ref text NOT NULL DEFAULT '';