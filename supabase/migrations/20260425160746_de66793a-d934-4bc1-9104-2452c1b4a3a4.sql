CREATE TABLE public.explanation_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL,
  asset_name TEXT,
  user_email TEXT,
  helpful BOOLEAN NOT NULL,
  reason TEXT,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_explanation_feedback_asset_id ON public.explanation_feedback(asset_id);
CREATE INDEX idx_explanation_feedback_created_at ON public.explanation_feedback(created_at DESC);

ALTER TABLE public.explanation_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit explanation feedback"
ON public.explanation_feedback
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role can read all feedback"
ON public.explanation_feedback
FOR SELECT
USING (false);
