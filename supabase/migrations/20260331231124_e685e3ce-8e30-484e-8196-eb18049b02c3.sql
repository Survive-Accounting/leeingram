CREATE TABLE public.chapter_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE CASCADE NOT NULL,
  topic_id uuid REFERENCES public.chapter_topics(id) ON DELETE SET NULL,
  video_type text NOT NULL DEFAULT 'intro',
  vimeo_embed_url text NOT NULL,
  thumbnail_url text,
  title text,
  recorded_at date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chapter_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view chapter videos"
  ON public.chapter_videos FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage chapter videos"
  ON public.chapter_videos FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);