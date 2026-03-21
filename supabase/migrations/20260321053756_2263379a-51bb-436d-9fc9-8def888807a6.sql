
ALTER TABLE public.chapter_topics
  ADD COLUMN IF NOT EXISTS merged_into_topic_id UUID REFERENCES public.chapter_topics(id) ON DELETE SET NULL;

ALTER TABLE public.chapters
  ADD COLUMN IF NOT EXISTS topics_locked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS topics_locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS topics_locked_count INT;
