
-- Add boolean flags for optional learning structures
ALTER TABLE public.teaching_assets ADD COLUMN uses_t_accounts BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.teaching_assets ADD COLUMN uses_tables BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.teaching_assets ADD COLUMN uses_financial_statements BOOLEAN NOT NULL DEFAULT false;

-- Add JSON columns for storing structured data
ALTER TABLE public.teaching_assets ADD COLUMN t_accounts_json JSONB NULL;
ALTER TABLE public.teaching_assets ADD COLUMN tables_json JSONB NULL;
ALTER TABLE public.teaching_assets ADD COLUMN financial_statements_json JSONB NULL;
