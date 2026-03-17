
-- Unified background jobs table
CREATE TABLE public.background_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX idx_background_jobs_status ON public.background_jobs (status) WHERE status = 'queued';
CREATE INDEX idx_background_jobs_batch ON public.background_jobs (batch_id);
CREATE INDEX idx_background_jobs_type_status ON public.background_jobs (job_type, status);

ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read background_jobs" ON public.background_jobs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert background_jobs" ON public.background_jobs
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update background_jobs" ON public.background_jobs
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete background_jobs" ON public.background_jobs
  FOR DELETE TO authenticated USING (true);

-- Drop old prep_doc_queue table
DROP TABLE IF EXISTS public.prep_doc_queue;
