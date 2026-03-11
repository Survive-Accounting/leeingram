
-- Add problem_context column to teaching_assets
ALTER TABLE public.teaching_assets ADD COLUMN problem_context TEXT DEFAULT '';

-- Create problem_instructions table
CREATE TABLE public.problem_instructions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teaching_asset_id UUID NOT NULL REFERENCES public.teaching_assets(id) ON DELETE CASCADE,
  instruction_number INTEGER NOT NULL,
  instruction_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.problem_instructions ENABLE ROW LEVEL SECURITY;

-- RLS policies (match teaching_assets pattern - authenticated access)
CREATE POLICY "Authenticated read problem_instructions" ON public.problem_instructions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write problem_instructions" ON public.problem_instructions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update problem_instructions" ON public.problem_instructions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete problem_instructions" ON public.problem_instructions FOR DELETE TO authenticated USING (true);

-- Index for efficient lookups
CREATE INDEX idx_problem_instructions_asset ON public.problem_instructions(teaching_asset_id, instruction_number);
