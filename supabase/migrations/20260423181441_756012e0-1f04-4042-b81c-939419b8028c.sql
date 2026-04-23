CREATE TABLE IF NOT EXISTS public.survive_ai_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  tag text NOT NULL DEFAULT 'general',
  source_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT survive_ai_subscribers_email_tag_unique UNIQUE (email, tag)
);

ALTER TABLE public.survive_ai_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can subscribe"
  ON public.survive_ai_subscribers
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view subscribers"
  ON public.survive_ai_subscribers
  FOR SELECT
  USING (auth.uid() IS NOT NULL);