
CREATE TABLE public.topic_video_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  topic_id UUID NOT NULL REFERENCES public.chapter_topics(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent TEXT
);

ALTER TABLE public.topic_video_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert video requests"
  ON public.topic_video_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can read video requests"
  ON public.topic_video_requests
  FOR SELECT
  TO anon, authenticated
  USING (true);
