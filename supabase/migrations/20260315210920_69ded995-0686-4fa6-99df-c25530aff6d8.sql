
-- Phase 2 core asset selection fields
ALTER TABLE public.teaching_assets
  ADD COLUMN IF NOT EXISTS phase2_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS core_rank integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS whiteboard_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS mc_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS ebook_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS qa_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS admin_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS phase2_entered_at timestamptz DEFAULT NULL;

-- Note: deployment_status and video_production_status already exist on this table, skipping.

-- Index for phase2_status queries
CREATE INDEX IF NOT EXISTS idx_teaching_assets_phase2_status ON public.teaching_assets (phase2_status);
