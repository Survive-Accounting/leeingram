
-- Drop all existing public access policies
DROP POLICY IF EXISTS "Public access" ON public.courses;
DROP POLICY IF EXISTS "Public access" ON public.chapters;
DROP POLICY IF EXISTS "Public access" ON public.lessons;
DROP POLICY IF EXISTS "Public access" ON public.chapter_resources;
DROP POLICY IF EXISTS "Public access" ON public.lesson_plans;
DROP POLICY IF EXISTS "Public access" ON public.google_sheets;

-- Courses: authenticated read-only (seeded data), authenticated write
CREATE POLICY "Authenticated read courses" ON public.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write courses" ON public.courses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update courses" ON public.courses FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete courses" ON public.courses FOR DELETE TO authenticated USING (true);

-- Chapters: authenticated full access
CREATE POLICY "Authenticated read chapters" ON public.chapters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write chapters" ON public.chapters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update chapters" ON public.chapters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete chapters" ON public.chapters FOR DELETE TO authenticated USING (true);

-- Lessons: authenticated full access
CREATE POLICY "Authenticated read lessons" ON public.lessons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write lessons" ON public.lessons FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update lessons" ON public.lessons FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete lessons" ON public.lessons FOR DELETE TO authenticated USING (true);

-- Chapter resources: authenticated full access
CREATE POLICY "Authenticated read chapter_resources" ON public.chapter_resources FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write chapter_resources" ON public.chapter_resources FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update chapter_resources" ON public.chapter_resources FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete chapter_resources" ON public.chapter_resources FOR DELETE TO authenticated USING (true);

-- Lesson plans: authenticated full access
CREATE POLICY "Authenticated read lesson_plans" ON public.lesson_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write lesson_plans" ON public.lesson_plans FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update lesson_plans" ON public.lesson_plans FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete lesson_plans" ON public.lesson_plans FOR DELETE TO authenticated USING (true);

-- Google sheets: authenticated full access
CREATE POLICY "Authenticated read google_sheets" ON public.google_sheets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write google_sheets" ON public.google_sheets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update google_sheets" ON public.google_sheets FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete google_sheets" ON public.google_sheets FOR DELETE TO authenticated USING (true);

-- Storage: drop public policies and add authenticated ones
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Public upload access" ON storage.objects;
DROP POLICY IF EXISTS "Public delete access" ON storage.objects;

CREATE POLICY "Authenticated read storage" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'chapter-resources');
CREATE POLICY "Authenticated upload storage" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chapter-resources');
CREATE POLICY "Authenticated delete storage" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'chapter-resources');
