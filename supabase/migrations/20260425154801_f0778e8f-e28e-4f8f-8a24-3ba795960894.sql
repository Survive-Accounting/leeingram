ALTER TABLE public.teaching_assets
  ADD COLUMN IF NOT EXISTS v2_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (v2_status IN ('draft','ready','embedded')),
  ADD COLUMN IF NOT EXISTS v2_embedded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_teaching_assets_v2_status ON public.teaching_assets(v2_status);