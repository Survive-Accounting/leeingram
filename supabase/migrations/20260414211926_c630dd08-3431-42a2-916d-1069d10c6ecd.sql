
CREATE TABLE public.email_campus_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  campus_id UUID NOT NULL REFERENCES public.campuses(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_overrides_email ON public.email_campus_overrides(email);

ALTER TABLE public.email_campus_overrides ENABLE ROW LEVEL SECURITY;

-- Service role and edge functions need to read this
CREATE POLICY "Anyone can read overrides"
ON public.email_campus_overrides FOR SELECT
TO anon, authenticated
USING (true);

-- Only authenticated users can manage overrides
CREATE POLICY "Authenticated users can manage overrides"
ON public.email_campus_overrides FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Seed data
INSERT INTO public.email_campus_overrides (email, campus_id, note)
SELECT 'lee@survivestudios.com', id, 'Lee - founder test account'
FROM public.campuses WHERE slug = 'ole-miss'
LIMIT 1;

INSERT INTO public.email_campus_overrides (email, campus_id, note)
SELECT 'jking.cim@gmail.com', id, 'King - lead VA test account'
FROM public.campuses WHERE slug = 'ole-miss'
LIMIT 1;
