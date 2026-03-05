
-- 1. Add description column to existing courses table
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';

-- 2. Add unique constraint on courses.code (remove blanks first)
UPDATE public.courses SET code = slug WHERE code = '' OR code IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_code ON public.courses (code);

-- 3. Create textbooks table
CREATE TABLE public.textbooks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  edition text NOT NULL DEFAULT '',
  isbn text NOT NULL DEFAULT '',
  publisher text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_textbooks_isbn ON public.textbooks (isbn);

ALTER TABLE public.textbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read textbooks" ON public.textbooks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write textbooks" ON public.textbooks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update textbooks" ON public.textbooks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete textbooks" ON public.textbooks FOR DELETE TO authenticated USING (true);

-- 4. Create course_textbooks join table
CREATE TABLE public.course_textbooks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  textbook_id uuid NOT NULL REFERENCES public.textbooks(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (course_id, textbook_id)
);

CREATE INDEX idx_course_textbooks_course_id ON public.course_textbooks (course_id);

ALTER TABLE public.course_textbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read course_textbooks" ON public.course_textbooks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write course_textbooks" ON public.course_textbooks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update course_textbooks" ON public.course_textbooks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete course_textbooks" ON public.course_textbooks FOR DELETE TO authenticated USING (true);
