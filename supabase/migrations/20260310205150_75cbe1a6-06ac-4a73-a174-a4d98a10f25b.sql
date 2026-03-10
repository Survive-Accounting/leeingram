
CREATE TABLE public.sheet_prep_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teaching_asset_id uuid NOT NULL REFERENCES public.teaching_assets(id) ON DELETE CASCADE,
  va_account_id uuid REFERENCES public.va_accounts(id) ON DELETE SET NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed boolean NOT NULL DEFAULT false,
  reviewed_at timestamptz,
  notes text DEFAULT ''
);

ALTER TABLE public.sheet_prep_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read sheet_prep_log" ON public.sheet_prep_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write sheet_prep_log" ON public.sheet_prep_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update sheet_prep_log" ON public.sheet_prep_log FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete sheet_prep_log" ON public.sheet_prep_log FOR DELETE TO authenticated USING (true);
