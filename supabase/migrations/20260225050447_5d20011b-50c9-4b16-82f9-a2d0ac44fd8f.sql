
-- Add new fields to teaching_assets
DO $$ BEGIN
  CREATE TYPE public.asset_difficulty AS ENUM ('standard', 'harder', 'tricky');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.asset_type AS ENUM ('practice_problem', 'journal_entry', 'concept_review', 'exam_prep');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.teaching_assets
  ADD COLUMN IF NOT EXISTS difficulty public.asset_difficulty,
  ADD COLUMN IF NOT EXISTS source_ref text,
  ADD COLUMN IF NOT EXISTS asset_type public.asset_type NOT NULL DEFAULT 'practice_problem';
