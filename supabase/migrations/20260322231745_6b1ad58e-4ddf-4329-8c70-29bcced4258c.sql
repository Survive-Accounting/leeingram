
CREATE TABLE public.topic_quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.chapter_topics(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  question_number int NOT NULL DEFAULT 1,
  question_type text NOT NULL DEFAULT 'mc',
  question_text text NOT NULL DEFAULT '',
  correct_answer text NOT NULL DEFAULT '',
  explanation_correct text NOT NULL DEFAULT '',
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  explanation_a text,
  explanation_b text,
  explanation_c text,
  explanation_d text,
  je_accounts jsonb,
  je_description text,
  review_status text NOT NULL DEFAULT 'pending',
  lee_notes text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.topic_quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read topic_quiz_questions"
  ON public.topic_quiz_questions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert topic_quiz_questions"
  ON public.topic_quiz_questions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update topic_quiz_questions"
  ON public.topic_quiz_questions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete topic_quiz_questions"
  ON public.topic_quiz_questions FOR DELETE TO authenticated USING (true);
