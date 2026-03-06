
-- Add pipeline tracking columns to teaching_assets
ALTER TABLE public.teaching_assets
  ADD COLUMN IF NOT EXISTS banked_generation_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS banked_review_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS csv_export_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS lw_import_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS video_production_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS deployment_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS lw_video_url text,
  ADD COLUMN IF NOT EXISTS lw_quiz_url text,
  ADD COLUMN IF NOT EXISTS lw_ebook_url text,
  ADD COLUMN IF NOT EXISTS asset_approved_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS banked_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS banked_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS csv_exported_at timestamptz,
  ADD COLUMN IF NOT EXISTS lw_imported_at timestamptz,
  ADD COLUMN IF NOT EXISTS video_ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS deployment_completed_at timestamptz;
