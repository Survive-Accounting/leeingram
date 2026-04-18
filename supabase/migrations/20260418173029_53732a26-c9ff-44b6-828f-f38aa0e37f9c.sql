-- 1. founding_student flag on student_emails
ALTER TABLE public.student_emails
  ADD COLUMN IF NOT EXISTS founding_student boolean NOT NULL DEFAULT false;

-- 2. mascot_cheer on campuses
ALTER TABLE public.campuses
  ADD COLUMN IF NOT EXISTS mascot_cheer text;

UPDATE public.campuses
  SET mascot_cheer = 'Hotty Toddy!'
  WHERE slug = 'ole-miss' AND (mascot_cheer IS NULL OR mascot_cheer = '');

-- 3. Aggregate count RPCs (SECURITY DEFINER so anon can call without exposing rows)
CREATE OR REPLACE FUNCTION public.get_paid_student_count_for_campus(p_campus_slug text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT sp.email)::int
  FROM public.student_purchases sp
  JOIN public.campuses c ON c.id = sp.campus_id
  WHERE c.slug = p_campus_slug;
$$;

CREATE OR REPLACE FUNCTION public.get_semester_enrollment_count(p_campus_slug text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT sp.email)::int
  FROM public.student_purchases sp
  JOIN public.campuses c ON c.id = sp.campus_id
  WHERE c.slug = p_campus_slug
    AND (c.semester_start IS NULL OR sp.created_at >= c.semester_start::timestamptz);
$$;

GRANT EXECUTE ON FUNCTION public.get_paid_student_count_for_campus(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_semester_enrollment_count(text) TO anon, authenticated;