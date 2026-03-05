
-- Add google sheet tracking columns to teaching_assets
ALTER TABLE public.teaching_assets
  ADD COLUMN IF NOT EXISTS google_sheet_file_id text,
  ADD COLUMN IF NOT EXISTS google_sheet_url text,
  ADD COLUMN IF NOT EXISTS sheet_template_version text,
  ADD COLUMN IF NOT EXISTS sheet_last_synced_at timestamptz;

-- Create sheet_templates table
CREATE TABLE public.sheet_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  template_file_id text NOT NULL,
  version text NOT NULL DEFAULT 'v1',
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sheet_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read sheet_templates" ON public.sheet_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write sheet_templates" ON public.sheet_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update sheet_templates" ON public.sheet_templates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete sheet_templates" ON public.sheet_templates FOR DELETE TO authenticated USING (true);
