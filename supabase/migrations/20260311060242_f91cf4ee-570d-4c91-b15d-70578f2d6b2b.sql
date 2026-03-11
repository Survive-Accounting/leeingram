ALTER TABLE public.teaching_assets
  ADD COLUMN IF NOT EXISTS important_formulas text DEFAULT '',
  ADD COLUMN IF NOT EXISTS concept_notes text DEFAULT '',
  ADD COLUMN IF NOT EXISTS exam_traps text DEFAULT '';