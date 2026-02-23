
-- =============================================
-- Content Factory v2 — Database Migration
-- =============================================

-- 1. Add target_lessons to chapters
ALTER TABLE public.chapters
  ADD COLUMN IF NOT EXISTS target_lessons INTEGER DEFAULT 5;

-- 2. Add new columns to lessons
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS lesson_order INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS topic TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS concept_explanation TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS must_memorize TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS shortcuts TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS traps TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS status_planned BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS status_ready_to_film BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS status_filmed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS status_posted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS status_quiz_created BOOLEAN DEFAULT false;

-- 3. Problem Pairs table
CREATE TABLE public.problem_pairs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'Exercise',
  number INTEGER NOT NULL,
  problem_code TEXT NOT NULL,
  description TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'uploaded',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.problem_pairs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read problem_pairs" ON public.problem_pairs FOR SELECT USING (true);
CREATE POLICY "Authenticated write problem_pairs" ON public.problem_pairs FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated update problem_pairs" ON public.problem_pairs FOR UPDATE USING (true);
CREATE POLICY "Authenticated delete problem_pairs" ON public.problem_pairs FOR DELETE USING (true);

CREATE TRIGGER update_problem_pairs_updated_at
  BEFORE UPDATE ON public.problem_pairs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Problem Assets table (images stored in storage bucket)
CREATE TABLE public.problem_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  problem_pair_id UUID NOT NULL REFERENCES public.problem_pairs(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL DEFAULT 'problem_image',
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL DEFAULT '',
  page_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.problem_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read problem_assets" ON public.problem_assets FOR SELECT USING (true);
CREATE POLICY "Authenticated write problem_assets" ON public.problem_assets FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated update problem_assets" ON public.problem_assets FOR UPDATE USING (true);
CREATE POLICY "Authenticated delete problem_assets" ON public.problem_assets FOR DELETE USING (true);

-- 5. Lesson ↔ Problem Pairs junction
CREATE TABLE public.lesson_problem_pairs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  problem_pair_id UUID NOT NULL REFERENCES public.problem_pairs(id) ON DELETE CASCADE,
  sequence_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.lesson_problem_pairs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read lesson_problem_pairs" ON public.lesson_problem_pairs FOR SELECT USING (true);
CREATE POLICY "Authenticated write lesson_problem_pairs" ON public.lesson_problem_pairs FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated update lesson_problem_pairs" ON public.lesson_problem_pairs FOR UPDATE USING (true);
CREATE POLICY "Authenticated delete lesson_problem_pairs" ON public.lesson_problem_pairs FOR DELETE USING (true);

-- 6. Lesson Outputs table
CREATE TABLE public.lesson_outputs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  lesson_summary TEXT DEFAULT '',
  rewritten_exam_problems TEXT DEFAULT '',
  problem_breakdown TEXT DEFAULT '',
  video_outline TEXT DEFAULT '',
  canva_slide_blocks TEXT DEFAULT '',
  slide_script TEXT DEFAULT '',
  generated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.lesson_outputs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read lesson_outputs" ON public.lesson_outputs FOR SELECT USING (true);
CREATE POLICY "Authenticated write lesson_outputs" ON public.lesson_outputs FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated update lesson_outputs" ON public.lesson_outputs FOR UPDATE USING (true);
CREATE POLICY "Authenticated delete lesson_outputs" ON public.lesson_outputs FOR DELETE USING (true);

-- 7. Storage bucket for problem screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('problem-assets', 'problem-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can read problem-assets" ON storage.objects FOR SELECT USING (bucket_id = 'problem-assets');
CREATE POLICY "Authenticated upload problem-assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'problem-assets');
CREATE POLICY "Authenticated delete problem-assets" ON storage.objects FOR DELETE USING (bucket_id = 'problem-assets');

-- 8. Indexes for performance
CREATE INDEX idx_problem_pairs_chapter ON public.problem_pairs(chapter_id);
CREATE INDEX idx_problem_assets_pair ON public.problem_assets(problem_pair_id);
CREATE INDEX idx_lesson_problem_pairs_lesson ON public.lesson_problem_pairs(lesson_id);
CREATE INDEX idx_lesson_problem_pairs_problem ON public.lesson_problem_pairs(problem_pair_id);
CREATE INDEX idx_lesson_outputs_lesson ON public.lesson_outputs(lesson_id);
