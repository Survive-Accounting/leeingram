ALTER TABLE public.problem_variants
ADD COLUMN variant_status text NOT NULL DEFAULT 'draft';

COMMENT ON COLUMN public.problem_variants.variant_status IS 'draft | approved | banked | archived';