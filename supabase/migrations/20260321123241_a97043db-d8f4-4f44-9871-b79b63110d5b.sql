ALTER TABLE public.bulk_fix_queue 
ADD COLUMN IF NOT EXISTS scope_course_id uuid REFERENCES public.courses(id),
ADD COLUMN IF NOT EXISTS scope_chapter_id uuid REFERENCES public.chapters(id),
ADD COLUMN IF NOT EXISTS scope_status_filter text NOT NULL DEFAULT 'approved';