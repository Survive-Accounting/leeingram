
-- Chapter Batch Runs table
CREATE TABLE public.chapter_batch_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id),
  created_by_user_id uuid,
  status text NOT NULL DEFAULT 'draft',
  variant_count integer NOT NULL DEFAULT 1,
  provider text NOT NULL DEFAULT 'lovable',
  started_at timestamptz,
  ended_at timestamptz,
  total_sources integer NOT NULL DEFAULT 0,
  completed_sources integer NOT NULL DEFAULT 0,
  failed_sources integer NOT NULL DEFAULT 0,
  avg_seconds_per_source numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chapter_batch_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read chapter_batch_runs" ON public.chapter_batch_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write chapter_batch_runs" ON public.chapter_batch_runs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update chapter_batch_runs" ON public.chapter_batch_runs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete chapter_batch_runs" ON public.chapter_batch_runs FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_chapter_batch_runs_chapter ON public.chapter_batch_runs(chapter_id);
CREATE INDEX idx_chapter_batch_runs_course ON public.chapter_batch_runs(course_id);

-- Chapter Batch Run Items table
CREATE TABLE public.chapter_batch_run_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_run_id uuid NOT NULL REFERENCES public.chapter_batch_runs(id) ON DELETE CASCADE,
  source_problem_id uuid NOT NULL REFERENCES public.chapter_problems(id),
  seq integer NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_ms integer,
  created_variant_ids jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(batch_run_id, source_problem_id)
);

ALTER TABLE public.chapter_batch_run_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read chapter_batch_run_items" ON public.chapter_batch_run_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write chapter_batch_run_items" ON public.chapter_batch_run_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update chapter_batch_run_items" ON public.chapter_batch_run_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete chapter_batch_run_items" ON public.chapter_batch_run_items FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_batch_run_items_status ON public.chapter_batch_run_items(batch_run_id, status);
CREATE INDEX idx_batch_run_items_source ON public.chapter_batch_run_items(source_problem_id);
