CREATE TABLE public.chapter_account_whitelist (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  account_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(chapter_id, account_name)
);

ALTER TABLE public.chapter_account_whitelist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read chapter_account_whitelist" ON public.chapter_account_whitelist FOR SELECT USING (true);
CREATE POLICY "Authenticated write chapter_account_whitelist" ON public.chapter_account_whitelist FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated delete chapter_account_whitelist" ON public.chapter_account_whitelist FOR DELETE USING (true);