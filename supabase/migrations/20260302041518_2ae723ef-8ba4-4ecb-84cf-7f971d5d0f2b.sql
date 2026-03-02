ALTER TABLE public.chapters
ADD COLUMN je_only_mode boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.chapters.je_only_mode IS 'When true, only JE problems are eligible for AI generation';