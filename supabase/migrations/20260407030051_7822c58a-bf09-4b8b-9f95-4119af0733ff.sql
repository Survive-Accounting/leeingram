
-- 1. chapter_key_terms
CREATE TABLE public.chapter_key_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  term text NOT NULL,
  definition text NOT NULL,
  sort_order integer DEFAULT 0,
  is_approved boolean DEFAULT false,
  is_rejected boolean DEFAULT false,
  generated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_chapter_key_terms_chapter_id ON public.chapter_key_terms(chapter_id);
ALTER TABLE public.chapter_key_terms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read chapter_key_terms" ON public.chapter_key_terms FOR SELECT USING (true);
CREATE POLICY "Auth insert chapter_key_terms" ON public.chapter_key_terms FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update chapter_key_terms" ON public.chapter_key_terms FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete chapter_key_terms" ON public.chapter_key_terms FOR DELETE TO authenticated USING (true);

-- 2. chapter_exam_mistakes
CREATE TABLE public.chapter_exam_mistakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  mistake text NOT NULL,
  explanation text,
  sort_order integer DEFAULT 0,
  is_approved boolean DEFAULT false,
  is_rejected boolean DEFAULT false,
  generated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_chapter_exam_mistakes_chapter_id ON public.chapter_exam_mistakes(chapter_id);
ALTER TABLE public.chapter_exam_mistakes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read chapter_exam_mistakes" ON public.chapter_exam_mistakes FOR SELECT USING (true);
CREATE POLICY "Auth insert chapter_exam_mistakes" ON public.chapter_exam_mistakes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update chapter_exam_mistakes" ON public.chapter_exam_mistakes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete chapter_exam_mistakes" ON public.chapter_exam_mistakes FOR DELETE TO authenticated USING (true);

-- 3. chapter_exam_checklist
CREATE TABLE public.chapter_exam_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  checklist_item text NOT NULL,
  sort_order integer DEFAULT 0,
  is_approved boolean DEFAULT false,
  is_rejected boolean DEFAULT false,
  generated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_chapter_exam_checklist_chapter_id ON public.chapter_exam_checklist(chapter_id);
ALTER TABLE public.chapter_exam_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read chapter_exam_checklist" ON public.chapter_exam_checklist FOR SELECT USING (true);
CREATE POLICY "Auth insert chapter_exam_checklist" ON public.chapter_exam_checklist FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update chapter_exam_checklist" ON public.chapter_exam_checklist FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete chapter_exam_checklist" ON public.chapter_exam_checklist FOR DELETE TO authenticated USING (true);

-- 4. chapter_purpose
CREATE TABLE public.chapter_purpose (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  purpose_text text NOT NULL,
  consequence_text text NOT NULL,
  is_approved boolean DEFAULT false,
  generated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (chapter_id)
);
CREATE INDEX idx_chapter_purpose_chapter_id ON public.chapter_purpose(chapter_id);
ALTER TABLE public.chapter_purpose ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read chapter_purpose" ON public.chapter_purpose FOR SELECT USING (true);
CREATE POLICY "Auth insert chapter_purpose" ON public.chapter_purpose FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update chapter_purpose" ON public.chapter_purpose FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete chapter_purpose" ON public.chapter_purpose FOR DELETE TO authenticated USING (true);

-- 5. Alter existing chapter_accounts to match new spec
ALTER TABLE public.chapter_accounts
  ADD COLUMN IF NOT EXISTS account_description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_rejected boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.chapter_accounts
  DROP COLUMN IF EXISTS credit_effect,
  DROP COLUMN IF EXISTS debit_effect,
  DROP COLUMN IF EXISTS source;

CREATE INDEX IF NOT EXISTS idx_chapter_accounts_chapter_id ON public.chapter_accounts(chapter_id);
