
ALTER TABLE public.campuses
  ADD COLUMN IF NOT EXISTS domains text[] NOT NULL DEFAULT '{}';

UPDATE public.campuses
  SET domains = ARRAY['olemiss.edu', 'go.olemiss.edu']
  WHERE slug = 'ole-miss';
