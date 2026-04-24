ALTER TABLE public.campuses
  ADD COLUMN IF NOT EXISTS auto_name text,
  ADD COLUMN IF NOT EXISTS confidence_score int,
  ADD COLUMN IF NOT EXISTS mascot text,
  ADD COLUMN IF NOT EXISTS cheer text,
  ADD COLUMN IF NOT EXISTS color_primary text,
  ADD COLUMN IF NOT EXISTS color_secondary text,
  ADD COLUMN IF NOT EXISTS color_tertiary text,
  ADD COLUMN IF NOT EXISTS course_codes_json jsonb,
  ADD COLUMN IF NOT EXISTS enriched_at timestamptz;