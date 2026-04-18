-- Semesters
CREATE TABLE IF NOT EXISTS public.semesters (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  year integer NOT NULL,
  default_discount_percent integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Extend existing course_products table (keeps existing columns intact)
ALTER TABLE public.course_products
  ADD COLUMN IF NOT EXISTS semester_id uuid REFERENCES public.semesters(id),
  ADD COLUMN IF NOT EXISTS anchor_price_cents integer NOT NULL DEFAULT 25000,
  ADD COLUMN IF NOT EXISTS stripe_product_id_live text,
  ADD COLUMN IF NOT EXISTS stripe_product_id_test text;

DO $$ BEGIN
  ALTER TABLE public.course_products
    ADD CONSTRAINT course_products_course_semester_unique UNIQUE (course_id, semester_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.bundle_products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  course_ids uuid[] NOT NULL,
  semester_ids uuid[] NOT NULL,
  is_preset boolean DEFAULT true,
  anchor_price_cents integer NOT NULL,
  discount_percent integer NOT NULL,
  final_price_cents integer NOT NULL,
  stripe_product_id_live text,
  stripe_product_id_test text,
  stripe_price_id_live text,
  stripe_price_id_test text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lifetime_products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  anchor_price_cents integer DEFAULT 199900,
  stripe_product_id_live text,
  stripe_product_id_test text,
  stripe_price_id_live text,
  stripe_price_id_test text,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  discount_percent integer NOT NULL,
  applicable_to text DEFAULT 'all',
  university_id uuid REFERENCES public.campuses(id),
  valid_from timestamptz,
  valid_until timestamptz,
  stripe_coupon_id_live text,
  stripe_coupon_id_test text,
  priority integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coupon_resolutions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  product_id uuid,
  coupons_considered jsonb,
  coupon_applied uuid REFERENCES public.coupons(id),
  resolution_reason text,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_course_products_course_semester ON public.course_products(course_id, semester_id);
CREATE INDEX IF NOT EXISTS idx_coupons_type_active ON public.coupons(type, is_active);
CREATE INDEX IF NOT EXISTS idx_coupons_university ON public.coupons(university_id);
CREATE INDEX IF NOT EXISTS idx_coupon_resolutions_email ON public.coupon_resolutions(email);

-- Enable RLS on new tables
ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundle_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lifetime_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_resolutions ENABLE ROW LEVEL SECURITY;

-- RLS policies (service role bypasses automatically)
DO $$ BEGIN CREATE POLICY "Public read semesters" ON public.semesters FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Public read bundle_products" ON public.bundle_products FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Public read lifetime_products" ON public.lifetime_products FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Public read coupons" ON public.coupons FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Public read coupon_resolutions" ON public.coupon_resolutions FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed semesters (2026)
INSERT INTO public.semesters (name, start_date, end_date, year, default_discount_percent)
SELECT * FROM (VALUES
  ('Winter', DATE '2025-12-01', DATE '2026-01-31', 2026, 50),
  ('Spring', DATE '2026-01-01', DATE '2026-05-31', 2026, 20),
  ('Summer', DATE '2026-05-15', DATE '2026-08-15', 2026, 30),
  ('Fall',   DATE '2026-08-01', DATE '2026-12-31', 2026, 20)
) AS v(name, start_date, end_date, year, default_discount_percent)
WHERE NOT EXISTS (
  SELECT 1 FROM public.semesters s WHERE s.name = v.name AND s.year = v.year
);