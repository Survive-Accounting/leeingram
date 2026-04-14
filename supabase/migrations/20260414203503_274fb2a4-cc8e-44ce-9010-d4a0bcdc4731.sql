
-- 1. CAMPUSES
CREATE TABLE IF NOT EXISTS public.campuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  timezone text NOT NULL DEFAULT 'America/Chicago',
  semester_start date,
  semester_end date,
  stripe_coupon_id text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Campuses are publicly readable" ON public.campuses FOR SELECT USING (true);

CREATE INDEX idx_campuses_slug ON public.campuses (slug);

-- 2. CAMPUS_COURSES
CREATE TABLE IF NOT EXISTS public.campus_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id uuid NOT NULL REFERENCES public.campuses(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  override_semester_price_cents int,
  override_chapter_price_cents int,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campus_id, course_id)
);

ALTER TABLE public.campus_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Campus courses are publicly readable" ON public.campus_courses FOR SELECT USING (true);

CREATE INDEX idx_campus_courses_campus ON public.campus_courses (campus_id);
CREATE INDEX idx_campus_courses_course ON public.campus_courses (course_id);

-- 3. CAMPUS_PRICING
CREATE TABLE IF NOT EXISTS public.campus_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id uuid REFERENCES public.campuses(id) ON DELETE CASCADE,
  product_type text NOT NULL,
  price_cents int NOT NULL,
  label text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campus_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Campus pricing is publicly readable" ON public.campus_pricing FOR SELECT USING (true);

CREATE INDEX idx_campus_pricing_campus ON public.campus_pricing (campus_id);
CREATE INDEX idx_campus_pricing_type ON public.campus_pricing (product_type);

-- 4. CAMPUS_PROFESSORS
CREATE TABLE IF NOT EXISTS public.campus_professors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id uuid NOT NULL REFERENCES public.campuses(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  department text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campus_professors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Campus professors are publicly readable" ON public.campus_professors FOR SELECT USING (true);

CREATE INDEX idx_campus_professors_campus ON public.campus_professors (campus_id);

-- 5. STUDENTS
CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text,
  campus_id uuid REFERENCES public.campuses(id),
  professor_id uuid REFERENCES public.campus_professors(id),
  auth_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own student record" ON public.students FOR SELECT TO authenticated USING (auth.jwt() ->> 'email' = email);

CREATE INDEX idx_students_email ON public.students (email);
CREATE INDEX idx_students_campus ON public.students (campus_id);

-- 6. ADD COLUMNS TO student_purchases
ALTER TABLE public.student_purchases
  ADD COLUMN IF NOT EXISTS campus_id uuid REFERENCES public.campuses(id),
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id),
  ADD COLUMN IF NOT EXISTS price_paid_cents int,
  ADD COLUMN IF NOT EXISTS discount_applied_cents int;

CREATE INDEX IF NOT EXISTS idx_student_purchases_campus ON public.student_purchases (campus_id);
CREATE INDEX IF NOT EXISTS idx_student_purchases_student ON public.student_purchases (student_id);

-- 7. get_campus_price() FUNCTION
CREATE OR REPLACE FUNCTION public.get_campus_price(
  p_campus_slug text,
  p_product_type text
)
RETURNS int
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price int;
BEGIN
  -- Try campus-specific price first
  SELECT cp.price_cents INTO v_price
  FROM campus_pricing cp
  JOIN campuses c ON c.id = cp.campus_id
  WHERE c.slug = p_campus_slug
    AND cp.product_type = p_product_type
    AND cp.is_active = true
  LIMIT 1;

  IF v_price IS NOT NULL THEN
    RETURN v_price;
  END IF;

  -- Fall back to global pricing (campus_id IS NULL)
  SELECT price_cents INTO v_price
  FROM campus_pricing
  WHERE campus_id IS NULL
    AND product_type = p_product_type
    AND is_active = true
  LIMIT 1;

  RETURN COALESCE(v_price, 0);
END;
$$;

-- 8. SEED DATA

-- Global pricing (no campus_id)
INSERT INTO public.campus_pricing (campus_id, product_type, price_cents, label)
VALUES
  (NULL, 'semester_pass', 25000, 'Semester Pass'),
  (NULL, 'chapter_pass', 3000, 'Chapter Pass')
ON CONFLICT DO NOTHING;

-- Ole Miss campus
INSERT INTO public.campuses (id, name, slug, timezone, semester_start, semester_end)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'University of Mississippi',
  'ole-miss',
  'America/Chicago',
  '2026-01-20',
  '2026-05-16'
) ON CONFLICT (slug) DO NOTHING;

-- Link existing courses to Ole Miss
INSERT INTO public.campus_courses (campus_id, course_id)
SELECT 'a0000000-0000-0000-0000-000000000001', id
FROM public.courses
WHERE id IS NOT NULL
ON CONFLICT (campus_id, course_id) DO NOTHING;

-- Updated_at triggers
CREATE TRIGGER update_campuses_updated_at BEFORE UPDATE ON public.campuses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campus_pricing_updated_at BEFORE UPDATE ON public.campus_pricing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
