ALTER TABLE public.explanation_feedback
  ADD COLUMN IF NOT EXISTS section text,
  ADD COLUMN IF NOT EXISTS context jsonb;