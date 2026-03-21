ALTER TABLE public.chapter_topics 
ADD COLUMN IF NOT EXISTS original_asset_codes text[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_supplementary boolean NOT NULL DEFAULT false;