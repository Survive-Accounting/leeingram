
-- Create lesson_status enum
CREATE TYPE public.lesson_status AS ENUM ('Planning', 'Sheet Generated', 'Filming', 'Editing', 'Published');

-- Create file_type enum
CREATE TYPE public.file_type AS ENUM ('textbook', 'solutions', 'tutoring', 'transcript', 'other');

-- Courses table
CREATE TABLE public.courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Chapters table
CREATE TABLE public.chapters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  chapter_name TEXT NOT NULL,
  chapter_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Lessons table
CREATE TABLE public.lessons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  lesson_title TEXT NOT NULL,
  lesson_status public.lesson_status NOT NULL DEFAULT 'Planning',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Chapter Resources table
CREATE TABLE public.chapter_resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type public.file_type NOT NULL DEFAULT 'other',
  file_url TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Lesson Plans table
CREATE TABLE public.lesson_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  questionnaire_answers JSONB NOT NULL DEFAULT '{}',
  generated_lesson_plan TEXT,
  generated_problem_list TEXT,
  generated_video_outline TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Google Sheets table
CREATE TABLE public.google_sheets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  sheet_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables (public access, no auth)
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapter_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_sheets ENABLE ROW LEVEL SECURITY;

-- Public read/write policies (no auth needed - internal tool)
CREATE POLICY "Public access" ON public.courses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON public.chapters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON public.lessons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON public.chapter_resources FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON public.lesson_plans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON public.google_sheets FOR ALL USING (true) WITH CHECK (true);

-- Create storage bucket for chapter resources
INSERT INTO storage.buckets (id, name, public) VALUES ('chapter-resources', 'chapter-resources', true);

CREATE POLICY "Public read access" ON storage.objects FOR SELECT USING (bucket_id = 'chapter-resources');
CREATE POLICY "Public upload access" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chapter-resources');
CREATE POLICY "Public delete access" ON storage.objects FOR DELETE USING (bucket_id = 'chapter-resources');

-- Create indexes
CREATE INDEX idx_chapters_course_id ON public.chapters(course_id);
CREATE INDEX idx_lessons_chapter_id ON public.lessons(chapter_id);
CREATE INDEX idx_lessons_course_id ON public.lessons(course_id);
CREATE INDEX idx_chapter_resources_chapter_id ON public.chapter_resources(chapter_id);
CREATE INDEX idx_lesson_plans_lesson_id ON public.lesson_plans(lesson_id);
CREATE INDEX idx_google_sheets_lesson_id ON public.google_sheets(lesson_id);
