
-- Prep doc queue for server-side batch processing
CREATE TABLE public.prep_doc_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL DEFAULT gen_random_uuid(),
  teaching_asset_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

-- Index for fast queue pickup
CREATE INDEX idx_prep_doc_queue_status ON public.prep_doc_queue (status) WHERE status = 'queued';
CREATE INDEX idx_prep_doc_queue_batch ON public.prep_doc_queue (batch_id);

-- RLS
ALTER TABLE public.prep_doc_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read prep_doc_queue" ON public.prep_doc_queue
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated insert prep_doc_queue" ON public.prep_doc_queue
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated update prep_doc_queue" ON public.prep_doc_queue
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated delete prep_doc_queue" ON public.prep_doc_queue
  FOR DELETE TO authenticated USING (true);
