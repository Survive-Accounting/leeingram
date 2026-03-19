
-- Create solutions_qa_assets table
CREATE TABLE public.solutions_qa_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teaching_asset_id UUID REFERENCES public.teaching_assets(id) ON DELETE CASCADE NOT NULL,
  asset_name TEXT NOT NULL,
  chapter_id UUID NOT NULL,
  course_id UUID NOT NULL,
  qa_status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create solutions_qa_issues table
CREATE TABLE public.solutions_qa_issues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  qa_asset_id UUID REFERENCES public.solutions_qa_assets(id) ON DELETE CASCADE NOT NULL,
  asset_name TEXT NOT NULL,
  section TEXT NOT NULL,
  issue_description TEXT NOT NULL,
  suggested_fix TEXT,
  screenshot_url TEXT,
  fix_description TEXT,
  fix_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.solutions_qa_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solutions_qa_issues ENABLE ROW LEVEL SECURITY;

-- RLS policies for solutions_qa_assets
CREATE POLICY "Authenticated users can read solutions_qa_assets"
  ON public.solutions_qa_assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert solutions_qa_assets"
  ON public.solutions_qa_assets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update solutions_qa_assets"
  ON public.solutions_qa_assets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- RLS policies for solutions_qa_issues
CREATE POLICY "Authenticated users can read solutions_qa_issues"
  ON public.solutions_qa_issues FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert solutions_qa_issues"
  ON public.solutions_qa_issues FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update solutions_qa_issues"
  ON public.solutions_qa_issues FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete solutions_qa_issues"
  ON public.solutions_qa_issues FOR DELETE TO authenticated USING (true);
