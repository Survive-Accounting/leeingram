
-- Lead capture
CREATE TABLE public.student_emails (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  course_id uuid references public.courses(id),
  chapter_id uuid references public.chapters(id),
  attempted_at timestamptz default now(),
  converted boolean default false
);

ALTER TABLE public.student_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view own student_emails"
  ON public.student_emails FOR SELECT TO authenticated
  USING (email = (auth.jwt()->>'email'));

-- Confirmed purchases
CREATE TABLE public.student_purchases (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  course_id uuid references public.courses(id),
  chapter_id uuid references public.chapters(id),
  purchase_type text not null,
  stripe_customer_id text,
  stripe_session_id text,
  lw_enrollment_id text,
  lw_enrollment_status text default 'pending',
  expires_at timestamptz default '2026-05-16T23:59:59Z',
  created_at timestamptz default now()
);

ALTER TABLE public.student_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view own student_purchases"
  ON public.student_purchases FOR SELECT TO authenticated
  USING (email = (auth.jwt()->>'email'));

-- Enrollment cache
CREATE TABLE public.enrollment_cache (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  course_id uuid references public.courses(id),
  chapter_id uuid references public.chapters(id),
  is_enrolled boolean default false,
  last_checked_at timestamptz default now(),
  UNIQUE(email, course_id, chapter_id)
);

ALTER TABLE public.enrollment_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view own enrollment_cache"
  ON public.enrollment_cache FOR SELECT TO authenticated
  USING (email = (auth.jwt()->>'email'));

-- Indexes
CREATE INDEX idx_student_emails_email ON public.student_emails(email);
CREATE INDEX idx_student_purchases_email ON public.student_purchases(email);
CREATE INDEX idx_student_purchases_stripe_session ON public.student_purchases(stripe_session_id);
CREATE INDEX idx_enrollment_cache_email_course ON public.enrollment_cache(email, course_id);
