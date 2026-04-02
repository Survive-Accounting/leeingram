
-- Create chapter_formulas table
CREATE TABLE public.chapter_formulas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  formula_name text NOT NULL,
  formula_expression text NOT NULL,
  formula_explanation text,
  image_url text,
  is_approved boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for chapter lookups
CREATE INDEX idx_chapter_formulas_chapter_id ON public.chapter_formulas(chapter_id);

-- Enable RLS
ALTER TABLE public.chapter_formulas ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Anyone can view chapter formulas"
  ON public.chapter_formulas FOR SELECT
  USING (true);

-- Authenticated write
CREATE POLICY "Authenticated users can insert chapter formulas"
  ON public.chapter_formulas FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update chapter formulas"
  ON public.chapter_formulas FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete chapter formulas"
  ON public.chapter_formulas FOR DELETE
  TO authenticated
  USING (true);

-- Auto-update updated_at
CREATE TRIGGER update_chapter_formulas_updated_at
  BEFORE UPDATE ON public.chapter_formulas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
