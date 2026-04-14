
CREATE TABLE public.cram_tab_visibility (
  tab_name text PRIMARY KEY,
  is_visible boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.cram_tab_visibility (tab_name, is_visible) VALUES
  ('the_why', true),
  ('key_terms', true),
  ('accounts', true),
  ('journal_entries', true),
  ('formulas', true),
  ('exam_mistakes', true),
  ('memory', true);

ALTER TABLE public.cram_tab_visibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tab visibility"
  ON public.cram_tab_visibility
  FOR SELECT
  USING (true);
