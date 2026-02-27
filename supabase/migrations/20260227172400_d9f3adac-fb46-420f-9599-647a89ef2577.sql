ALTER TABLE public.teaching_assets
ADD COLUMN IF NOT EXISTS last_tutored_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS times_used integer NOT NULL DEFAULT 0;