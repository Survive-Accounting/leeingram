
-- Add target_semester to vlog_seasons (now "series")
ALTER TABLE public.vlog_seasons ADD COLUMN target_semester text DEFAULT '';

-- Add series_id to roadmap_items to link content to series
ALTER TABLE public.roadmap_items ADD COLUMN series_id uuid REFERENCES public.vlog_seasons(id) ON DELETE SET NULL;

-- Add content_tags to roadmap_items for Blog Post/Video/Monetizable tags
ALTER TABLE public.roadmap_items ADD COLUMN content_tags text[] DEFAULT '{}';
