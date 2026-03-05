
-- Create asset_groups table
CREATE TABLE public.asset_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_code text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read asset_groups" ON public.asset_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write asset_groups" ON public.asset_groups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update asset_groups" ON public.asset_groups FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete asset_groups" ON public.asset_groups FOR DELETE TO authenticated USING (true);

-- Add group_id and confidence_score to assets
ALTER TABLE public.assets
  ADD COLUMN group_id uuid REFERENCES public.asset_groups(id) ON DELETE SET NULL,
  ADD COLUMN confidence_score integer NOT NULL DEFAULT 0;

ALTER TABLE public.assets
  ADD CONSTRAINT confidence_range CHECK (confidence_score >= 0 AND confidence_score <= 100);

CREATE INDEX idx_assets_group_id ON public.assets (group_id);
