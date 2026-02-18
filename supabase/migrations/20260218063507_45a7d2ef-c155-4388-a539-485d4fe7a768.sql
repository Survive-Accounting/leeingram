-- Add domain column to roadmap_items for per-domain filtering
ALTER TABLE public.roadmap_items ADD COLUMN domain text NOT NULL DEFAULT 'general';
