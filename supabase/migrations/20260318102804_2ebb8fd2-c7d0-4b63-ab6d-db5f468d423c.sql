ALTER TABLE public.teaching_assets 
  ADD COLUMN IF NOT EXISTS flowchart_image_url text,
  ADD COLUMN IF NOT EXISTS flowchart_image_id text,
  ADD COLUMN IF NOT EXISTS worked_steps text;