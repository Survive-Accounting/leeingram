ALTER TABLE public.teaching_assets
  ADD COLUMN IF NOT EXISTS prep_doc_id text,
  ADD COLUMN IF NOT EXISTS prep_doc_url text;