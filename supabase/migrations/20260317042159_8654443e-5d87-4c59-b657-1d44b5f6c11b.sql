
-- Create flashcard_decks table
CREATE TABLE public.flashcard_decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  course_id uuid REFERENCES public.courses(id),
  chapter_id uuid REFERENCES public.chapters(id),
  chapter_number integer,
  course_code text,
  status text DEFAULT 'draft',
  total_cards integer DEFAULT 0,
  plays integer DEFAULT 0,
  completions integer DEFAULT 0
);

-- Create flashcards table
CREATE TABLE public.flashcards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  deck_id uuid REFERENCES public.flashcard_decks(id) ON DELETE CASCADE,
  card_type text NOT NULL,
  front text NOT NULL,
  back text NOT NULL,
  source_asset_id uuid REFERENCES public.teaching_assets(id),
  sort_order integer DEFAULT 0,
  deleted boolean DEFAULT false
);

-- Enable RLS
ALTER TABLE public.flashcard_decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

-- Authenticated full access on flashcard_decks
CREATE POLICY "Authenticated full select flashcard_decks" ON public.flashcard_decks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert flashcard_decks" ON public.flashcard_decks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update flashcard_decks" ON public.flashcard_decks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete flashcard_decks" ON public.flashcard_decks FOR DELETE TO authenticated USING (true);

-- Authenticated full access on flashcards
CREATE POLICY "Authenticated full select flashcards" ON public.flashcards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert flashcards" ON public.flashcards FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update flashcards" ON public.flashcards FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete flashcards" ON public.flashcards FOR DELETE TO authenticated USING (true);

-- Public read access for published decks
CREATE POLICY "Public read published flashcard_decks" ON public.flashcard_decks FOR SELECT TO anon USING (status = 'published');
CREATE POLICY "Public read published flashcards" ON public.flashcards FOR SELECT TO anon USING (
  EXISTS (SELECT 1 FROM public.flashcard_decks WHERE id = flashcards.deck_id AND status = 'published')
);
