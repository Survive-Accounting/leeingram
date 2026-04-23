CREATE TABLE public.landing_page_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  email_type text NOT NULL DEFAULT 'edu',
  university_name text,
  university_domain text,
  course_slug text,
  intent_tag text,
  campus_signup_number integer,
  source text DEFAULT 'landing_page',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.landing_page_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert leads"
  ON public.landing_page_leads FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can read leads"
  ON public.landing_page_leads FOR SELECT
  TO authenticated USING (true);

CREATE INDEX idx_leads_email ON public.landing_page_leads(email);
CREATE INDEX idx_leads_university ON public.landing_page_leads(university_domain);
CREATE INDEX idx_leads_course ON public.landing_page_leads(course_slug);

CREATE TABLE public.campus_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_domain text NOT NULL UNIQUE,
  university_name text,
  enrollment_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campus_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read campus counts"
  ON public.campus_enrollments FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "Authenticated can insert"
  ON public.campus_enrollments FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update"
  ON public.campus_enrollments FOR UPDATE
  TO authenticated USING (true);

CREATE TRIGGER update_campus_enrollments_updated_at
BEFORE UPDATE ON public.campus_enrollments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();