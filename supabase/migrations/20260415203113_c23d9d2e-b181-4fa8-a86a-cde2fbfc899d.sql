
-- Create sharing_warnings table
CREATE TABLE public.sharing_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  warning_type TEXT NOT NULL,
  warning_level TEXT NOT NULL DEFAULT 'low',
  details JSONB,
  is_reviewed BOOLEAN DEFAULT false,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  action_taken TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sharing_warnings_student ON public.sharing_warnings(student_id);
CREATE INDEX idx_sharing_warnings_unreviewed ON public.sharing_warnings(is_reviewed) WHERE is_reviewed = false;

-- Enable RLS
ALTER TABLE public.sharing_warnings ENABLE ROW LEVEL SECURITY;

-- Admin-only access (no anon access)
CREATE POLICY "Authenticated users can read sharing_warnings"
  ON public.sharing_warnings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert sharing_warnings"
  ON public.sharing_warnings FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update sharing_warnings"
  ON public.sharing_warnings FOR UPDATE TO authenticated USING (true);

-- Trigger function to auto-create warnings when device is flagged
CREATE OR REPLACE FUNCTION public.create_sharing_warning()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_flagged = true AND (OLD.is_flagged IS NULL OR OLD.is_flagged = false) THEN
    INSERT INTO sharing_warnings (student_id, email, warning_type, warning_level, details)
    VALUES (
      NEW.student_id,
      NEW.email,
      'device_limit',
      CASE
        WHEN (SELECT COUNT(*) FROM student_devices WHERE student_id = NEW.student_id AND is_active = true) >= 10 THEN 'high'
        WHEN (SELECT COUNT(*) FROM student_devices WHERE student_id = NEW.student_id AND is_active = true) >= 7 THEN 'medium'
        ELSE 'low'
      END,
      jsonb_build_object(
        'device_count', (SELECT COUNT(*) FROM student_devices WHERE student_id = NEW.student_id AND is_active = true),
        'flag_reason', NEW.flag_reason
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger to student_devices
CREATE TRIGGER trigger_sharing_warning
AFTER UPDATE ON public.student_devices
FOR EACH ROW
EXECUTE FUNCTION public.create_sharing_warning();
