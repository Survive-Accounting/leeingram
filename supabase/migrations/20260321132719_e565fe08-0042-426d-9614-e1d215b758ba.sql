
-- Create the asset_events table
CREATE TABLE public.asset_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_name TEXT NOT NULL,
  teaching_asset_id UUID REFERENCES public.teaching_assets(id),
  chapter_id UUID,
  course_id UUID,
  event_type TEXT NOT NULL,
  section_name TEXT,
  seconds_spent INTEGER,
  lw_user_id TEXT,
  lw_email TEXT,
  lw_name TEXT,
  lw_course_id TEXT,
  lw_unit_id TEXT,
  is_lw_embed BOOLEAN NOT NULL DEFAULT false,
  is_preview_mode BOOLEAN NOT NULL DEFAULT false,
  referrer TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.asset_events ENABLE ROW LEVEL SECURITY;

-- Public insert (students fire these unauthenticated)
CREATE POLICY "Anyone can insert asset events"
  ON public.asset_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Authenticated select for admin
CREATE POLICY "Authenticated users can read asset events"
  ON public.asset_events
  FOR SELECT
  TO authenticated
  USING (true);

-- Indexes
CREATE INDEX idx_asset_events_asset_name ON public.asset_events (asset_name);
CREATE INDEX idx_asset_events_teaching_asset_id ON public.asset_events (teaching_asset_id);
CREATE INDEX idx_asset_events_event_type ON public.asset_events (event_type);
CREATE INDEX idx_asset_events_lw_email ON public.asset_events (lw_email);
CREATE INDEX idx_asset_events_created_at ON public.asset_events (created_at);
CREATE INDEX idx_asset_events_course_chapter ON public.asset_events (course_id, chapter_id);

-- Migrate existing data from asset_share_events
INSERT INTO public.asset_events (asset_name, teaching_asset_id, event_type, referrer, user_agent, created_at)
SELECT asset_name, teaching_asset_id, event_type, referrer, user_agent, created_at
FROM public.asset_share_events;
