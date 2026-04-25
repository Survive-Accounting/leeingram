-- Create greek_organizations table for the org-access onboarding flow
CREATE TABLE public.greek_organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('fraternity', 'sorority')),
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_greek_organizations_type ON public.greek_organizations(type);
CREATE INDEX idx_greek_organizations_name ON public.greek_organizations(name);

-- Enable RLS — this is a public reference list (read-only for everyone)
ALTER TABLE public.greek_organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Greek organizations are publicly readable"
  ON public.greek_organizations
  FOR SELECT
  USING (true);

-- Timestamp trigger
CREATE TRIGGER update_greek_organizations_updated_at
  BEFORE UPDATE ON public.greek_organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();