
CREATE TABLE public.correction_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_problem_id UUID NOT NULL,
  chapter_id UUID NOT NULL,
  user_id UUID,
  before_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  diff_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  auto_tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  summary TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.correction_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read correction_events" ON public.correction_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write correction_events" ON public.correction_events FOR INSERT TO authenticated WITH CHECK (true);
