
-- Add missing columns to existing campus_courses table
ALTER TABLE public.campus_courses
  ADD COLUMN IF NOT EXISTS local_course_code TEXT,
  ADD COLUMN IF NOT EXISTS local_course_name TEXT,
  ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;

-- Add indexes (skip if they already exist)
CREATE INDEX IF NOT EXISTS idx_campus_courses_campus ON public.campus_courses(campus_id);
CREATE INDEX IF NOT EXISTS idx_campus_courses_course ON public.campus_courses(course_id);
