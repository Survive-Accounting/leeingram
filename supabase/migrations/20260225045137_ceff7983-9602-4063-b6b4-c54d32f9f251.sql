
ALTER TABLE public.chapter_problems 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'raw';
