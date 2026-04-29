-- AI generation cache: shared tutor responses
CREATE TABLE public.ai_generation_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  course_id UUID,
  chapter_id UUID,
  problem_id UUID,
  tool_type TEXT NOT NULL,
  action_type TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  model_version TEXT NOT NULL,
  problem_version TEXT,
  solution_version TEXT,
  response_text TEXT,
  response_json JSONB,
  status TEXT NOT NULL CHECK (status IN ('pending','completed','failed')),
  error_message TEXT,
  flagged BOOLEAN NOT NULL DEFAULT false,
  prompt_tokens INT,
  completion_tokens INT,
  total_tokens INT,
  latency_ms INT,
  generated_by_user_id UUID,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_cache_problem_action ON public.ai_generation_cache (problem_id, action_type);
CREATE INDEX idx_ai_cache_status_created ON public.ai_generation_cache (status, created_at);
CREATE INDEX idx_ai_cache_chapter ON public.ai_generation_cache (chapter_id);

ALTER TABLE public.ai_generation_cache ENABLE ROW LEVEL SECURITY;

-- Public can read completed responses (so cached tutor answers load fast for all visitors)
CREATE POLICY "Public can read completed ai cache"
  ON public.ai_generation_cache
  FOR SELECT
  USING (status = 'completed');

-- (Writes are server-only via service role; no insert/update/delete policies for clients.)

CREATE TRIGGER trg_ai_generation_cache_updated_at
BEFORE UPDATE ON public.ai_generation_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- AI request log: every call (cache hit or miss) for cost/perf analysis
CREATE TABLE public.ai_request_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT,
  cache_hit BOOLEAN NOT NULL,
  tool_type TEXT,
  action_type TEXT,
  model_used TEXT,
  reasoning_effort TEXT,
  prompt_tokens INT,
  completion_tokens INT,
  total_tokens INT,
  latency_ms INT,
  user_id UUID,
  session_id TEXT,
  problem_id UUID,
  chapter_id UUID,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_log_created ON public.ai_request_log (created_at DESC);
CREATE INDEX idx_ai_log_problem ON public.ai_request_log (problem_id);

ALTER TABLE public.ai_request_log ENABLE ROW LEVEL SECURITY;

-- Admin-only read; writes are server-only via service role.
-- Reuses the existing whitelisted-admin pattern via profiles.email check.
CREATE POLICY "Admins can read ai request log"
  ON public.ai_request_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND lower(p.email) IN (
          'lee@surviveaccounting.com',
          'leeingramaccountingtutor@gmail.com'
        )
    )
  );