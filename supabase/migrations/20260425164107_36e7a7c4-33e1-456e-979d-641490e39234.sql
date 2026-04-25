CREATE TABLE public.simplified_problem_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL UNIQUE,
  simplified_text TEXT NOT NULL,
  model_used TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_simplified_problem_cache_asset_id ON public.simplified_problem_cache(asset_id);

ALTER TABLE public.simplified_problem_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read simplified problems"
ON public.simplified_problem_cache
FOR SELECT
USING (true);

CREATE TRIGGER update_simplified_problem_cache_updated_at
BEFORE UPDATE ON public.simplified_problem_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();