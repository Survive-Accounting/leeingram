
CREATE TABLE public.export_set_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  export_set_id uuid NOT NULL REFERENCES public.export_sets(id) ON DELETE CASCADE,
  banked_question_id uuid NOT NULL REFERENCES public.banked_questions(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_export_set_questions_set_id ON public.export_set_questions (export_set_id);
CREATE INDEX idx_export_set_questions_question_id ON public.export_set_questions (banked_question_id);

ALTER TABLE public.export_set_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read export_set_questions" ON public.export_set_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write export_set_questions" ON public.export_set_questions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update export_set_questions" ON public.export_set_questions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete export_set_questions" ON public.export_set_questions FOR DELETE TO authenticated USING (true);
