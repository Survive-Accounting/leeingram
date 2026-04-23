
CREATE TABLE public.waitlist_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  tag text NOT NULL,
  campus_slug text,
  course_slug text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, tag)
);

ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can join waitlist" ON public.waitlist_signups
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
