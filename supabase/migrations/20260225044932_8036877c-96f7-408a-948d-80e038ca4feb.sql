
CREATE TABLE public.teaching_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  base_raw_problem_id UUID REFERENCES public.chapter_problems(id) ON DELETE SET NULL,
  asset_name TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  survive_problem_text TEXT NOT NULL DEFAULT '',
  journal_entry_block TEXT,
  survive_solution_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.teaching_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read teaching_assets" ON public.teaching_assets FOR SELECT USING (true);
CREATE POLICY "Authenticated write teaching_assets" ON public.teaching_assets FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated update teaching_assets" ON public.teaching_assets FOR UPDATE USING (true);
CREATE POLICY "Authenticated delete teaching_assets" ON public.teaching_assets FOR DELETE USING (true);

CREATE TRIGGER update_teaching_assets_updated_at
  BEFORE UPDATE ON public.teaching_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
