
-- Create asset_flowcharts table
CREATE TABLE public.asset_flowcharts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teaching_asset_id UUID NOT NULL REFERENCES public.teaching_assets(id) ON DELETE CASCADE,
  instruction_number INTEGER NOT NULL DEFAULT 0,
  instruction_label TEXT,
  flowchart_image_url TEXT,
  flowchart_image_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by asset
CREATE INDEX idx_asset_flowcharts_asset_id ON public.asset_flowcharts(teaching_asset_id);

-- Unique constraint: one flowchart per instruction per asset
CREATE UNIQUE INDEX idx_asset_flowcharts_unique ON public.asset_flowcharts(teaching_asset_id, instruction_number);

-- Enable RLS
ALTER TABLE public.asset_flowcharts ENABLE ROW LEVEL SECURITY;

-- Public read access (same as other student-facing tables)
CREATE POLICY "Allow public read access on asset_flowcharts"
  ON public.asset_flowcharts
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Authenticated users can insert/update (edge functions use service role anyway)
CREATE POLICY "Allow authenticated insert on asset_flowcharts"
  ON public.asset_flowcharts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update on asset_flowcharts"
  ON public.asset_flowcharts
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
