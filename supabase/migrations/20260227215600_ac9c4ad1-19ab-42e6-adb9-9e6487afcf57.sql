
-- Enums
CREATE TYPE public.repair_note_type AS ENUM ('math_fix', 'format_fix', 'wording_fix', 'missing_step', 'wrong_topic', 'other');
CREATE TYPE public.repair_note_status AS ENUM ('open', 'resolved');
CREATE TYPE public.generation_job_type AS ENUM ('generate', 'regenerate_with_repair_note');
CREATE TYPE public.generation_job_status AS ENUM ('queued', 'running', 'done', 'failed');

-- repair_notes
CREATE TABLE public.repair_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_problem_id UUID NOT NULL REFERENCES public.chapter_problems(id) ON DELETE CASCADE,
  answer_package_id UUID NOT NULL REFERENCES public.answer_packages(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  note_type public.repair_note_type NOT NULL DEFAULT 'other',
  what_was_wrong TEXT NOT NULL DEFAULT '',
  desired_fix TEXT NOT NULL DEFAULT '',
  do_not_change TEXT,
  status public.repair_note_status NOT NULL DEFAULT 'open',
  resolved_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.repair_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read repair_notes" ON public.repair_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write repair_notes" ON public.repair_notes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update repair_notes" ON public.repair_notes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete repair_notes" ON public.repair_notes FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_repair_notes_source ON public.repair_notes (source_problem_id, status);

-- generation_jobs
CREATE TABLE public.generation_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_problem_id UUID NOT NULL REFERENCES public.chapter_problems(id) ON DELETE CASCADE,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  requested_by UUID,
  job_type public.generation_job_type NOT NULL DEFAULT 'generate',
  input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.generation_job_status NOT NULL DEFAULT 'queued',
  error TEXT NOT NULL DEFAULT '',
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read generation_jobs" ON public.generation_jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write generation_jobs" ON public.generation_jobs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update generation_jobs" ON public.generation_jobs FOR UPDATE TO authenticated USING (true);

CREATE INDEX idx_generation_jobs_source ON public.generation_jobs (source_problem_id, status);
