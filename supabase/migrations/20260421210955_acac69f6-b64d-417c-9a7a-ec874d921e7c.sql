ALTER TABLE public.teaching_assets
  ADD COLUMN IF NOT EXISTS survive_solution_json jsonb,
  ADD COLUMN IF NOT EXISTS survive_solution_json_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS survive_solution_explanation_cache jsonb;

COMMENT ON COLUMN public.teaching_assets.survive_solution_json IS 'Structured solution data for Option A display. Format: { parts: [{ label, instruction, answer, answer_type, steps, journal_entry }] }';
COMMENT ON COLUMN public.teaching_assets.survive_solution_json_generated_at IS 'Timestamp when survive_solution_json was last generated.';
COMMENT ON COLUMN public.teaching_assets.survive_solution_explanation_cache IS 'Per-part cached "explain the concept" responses. Format: { "a": "cached text...", "b": "cached text..." }';