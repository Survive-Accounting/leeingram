
-- Drop old simpler table and create richer chapter_accounts
DROP TABLE IF EXISTS public.chapter_account_whitelist;

CREATE TABLE public.chapter_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  account_name text NOT NULL,
  account_type text,
  is_approved boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'ocr_suggested', 'ai_suggested')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(chapter_id, account_name)
);

ALTER TABLE public.chapter_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read chapter_accounts" ON public.chapter_accounts FOR SELECT USING (true);
CREATE POLICY "Authenticated write chapter_accounts" ON public.chapter_accounts FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated update chapter_accounts" ON public.chapter_accounts FOR UPDATE USING (true);
CREATE POLICY "Authenticated delete chapter_accounts" ON public.chapter_accounts FOR DELETE USING (true);
