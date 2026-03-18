CREATE TABLE IF NOT EXISTS public.asset_issue_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  teaching_asset_id uuid REFERENCES public.teaching_assets(id),
  asset_name text,
  reporter_email text,
  message text NOT NULL,
  status text DEFAULT 'open'
);

ALTER TABLE public.asset_issue_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert issue reports"
  ON public.asset_issue_reports FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read issue reports"
  ON public.asset_issue_reports FOR SELECT
  TO authenticated
  USING (true);