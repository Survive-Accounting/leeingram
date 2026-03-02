
-- Add contains_no_journal_entries to chapter_problems
ALTER TABLE public.chapter_problems
  ADD COLUMN IF NOT EXISTS contains_no_journal_entries BOOLEAN NOT NULL DEFAULT FALSE;

-- Add answer_parts_json to problem_variants
ALTER TABLE public.problem_variants
  ADD COLUMN IF NOT EXISTS answer_parts_json JSONB NULL;
