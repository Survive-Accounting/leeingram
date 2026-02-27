
-- Create enums for activity_log
CREATE TYPE public.actor_type AS ENUM ('user', 'system', 'ai');
CREATE TYPE public.entity_type AS ENUM ('source_problem', 'lw_item', 'export_job', 'topic', 'chapter');
CREATE TYPE public.log_severity AS ENUM ('info', 'warn', 'error');
CREATE TYPE public.answer_generator AS ENUM ('ai', 'system', 'mixed');
CREATE TYPE public.answer_status AS ENUM ('drafted', 'needs_review', 'approved');

-- Create activity_log table
CREATE TABLE public.activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  actor_type public.actor_type NOT NULL DEFAULT 'system',
  actor_id UUID,
  entity_type public.entity_type NOT NULL,
  entity_id UUID NOT NULL,
  event_type TEXT NOT NULL DEFAULT '',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  severity public.log_severity NOT NULL DEFAULT 'info'
);

-- Create answer_packages table
CREATE TABLE public.answer_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_problem_id UUID NOT NULL REFERENCES public.chapter_problems(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  generator public.answer_generator NOT NULL DEFAULT 'ai',
  extracted_inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  answer_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  status public.answer_status NOT NULL DEFAULT 'drafted',
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE
);

-- RLS for activity_log
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read activity_log" ON public.activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write activity_log" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (true);

-- RLS for answer_packages
ALTER TABLE public.answer_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read answer_packages" ON public.answer_packages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write answer_packages" ON public.answer_packages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update answer_packages" ON public.answer_packages FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete answer_packages" ON public.answer_packages FOR DELETE TO authenticated USING (true);

-- Index for fast lookups
CREATE INDEX idx_activity_log_entity ON public.activity_log (entity_type, entity_id);
CREATE INDEX idx_activity_log_created ON public.activity_log (created_at DESC);
CREATE INDEX idx_answer_packages_source ON public.answer_packages (source_problem_id, version DESC);
