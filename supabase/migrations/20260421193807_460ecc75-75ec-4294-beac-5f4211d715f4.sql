ALTER TABLE public.teaching_assets
  ADD COLUMN IF NOT EXISTS survive_solution_text_original text,
  ADD COLUMN IF NOT EXISTS ai_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_model_used text,
  ADD COLUMN IF NOT EXISTS ai_generation_status text,
  ADD COLUMN IF NOT EXISTS ai_generation_error text,
  ADD COLUMN IF NOT EXISTS ai_chapter_run_id text;

CREATE INDEX IF NOT EXISTS idx_teaching_assets_ai_chapter_run_id
  ON public.teaching_assets(ai_chapter_run_id)
  WHERE ai_chapter_run_id IS NOT NULL;