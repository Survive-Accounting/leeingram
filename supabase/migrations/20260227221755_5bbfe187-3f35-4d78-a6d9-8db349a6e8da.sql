
-- Add output_type to answer_packages
CREATE TYPE public.answer_output_type AS ENUM ('numeric_values', 'journal_entries', 'multiple_choice', 'mixed');

ALTER TABLE public.answer_packages ADD COLUMN output_type public.answer_output_type NOT NULL DEFAULT 'mixed';

-- Create account_aliases table
CREATE TABLE public.account_aliases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  preferred_display_name TEXT NOT NULL,
  course_short TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.account_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read account_aliases" ON public.account_aliases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write account_aliases" ON public.account_aliases FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update account_aliases" ON public.account_aliases FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete account_aliases" ON public.account_aliases FOR DELETE TO authenticated USING (true);
