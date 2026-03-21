
CREATE TABLE public.asset_share_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_name text NOT NULL,
  teaching_asset_id uuid REFERENCES public.teaching_assets(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  referrer text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_share_events ENABLE ROW LEVEL SECURITY;

-- Public insert (students, no auth)
CREATE POLICY "Anyone can insert share events"
  ON public.asset_share_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Authenticated select (admin)
CREATE POLICY "Authenticated users can read share events"
  ON public.asset_share_events
  FOR SELECT
  TO authenticated
  USING (true);
