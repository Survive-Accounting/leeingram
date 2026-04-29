-- Allow anyone to SELECT explanation_feedback (so .insert().select().single() works for anon)
CREATE POLICY "Anyone can read explanation feedback"
ON public.explanation_feedback
FOR SELECT
USING (true);

-- Allow anyone to UPDATE explanation_feedback (so the optional follow-up reason can attach)
CREATE POLICY "Anyone can attach a reason"
ON public.explanation_feedback
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Ensure unique index for upsert on survive_ai_responses
CREATE UNIQUE INDEX IF NOT EXISTS survive_ai_responses_asset_prompt_uniq
ON public.survive_ai_responses (asset_id, prompt_type);

-- Missing RPC: atomically upsert + increment helpful_count
CREATE OR REPLACE FUNCTION public.increment_survive_helpful(
  p_asset_id uuid,
  p_prompt_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.survive_ai_responses (asset_id, prompt_type, helpful_count)
  VALUES (p_asset_id, p_prompt_type, 1)
  ON CONFLICT (asset_id, prompt_type)
  DO UPDATE SET helpful_count = COALESCE(public.survive_ai_responses.helpful_count, 0) + 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_survive_helpful(uuid, text) TO anon, authenticated;

-- Allow anon/authenticated to read survive_ai_responses helpful counts so the UI can hydrate them
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.survive_ai_responses'::regclass
      AND polname = 'Anyone can read survive ai response counts'
  ) THEN
    CREATE POLICY "Anyone can read survive ai response counts"
    ON public.survive_ai_responses
    FOR SELECT
    USING (true);
  END IF;
END $$;