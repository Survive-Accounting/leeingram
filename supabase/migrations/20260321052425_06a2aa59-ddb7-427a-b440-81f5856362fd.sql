
CREATE TABLE public.bulk_fix_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  operation_name TEXT NOT NULL,
  operation_key TEXT NOT NULL,
  queue_position INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  assets_processed INT NOT NULL DEFAULT 0,
  assets_succeeded INT NOT NULL DEFAULT 0,
  assets_errored INT NOT NULL DEFAULT 0,
  assets_skipped INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bulk_fix_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read bulk_fix_queue"
  ON public.bulk_fix_queue FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert bulk_fix_queue"
  ON public.bulk_fix_queue FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update bulk_fix_queue"
  ON public.bulk_fix_queue FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete bulk_fix_queue"
  ON public.bulk_fix_queue FOR DELETE TO authenticated USING (true);
