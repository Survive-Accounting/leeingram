
-- Add new columns to chapter_topics
ALTER TABLE public.chapter_topics
  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses(id),
  ADD COLUMN IF NOT EXISTS topic_number int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS topic_description text DEFAULT '',
  ADD COLUMN IF NOT EXISTS topic_rationale text DEFAULT '',
  ADD COLUMN IF NOT EXISTS asset_codes text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS lw_video_link text,
  ADD COLUMN IF NOT EXISTS lw_quiz_link text,
  ADD COLUMN IF NOT EXISTS video_status text DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS quiz_status text DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS generated_by_ai boolean DEFAULT true;

-- Add topic_id to teaching_assets
ALTER TABLE public.teaching_assets
  ADD COLUMN IF NOT EXISTS topic_id uuid REFERENCES public.chapter_topics(id);

-- Enable RLS (already enabled on chapter_topics, but ensure)
ALTER TABLE public.chapter_topics ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for chapter_topics (allow authenticated read/write)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chapter_topics' AND policyname = 'Authenticated users can read chapter_topics') THEN
    CREATE POLICY "Authenticated users can read chapter_topics"
      ON public.chapter_topics FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chapter_topics' AND policyname = 'Authenticated users can insert chapter_topics') THEN
    CREATE POLICY "Authenticated users can insert chapter_topics"
      ON public.chapter_topics FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chapter_topics' AND policyname = 'Authenticated users can update chapter_topics') THEN
    CREATE POLICY "Authenticated users can update chapter_topics"
      ON public.chapter_topics FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chapter_topics' AND policyname = 'Authenticated users can delete chapter_topics') THEN
    CREATE POLICY "Authenticated users can delete chapter_topics"
      ON public.chapter_topics FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
