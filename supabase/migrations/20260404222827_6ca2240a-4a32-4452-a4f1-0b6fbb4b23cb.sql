ALTER TABLE public.teaching_assets 
ADD COLUMN IF NOT EXISTS last_reviewed_by text,
ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz;