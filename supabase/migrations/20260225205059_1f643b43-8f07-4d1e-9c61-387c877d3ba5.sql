
-- Variant feedback table for rejected variants
CREATE TABLE public.variant_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_problem_id UUID NOT NULL REFERENCES public.chapter_problems(id) ON DELETE CASCADE,
  variant_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  rejection_reason TEXT NOT NULL,
  free_text_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.variant_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read variant_feedback" ON public.variant_feedback FOR SELECT USING (true);
CREATE POLICY "Authenticated write variant_feedback" ON public.variant_feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated delete variant_feedback" ON public.variant_feedback FOR DELETE USING (true);

-- Company names library
CREATE TABLE public.company_names (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  style TEXT NOT NULL DEFAULT 'realistic' CHECK (style IN ('realistic', 'playful')),
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.company_names ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read company_names" ON public.company_names FOR SELECT USING (true);
CREATE POLICY "Authenticated write company_names" ON public.company_names FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated update company_names" ON public.company_names FOR UPDATE USING (true);
CREATE POLICY "Authenticated delete company_names" ON public.company_names FOR DELETE USING (true);

-- Seed some starter company names
INSERT INTO public.company_names (name, style, notes) VALUES
  ('Maple Ridge Industries', 'realistic', 'Manufacturing/general'),
  ('Summit Financial Group', 'realistic', 'Financial services'),
  ('Coastal Supply Co.', 'realistic', 'Retail/distribution'),
  ('Horizon Technologies Inc.', 'realistic', 'Tech company'),
  ('Riverstone Construction', 'realistic', 'Construction'),
  ('Pacific Trading Partners', 'realistic', 'Import/export'),
  ('Golden Harvest Foods', 'realistic', 'Food/agriculture'),
  ('Atlas Equipment Leasing', 'realistic', 'Equipment leasing'),
  ('Snack Attack Ltd.', 'playful', 'Fun food company'),
  ('Paws & Claws Pet Resort', 'playful', 'Pet services'),
  ('Blast Off Rockets Inc.', 'playful', 'Novelty/humor'),
  ('Unicorn Enterprises', 'playful', 'Fantasy-themed');
