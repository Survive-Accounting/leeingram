ALTER TABLE public.banked_questions
  ADD COLUMN IF NOT EXISTS teaching_asset_id uuid REFERENCES public.teaching_assets(id) ON DELETE CASCADE;

ALTER TABLE public.banked_questions
  ALTER COLUMN asset_id DROP NOT NULL;