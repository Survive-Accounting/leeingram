ALTER TABLE public.problem_variants 
ADD COLUMN IF NOT EXISTS candidate_data jsonb NOT NULL DEFAULT '{}'::jsonb;