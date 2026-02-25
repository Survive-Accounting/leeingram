
-- Create enums
CREATE TYPE public.problem_type AS ENUM ('exercise', 'problem', 'custom');
CREATE TYPE public.difficulty_level AS ENUM ('easy', 'medium', 'hard', 'tricky');

-- Create chapter_problems table
CREATE TABLE public.chapter_problems (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  problem_type public.problem_type NOT NULL DEFAULT 'exercise',
  source_label TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  problem_text TEXT NOT NULL DEFAULT '',
  solution_text TEXT NOT NULL DEFAULT '',
  journal_entry_text TEXT,
  difficulty_internal public.difficulty_level,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create problem_variants table
CREATE TABLE public.problem_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  base_problem_id UUID NOT NULL REFERENCES public.chapter_problems(id) ON DELETE CASCADE,
  variant_label TEXT NOT NULL DEFAULT 'Variation A',
  variant_problem_text TEXT NOT NULL DEFAULT '',
  variant_solution_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chapter_problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problem_variants ENABLE ROW LEVEL SECURITY;

-- RLS policies for chapter_problems (authenticated access)
CREATE POLICY "Authenticated read chapter_problems" ON public.chapter_problems FOR SELECT USING (true);
CREATE POLICY "Authenticated write chapter_problems" ON public.chapter_problems FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated update chapter_problems" ON public.chapter_problems FOR UPDATE USING (true);
CREATE POLICY "Authenticated delete chapter_problems" ON public.chapter_problems FOR DELETE USING (true);

-- RLS policies for problem_variants
CREATE POLICY "Authenticated read problem_variants" ON public.problem_variants FOR SELECT USING (true);
CREATE POLICY "Authenticated write problem_variants" ON public.problem_variants FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated update problem_variants" ON public.problem_variants FOR UPDATE USING (true);
CREATE POLICY "Authenticated delete problem_variants" ON public.problem_variants FOR DELETE USING (true);
