
-- Create chapter_topics table
CREATE TABLE public.chapter_topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  topic_name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lw_items table
CREATE TABLE public.lw_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_problem_id UUID NOT NULL REFERENCES public.chapter_problems(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES public.chapter_topics(id) ON DELETE SET NULL,
  item_key TEXT NOT NULL DEFAULT '',
  item_label TEXT NOT NULL DEFAULT '',
  lw_type TEXT NOT NULL DEFAULT 'TMC',
  status TEXT NOT NULL DEFAULT 'drafted',
  include_in_bank BOOLEAN NOT NULL DEFAULT false,
  question_text TEXT NOT NULL DEFAULT '',
  answer_1 TEXT NOT NULL DEFAULT '',
  answer_2 TEXT NOT NULL DEFAULT '',
  answer_3 TEXT NOT NULL DEFAULT '',
  answer_4 TEXT NOT NULL DEFAULT '',
  answer_5 TEXT NOT NULL DEFAULT '',
  answer_6 TEXT NOT NULL DEFAULT '',
  answer_7 TEXT NOT NULL DEFAULT '',
  answer_8 TEXT NOT NULL DEFAULT '',
  answer_9 TEXT NOT NULL DEFAULT '',
  answer_10 TEXT NOT NULL DEFAULT '',
  correct_answer TEXT NOT NULL DEFAULT '',
  correct_explanation TEXT NOT NULL DEFAULT '',
  incorrect_explanation TEXT NOT NULL DEFAULT '',
  banked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS for chapter_topics
ALTER TABLE public.chapter_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read chapter_topics" ON public.chapter_topics FOR SELECT USING (true);
CREATE POLICY "Authenticated write chapter_topics" ON public.chapter_topics FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated update chapter_topics" ON public.chapter_topics FOR UPDATE USING (true);
CREATE POLICY "Authenticated delete chapter_topics" ON public.chapter_topics FOR DELETE USING (true);

-- RLS for lw_items
ALTER TABLE public.lw_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read lw_items" ON public.lw_items FOR SELECT USING (true);
CREATE POLICY "Authenticated write lw_items" ON public.lw_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated update lw_items" ON public.lw_items FOR UPDATE USING (true);
CREATE POLICY "Authenticated delete lw_items" ON public.lw_items FOR DELETE USING (true);
