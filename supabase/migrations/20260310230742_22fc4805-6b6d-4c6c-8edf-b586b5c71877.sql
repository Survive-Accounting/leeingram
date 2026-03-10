
CREATE TABLE public.va_completion_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  va_account_id UUID NOT NULL,
  user_id UUID NOT NULL,
  teaching_asset_id UUID REFERENCES public.teaching_assets(id) ON DELETE SET NULL,
  asset_name TEXT NOT NULL DEFAULT '',
  source_code TEXT NOT NULL DEFAULT '',
  course_code TEXT NOT NULL DEFAULT '',
  chapter_number INTEGER NOT NULL DEFAULT 0,
  completion_type TEXT NOT NULL DEFAULT 'sheets_created',
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.va_completion_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read va_completion_log" ON public.va_completion_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write va_completion_log" ON public.va_completion_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated delete va_completion_log" ON public.va_completion_log FOR DELETE TO authenticated USING (true);
