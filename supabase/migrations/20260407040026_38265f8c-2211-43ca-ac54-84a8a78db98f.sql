-- Add new bullet columns
ALTER TABLE public.chapter_purpose
  ADD COLUMN purpose_bullets jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN consequence_bullets jsonb DEFAULT '[]'::jsonb;

-- Migrate existing text data to bullet arrays
UPDATE public.chapter_purpose
SET
  purpose_bullets = CASE
    WHEN purpose_text IS NOT NULL AND purpose_text != '' THEN jsonb_build_array(purpose_text)
    ELSE '[]'::jsonb
  END,
  consequence_bullets = CASE
    WHEN consequence_text IS NOT NULL AND consequence_text != '' THEN jsonb_build_array(consequence_text)
    ELSE '[]'::jsonb
  END;

-- Drop old columns
ALTER TABLE public.chapter_purpose
  DROP COLUMN purpose_text,
  DROP COLUMN consequence_text;