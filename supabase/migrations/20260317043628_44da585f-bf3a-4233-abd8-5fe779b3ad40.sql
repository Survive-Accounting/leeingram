
CREATE TABLE public.dissector_problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  teaching_asset_id uuid REFERENCES public.teaching_assets(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES public.chapters(id),
  course_id uuid REFERENCES public.courses(id),
  problem_text text NOT NULL,
  highlights jsonb NOT NULL DEFAULT '[]',
  status text DEFAULT 'draft',
  plays integer DEFAULT 0,
  completions integer DEFAULT 0
);

ALTER TABLE public.dissector_problems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access on dissector_problems"
  ON public.dissector_problems FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public read published dissector_problems"
  ON public.dissector_problems FOR SELECT TO anon USING (status = 'published');
