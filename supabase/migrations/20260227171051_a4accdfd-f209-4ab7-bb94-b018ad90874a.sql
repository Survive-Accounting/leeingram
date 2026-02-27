ALTER TABLE public.teaching_assets 
  ADD COLUMN IF NOT EXISTS journal_entry_completed_json jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS journal_entry_template_json jsonb DEFAULT NULL;

ALTER TABLE public.problem_variants
  ADD COLUMN IF NOT EXISTS journal_entry_completed_json jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS journal_entry_template_json jsonb DEFAULT NULL;