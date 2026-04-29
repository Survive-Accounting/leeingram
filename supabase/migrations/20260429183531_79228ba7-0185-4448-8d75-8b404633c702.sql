CREATE TABLE public.feedback_inbox_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'new',
  copied_at timestamptz,
  reviewed_at timestamptz,
  fixed_at timestamptz,
  archived_at timestamptz,
  notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feedback_inbox_status_unique UNIQUE (source_table, source_id),
  CONSTRAINT feedback_inbox_status_check CHECK (status IN ('new','reviewing','copied_to_lovable','fixed','wont_fix','needs_more_info','archived'))
);

CREATE INDEX idx_feedback_inbox_status_status ON public.feedback_inbox_status(status);
CREATE INDEX idx_feedback_inbox_status_source ON public.feedback_inbox_status(source_table, source_id);

ALTER TABLE public.feedback_inbox_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read feedback status"
  ON public.feedback_inbox_status FOR SELECT TO authenticated
  USING ((( SELECT users.email FROM auth.users WHERE users.id = auth.uid()))::text = ANY (ARRAY['lee@surviveaccounting.com','admin@surviveaccounting.com']));

CREATE POLICY "Admins can insert feedback status"
  ON public.feedback_inbox_status FOR INSERT TO authenticated
  WITH CHECK ((( SELECT users.email FROM auth.users WHERE users.id = auth.uid()))::text = ANY (ARRAY['lee@surviveaccounting.com','admin@surviveaccounting.com']));

CREATE POLICY "Admins can update feedback status"
  ON public.feedback_inbox_status FOR UPDATE TO authenticated
  USING ((( SELECT users.email FROM auth.users WHERE users.id = auth.uid()))::text = ANY (ARRAY['lee@surviveaccounting.com','admin@surviveaccounting.com']));

CREATE TRIGGER trg_feedback_inbox_status_updated_at
  BEFORE UPDATE ON public.feedback_inbox_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();