CREATE TABLE public.ai_cost_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  operation_type TEXT NOT NULL,
  asset_code TEXT,
  topic_id UUID,
  chapter_id UUID,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated_cost_usd NUMERIC(10,6),
  image_count INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for dashboard queries
CREATE INDEX idx_ai_cost_log_created_at ON public.ai_cost_log (created_at DESC);
CREATE INDEX idx_ai_cost_log_operation_type ON public.ai_cost_log (operation_type);

-- Enable RLS
ALTER TABLE public.ai_cost_log ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read (for dashboard)
CREATE POLICY "Authenticated users can view cost logs"
ON public.ai_cost_log
FOR SELECT
TO authenticated
USING (true);

-- Service role inserts only (edge functions use service role key)
-- No INSERT policy for authenticated = only service role can insert