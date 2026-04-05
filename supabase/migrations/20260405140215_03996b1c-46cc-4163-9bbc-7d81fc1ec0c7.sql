
-- Chapter JE Categories
CREATE TABLE public.chapter_je_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  category_name text NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_chapter_je_categories_chapter ON public.chapter_je_categories(chapter_id);

ALTER TABLE public.chapter_je_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read chapter JE categories"
  ON public.chapter_je_categories FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage chapter JE categories"
  ON public.chapter_je_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Chapter Journal Entries
CREATE TABLE public.chapter_journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.chapter_je_categories(id) ON DELETE SET NULL,
  transaction_label text NOT NULL,
  je_lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_approved boolean DEFAULT false,
  is_rejected boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  generated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_chapter_journal_entries_chapter ON public.chapter_journal_entries(chapter_id);

ALTER TABLE public.chapter_journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read chapter journal entries"
  ON public.chapter_journal_entries FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage chapter journal entries"
  ON public.chapter_journal_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Timestamp trigger
CREATE TRIGGER update_chapter_journal_entries_updated_at
  BEFORE UPDATE ON public.chapter_journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
