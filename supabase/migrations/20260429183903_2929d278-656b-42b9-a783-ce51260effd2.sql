CREATE TABLE public.beta_feedback_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  date_range_start timestamptz NOT NULL,
  date_range_end timestamptz NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary_text text,
  categories jsonb,
  suggested_prompts jsonb,
  top_issues jsonb,
  top_features jsonb,
  top_chapters jsonb,
  quick_wins jsonb,
  feedback_count integer NOT NULL DEFAULT 0,
  model_used text,
  generated_by_user_id uuid
);

CREATE INDEX idx_beta_feedback_summaries_created_at
  ON public.beta_feedback_summaries(created_at DESC);

ALTER TABLE public.beta_feedback_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read beta feedback summaries"
  ON public.beta_feedback_summaries FOR SELECT TO authenticated
  USING ((( SELECT users.email FROM auth.users WHERE users.id = auth.uid()))::text
         = ANY (ARRAY['lee@surviveaccounting.com','admin@surviveaccounting.com','lee@survivestudios.com']));

CREATE POLICY "Admins can insert beta feedback summaries"
  ON public.beta_feedback_summaries FOR INSERT TO authenticated
  WITH CHECK ((( SELECT users.email FROM auth.users WHERE users.id = auth.uid()))::text
              = ANY (ARRAY['lee@surviveaccounting.com','admin@surviveaccounting.com','lee@survivestudios.com']));