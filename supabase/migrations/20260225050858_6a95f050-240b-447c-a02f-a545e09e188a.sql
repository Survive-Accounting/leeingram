
CREATE TABLE public.export_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  chapter_id UUID REFERENCES public.chapters(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.export_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read export_sets" ON public.export_sets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write export_sets" ON public.export_sets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update export_sets" ON public.export_sets FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete export_sets" ON public.export_sets FOR DELETE TO authenticated USING (true);

CREATE TABLE public.export_set_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  export_set_id UUID NOT NULL REFERENCES public.export_sets(id) ON DELETE CASCADE,
  teaching_asset_id UUID NOT NULL REFERENCES public.teaching_assets(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.export_set_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read export_set_items" ON public.export_set_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write export_set_items" ON public.export_set_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update export_set_items" ON public.export_set_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete export_set_items" ON public.export_set_items FOR DELETE TO authenticated USING (true);
