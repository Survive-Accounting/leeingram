ALTER TABLE public.chapter_journal_entries
ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'suggested';