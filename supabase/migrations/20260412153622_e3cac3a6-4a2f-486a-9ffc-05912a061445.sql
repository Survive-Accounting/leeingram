CREATE TABLE public.cram_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE CASCADE NOT NULL,
  content_type text NOT NULL,
  content_id text NOT NULL,
  session_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cram_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert cram feedback"
ON public.cram_feedback
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE INDEX idx_cram_feedback_chapter ON public.cram_feedback(chapter_id);
CREATE INDEX idx_cram_feedback_session ON public.cram_feedback(session_id);