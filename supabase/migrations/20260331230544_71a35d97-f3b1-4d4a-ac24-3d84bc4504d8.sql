CREATE TABLE public.chapter_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE CASCADE NOT NULL,
  student_email text NOT NULL,
  question text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'new',
  issue_type text NOT NULL DEFAULT 'question',
  asset_name text,
  source_ref text,
  reply_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chapter_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert chapter questions"
  ON public.chapter_questions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read chapter questions"
  ON public.chapter_questions FOR SELECT
  TO authenticated
  USING (true);