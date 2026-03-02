
-- generation_runs: one row per Generate click
CREATE TABLE public.generation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  course_id uuid,
  chapter_id uuid,
  source_problem_id uuid,
  variant_id uuid,
  provider text NOT NULL DEFAULT '',
  model text,
  status text NOT NULL DEFAULT 'started',
  duration_ms integer,
  error_summary text,
  debug_bundle_json jsonb
);

-- generation_events: ordered events per run
CREATE TABLE public.generation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  run_id uuid NOT NULL REFERENCES public.generation_runs(id) ON DELETE CASCADE,
  seq integer NOT NULL DEFAULT 0,
  scope text NOT NULL DEFAULT 'frontend',
  level text NOT NULL DEFAULT 'info',
  event_type text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  payload_json jsonb
);

-- Indexes
CREATE INDEX idx_generation_events_run_seq ON public.generation_events(run_id, seq);
CREATE INDEX idx_generation_runs_source_problem ON public.generation_runs(source_problem_id, created_at DESC);

-- RLS
ALTER TABLE public.generation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read generation_runs" ON public.generation_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write generation_runs" ON public.generation_runs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update generation_runs" ON public.generation_runs FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated read generation_events" ON public.generation_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write generation_events" ON public.generation_events FOR INSERT TO authenticated WITH CHECK (true);
