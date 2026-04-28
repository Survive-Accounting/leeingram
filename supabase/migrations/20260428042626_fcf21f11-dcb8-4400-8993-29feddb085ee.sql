-- ── student_onboarding table ────────────────────────────────────────
CREATE TABLE public.student_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  display_name text,
  campus_id uuid REFERENCES public.campuses(id),
  course_id uuid REFERENCES public.courses(id),
  syllabus_file_path text,
  is_accounting_major text CHECK (is_accounting_major IN ('yes','no','definitely_not')),
  is_in_greek_life boolean,
  greek_org_id uuid REFERENCES public.greek_orgs(id),
  greek_org_other text,
  confidence_1_10 int CHECK (confidence_1_10 BETWEEN 1 AND 10),
  is_legacy boolean NOT NULL DEFAULT false,
  beta_number int UNIQUE,
  campus_beta_number int,
  welcomed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campus_id, campus_beta_number)
);

CREATE INDEX idx_student_onboarding_user_id ON public.student_onboarding(user_id);
CREATE INDEX idx_student_onboarding_email   ON public.student_onboarding(email);
CREATE INDEX idx_student_onboarding_campus  ON public.student_onboarding(campus_id);

ALTER TABLE public.student_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "self read"
  ON public.student_onboarding FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "self insert"
  ON public.student_onboarding FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "self update"
  ON public.student_onboarding FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_student_onboarding_updated_at
  BEFORE UPDATE ON public.student_onboarding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Atomic beta-number claim function ───────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_beta_number(
  p_user_id uuid,
  p_campus_id uuid
)
RETURNS TABLE(beta_number int, campus_beta_number int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_global int;
  v_campus int;
  v_existing record;
BEGIN
  -- Idempotent: if already claimed, return existing
  SELECT s.beta_number, s.campus_beta_number INTO v_existing
  FROM public.student_onboarding s
  WHERE s.user_id = p_user_id;

  IF v_existing.beta_number IS NOT NULL THEN
    beta_number := v_existing.beta_number;
    campus_beta_number := v_existing.campus_beta_number;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Lock the table briefly to compute next numbers safely
  PERFORM pg_advisory_xact_lock(hashtext('claim_beta_number'));

  SELECT COALESCE(MAX(s.beta_number), 0) + 1 INTO v_global
  FROM public.student_onboarding s
  WHERE s.is_legacy = false;

  IF p_campus_id IS NOT NULL THEN
    SELECT COALESCE(MAX(s.campus_beta_number), 0) + 1 INTO v_campus
    FROM public.student_onboarding s
    WHERE s.is_legacy = false AND s.campus_id = p_campus_id;
  ELSE
    v_campus := NULL;
  END IF;

  UPDATE public.student_onboarding
     SET beta_number = v_global,
         campus_beta_number = v_campus
   WHERE user_id = p_user_id;

  beta_number := v_global;
  campus_beta_number := v_campus;
  RETURN NEXT;
END;
$$;

-- ── Storage policies for syllabus uploads ───────────────────────────
-- chapter-resources bucket is already public; add per-user write policy
CREATE POLICY "Users can upload their own syllabus"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chapter-resources'
    AND (storage.foldername(name))[1] = 'syllabi'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "Users can update their own syllabus"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'chapter-resources'
    AND (storage.foldername(name))[1] = 'syllabi'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );