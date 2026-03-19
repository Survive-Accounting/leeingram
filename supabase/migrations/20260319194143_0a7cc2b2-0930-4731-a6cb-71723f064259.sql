-- Create solutions_qa_reviews table
CREATE TABLE public.solutions_qa_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teaching_asset_id uuid REFERENCES public.teaching_assets(id) ON DELETE CASCADE NOT NULL,
  asset_name text NOT NULL DEFAULT '',
  chapter_id uuid NOT NULL,
  course_id uuid NOT NULL,
  qa_status text NOT NULL DEFAULT 'pending',
  issue_description text,
  screenshot_url text,
  fix_description text,
  lovable_prompt_generated boolean NOT NULL DEFAULT false,
  reviewed_by text,
  reviewed_at timestamptz,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.solutions_qa_reviews ENABLE ROW LEVEL SECURITY;

-- Allow authenticated read/write for all roles
CREATE POLICY "Authenticated users can read solutions_qa_reviews"
  ON public.solutions_qa_reviews FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert solutions_qa_reviews"
  ON public.solutions_qa_reviews FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update solutions_qa_reviews"
  ON public.solutions_qa_reviews FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete solutions_qa_reviews"
  ON public.solutions_qa_reviews FOR DELETE TO authenticated USING (true);

-- Create qa-screenshots storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('qa-screenshots', 'qa-screenshots', true);

-- Storage policies for qa-screenshots
CREATE POLICY "Authenticated users can upload qa screenshots"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'qa-screenshots');

CREATE POLICY "Anyone can read qa screenshots"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'qa-screenshots');

CREATE POLICY "Authenticated users can delete qa screenshots"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'qa-screenshots');