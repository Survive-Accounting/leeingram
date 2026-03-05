
-- Create question type enum
CREATE TYPE public.banked_question_type AS ENUM (
  'JE_MC', 'CALC_MC', 'CONCEPT_MC', 'TRUE_FALSE', 'TRAP', 'RELEVANT_INFO', 'IRRELEVANT_INFO'
);

-- Create review status enum
CREATE TYPE public.question_review_status AS ENUM ('pending', 'approved', 'rejected');

-- Create banked_questions table
CREATE TABLE public.banked_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  question_type public.banked_question_type NOT NULL,
  question_text text NOT NULL DEFAULT '',
  answer_a text NOT NULL DEFAULT '',
  answer_b text NOT NULL DEFAULT '',
  answer_c text NOT NULL DEFAULT '',
  answer_d text NOT NULL DEFAULT '',
  answer_e text NOT NULL DEFAULT '',
  correct_answer text NOT NULL DEFAULT '',
  short_explanation text NOT NULL DEFAULT '',
  difficulty integer NOT NULL DEFAULT 5,
  ai_confidence_score integer NOT NULL DEFAULT 0,
  rating integer,
  review_status public.question_review_status NOT NULL DEFAULT 'pending',
  rejection_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bq_difficulty_range CHECK (difficulty >= 1 AND difficulty <= 10),
  CONSTRAINT bq_confidence_range CHECK (ai_confidence_score >= 0 AND ai_confidence_score <= 100)
);

-- Indexes
CREATE INDEX idx_banked_questions_asset_id ON public.banked_questions (asset_id);
CREATE INDEX idx_banked_questions_question_type ON public.banked_questions (question_type);
CREATE INDEX idx_banked_questions_review_status ON public.banked_questions (review_status);

-- RLS
ALTER TABLE public.banked_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read banked_questions" ON public.banked_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write banked_questions" ON public.banked_questions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update banked_questions" ON public.banked_questions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete banked_questions" ON public.banked_questions FOR DELETE TO authenticated USING (true);
