
-- Create chapter_build_runs table
CREATE TABLE public.chapter_build_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  imported_source_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  import_count integer NOT NULL DEFAULT 0,
  approved_count integer NOT NULL DEFAULT 0,
  needs_fix_count integer NOT NULL DEFAULT 0,
  terminal_count integer NOT NULL DEFAULT 0,
  avg_seconds_per_terminal numeric,
  avg_seconds_per_approved numeric,
  total_seconds numeric,
  notes text
);

-- Indexes
CREATE INDEX idx_build_runs_chapter ON public.chapter_build_runs(chapter_id);
CREATE INDEX idx_build_runs_course ON public.chapter_build_runs(course_id);
CREATE INDEX idx_build_runs_status ON public.chapter_build_runs(chapter_id, status);

-- RLS
ALTER TABLE public.chapter_build_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read chapter_build_runs" ON public.chapter_build_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write chapter_build_runs" ON public.chapter_build_runs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update chapter_build_runs" ON public.chapter_build_runs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete chapter_build_runs" ON public.chapter_build_runs FOR DELETE TO authenticated USING (true);

-- Add build_run_id to chapter_problems
ALTER TABLE public.chapter_problems ADD COLUMN build_run_id uuid REFERENCES public.chapter_build_runs(id) ON DELETE SET NULL;
CREATE INDEX idx_chapter_problems_build_run ON public.chapter_problems(build_run_id);

-- Add reviewed_at to problem_variants
ALTER TABLE public.problem_variants ADD COLUMN reviewed_at timestamptz;
