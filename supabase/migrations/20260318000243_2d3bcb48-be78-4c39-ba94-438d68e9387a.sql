
ALTER TABLE public.teaching_assets 
  ADD COLUMN IF NOT EXISTS solutions_page_views integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS practice_page_views integer DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_solutions_views(asset_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE teaching_assets 
  SET solutions_page_views = COALESCE(solutions_page_views, 0) + 1
  WHERE id = asset_id;
$$;

CREATE OR REPLACE FUNCTION public.increment_practice_views(asset_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE teaching_assets 
  SET practice_page_views = COALESCE(practice_page_views, 0) + 1
  WHERE id = asset_id;
$$;
