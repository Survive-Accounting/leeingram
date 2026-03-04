-- Add parts_json column to problem_variants for the new parts-based answer schema
ALTER TABLE public.problem_variants
ADD COLUMN parts_json jsonb DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN public.problem_variants.parts_json IS 'Unified parts-based answer schema: [{label, type, ...}]. Replaces answer_parts_json and journal_entry_completed_json.';