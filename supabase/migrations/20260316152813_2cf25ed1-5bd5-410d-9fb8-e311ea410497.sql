ALTER TABLE public.teaching_assets
  ADD COLUMN IF NOT EXISTS problem_context_backup text,
  ADD COLUMN IF NOT EXISTS problem_text_backup text,
  ADD COLUMN IF NOT EXISTS problem_text_ht_backup text,
  ADD COLUMN IF NOT EXISTS answer_summary_backup text,
  ADD COLUMN IF NOT EXISTS worked_steps_backup text,
  ADD COLUMN IF NOT EXISTS last_bulk_fix_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_bulk_fix_label text;