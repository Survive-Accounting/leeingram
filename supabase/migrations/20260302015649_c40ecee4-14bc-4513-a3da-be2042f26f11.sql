ALTER TABLE public.problem_variants
  ADD COLUMN IF NOT EXISTS je_skeleton_json jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS je_entries_json jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS je_entry_status_json jsonb DEFAULT NULL;