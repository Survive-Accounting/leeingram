CREATE TABLE public.chapter_section_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  section_name TEXT NOT NULL,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  hidden_item_ids TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(chapter_id, section_name)
);

ALTER TABLE public.chapter_section_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view chapter section config"
ON public.chapter_section_config
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert chapter section config"
ON public.chapter_section_config
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update chapter section config"
ON public.chapter_section_config
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete chapter section config"
ON public.chapter_section_config
FOR DELETE
TO authenticated
USING (true);