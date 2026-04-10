
CREATE TABLE public.chapter_memory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE CASCADE,
  title text NOT NULL,
  item_type text NOT NULL,
  subtitle text,
  items jsonb NOT NULL DEFAULT '[]',
  sort_order integer DEFAULT 0,
  is_approved boolean DEFAULT false,
  is_rejected boolean DEFAULT false,
  generated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_chapter_memory_items_chapter ON public.chapter_memory_items(chapter_id);

ALTER TABLE public.chapter_memory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read chapter_memory_items"
  ON public.chapter_memory_items FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert chapter_memory_items"
  ON public.chapter_memory_items FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update chapter_memory_items"
  ON public.chapter_memory_items FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete chapter_memory_items"
  ON public.chapter_memory_items FOR DELETE TO authenticated USING (true);
