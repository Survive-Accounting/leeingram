
-- Create asset status enum
CREATE TYPE public.asset_status AS ENUM ('imported', 'variant_generated', 'approved', 'banked');

-- Create video status enum
CREATE TYPE public.asset_video_status AS ENUM ('none', 'coming_soon', 'published');

-- Create assets table
CREATE TABLE public.assets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_code text NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  chapter_number integer NOT NULL,
  exercise_code text NOT NULL DEFAULT '',
  textbook_id uuid REFERENCES public.textbooks(id) ON DELETE SET NULL,
  source_problem_text text NOT NULL DEFAULT '',
  ocr_text text NOT NULL DEFAULT '',
  variant_problem_text text NOT NULL DEFAULT '',
  variant_solution_text text NOT NULL DEFAULT '',
  difficulty_estimate integer NOT NULL DEFAULT 5,
  google_sheet_url text NOT NULL DEFAULT '',
  walkthrough_video_url text NOT NULL DEFAULT '',
  video_status public.asset_video_status NOT NULL DEFAULT 'none',
  status public.asset_status NOT NULL DEFAULT 'imported',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT difficulty_range CHECK (difficulty_estimate >= 1 AND difficulty_estimate <= 10),
  UNIQUE (asset_code)
);

-- Indexes
CREATE INDEX idx_assets_course_id ON public.assets (course_id);
CREATE INDEX idx_assets_chapter_number ON public.assets (chapter_number);
CREATE INDEX idx_assets_asset_code ON public.assets (asset_code);

-- RLS
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read assets" ON public.assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write assets" ON public.assets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update assets" ON public.assets FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete assets" ON public.assets FOR DELETE TO authenticated USING (true);
