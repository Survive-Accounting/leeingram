
ALTER TABLE public.chapter_topics
ADD COLUMN lw_imported boolean NOT NULL DEFAULT false,
ADD COLUMN lw_imported_at timestamptz,
ADD COLUMN lw_imported_by text;
