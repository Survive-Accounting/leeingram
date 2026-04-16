CREATE TABLE public.va_survey_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  location TEXT,
  background TEXT,
  outside_interest TEXT,
  ranked_interests JSONB NOT NULL DEFAULT '[]'::jsonb,
  focus_area_answer TEXT,
  unlisted_skills TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.va_survey_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own survey"
  ON public.va_survey_responses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own survey"
  ON public.va_survey_responses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all surveys"
  ON public.va_survey_responses FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT va.user_id FROM public.va_accounts va WHERE va.role = 'lead_va'
    )
    OR auth.jwt() ->> 'email' = 'lee@surviveaccounting.com'
  );