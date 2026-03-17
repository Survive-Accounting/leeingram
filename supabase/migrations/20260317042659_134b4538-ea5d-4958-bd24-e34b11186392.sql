
CREATE TABLE public.formula_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  course_id uuid REFERENCES public.courses(id),
  chapter_id uuid REFERENCES public.chapters(id),
  status text DEFAULT 'draft',
  plays integer DEFAULT 0,
  completions integer DEFAULT 0
);

CREATE TABLE public.formula_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id uuid REFERENCES public.formula_sets(id) ON DELETE CASCADE,
  formula_name text NOT NULL,
  formula_text text NOT NULL,
  hint text,
  source_asset_id uuid REFERENCES public.teaching_assets(id),
  sort_order integer DEFAULT 0,
  deleted boolean DEFAULT false
);

ALTER TABLE public.formula_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formula_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full select formula_sets" ON public.formula_sets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert formula_sets" ON public.formula_sets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update formula_sets" ON public.formula_sets FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete formula_sets" ON public.formula_sets FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated full select formula_items" ON public.formula_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert formula_items" ON public.formula_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update formula_items" ON public.formula_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete formula_items" ON public.formula_items FOR DELETE TO authenticated USING (true);

CREATE POLICY "Public read published formula_sets" ON public.formula_sets FOR SELECT TO anon USING (status = 'published');
CREATE POLICY "Public read published formula_items" ON public.formula_items FOR SELECT TO anon USING (
  EXISTS (SELECT 1 FROM public.formula_sets WHERE id = formula_items.set_id AND status = 'published')
);
