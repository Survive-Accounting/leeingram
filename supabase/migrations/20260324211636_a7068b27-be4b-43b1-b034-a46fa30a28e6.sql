-- Public SELECT on topic_quiz_questions for quiz explanation iframe
CREATE POLICY "Public read topic_quiz_questions" ON public.topic_quiz_questions
  FOR SELECT TO anon USING (true);

-- Public SELECT on chapter_topics for quiz explanation page
CREATE POLICY "Public read chapter_topics" ON public.chapter_topics
  FOR SELECT TO anon USING (true);

-- Public SELECT on teaching_assets for quiz explanation page
CREATE POLICY "Public read teaching_assets" ON public.teaching_assets
  FOR SELECT TO anon USING (true);