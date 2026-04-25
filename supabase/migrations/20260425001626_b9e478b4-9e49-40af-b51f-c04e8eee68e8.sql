
CREATE TABLE public.greek_waitlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  org_name TEXT NOT NULL,
  greek_org_id UUID REFERENCES public.greek_orgs(id) ON DELETE SET NULL,
  campus_id UUID REFERENCES public.campuses(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'get_org_access',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_greek_waitlist_org_name_lower ON public.greek_waitlist (lower(org_name));
CREATE INDEX idx_greek_waitlist_greek_org_id ON public.greek_waitlist (greek_org_id);
CREATE UNIQUE INDEX uq_greek_waitlist_email_org ON public.greek_waitlist (lower(email), lower(org_name));

ALTER TABLE public.greek_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read waitlist counts"
ON public.greek_waitlist FOR SELECT
USING (true);

CREATE POLICY "Anyone can join waitlist"
ON public.greek_waitlist FOR INSERT
WITH CHECK (true);

CREATE POLICY "Only Lee can update waitlist"
ON public.greek_waitlist FOR UPDATE
USING ((auth.jwt() ->> 'email') = 'lee@survivestudios.com');

CREATE POLICY "Only Lee can delete waitlist"
ON public.greek_waitlist FOR DELETE
USING ((auth.jwt() ->> 'email') = 'lee@survivestudios.com');
