
-- Add completed_at column to roadmap_items for tracking when items are confirmed complete
ALTER TABLE public.roadmap_items ADD COLUMN completed_at timestamp with time zone;

-- Create changelog table for tracking AI prompt changes
CREATE TABLE public.changelog (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_number integer NOT NULL,
  title text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  sub_tasks jsonb NOT NULL DEFAULT '[]'::jsonb
);

ALTER TABLE public.changelog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read changelog"
  ON public.changelog FOR SELECT
  USING (true);

CREATE POLICY "Anyone authenticated can insert changelog"
  ON public.changelog FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone authenticated can update changelog"
  ON public.changelog FOR UPDATE
  USING (true);
