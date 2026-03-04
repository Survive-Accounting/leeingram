
-- 1) Create uploaded_files table
CREATE TABLE public.uploaded_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  mime_type text NOT NULL DEFAULT '',
  storage_path text NOT NULL,
  uploaded_by uuid,
  course_id uuid REFERENCES public.courses(id),
  chapter_id uuid REFERENCES public.chapters(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.uploaded_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read uploaded_files" ON public.uploaded_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write uploaded_files" ON public.uploaded_files FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated delete uploaded_files" ON public.uploaded_files FOR DELETE TO authenticated USING (true);

-- 2) Create parsed_solution_blocks table
CREATE TABLE public.parsed_solution_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES public.uploaded_files(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id),
  source_code text NOT NULL DEFAULT '',
  source_type text NOT NULL DEFAULT 'UNKNOWN',
  page_start int,
  page_end int,
  raw_text text NOT NULL DEFAULT '',
  cleaned_text text NOT NULL DEFAULT '',
  confidence numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.parsed_solution_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read parsed_solution_blocks" ON public.parsed_solution_blocks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write parsed_solution_blocks" ON public.parsed_solution_blocks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update parsed_solution_blocks" ON public.parsed_solution_blocks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete parsed_solution_blocks" ON public.parsed_solution_blocks FOR DELETE TO authenticated USING (true);

-- 3) Add new columns to chapter_problems
ALTER TABLE public.chapter_problems
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS source_code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS solution_text_confidence numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS solution_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS solution_pdf_file_id uuid REFERENCES public.uploaded_files(id) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS solution_pdf_page_start int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS solution_pdf_page_end int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS import_status text NOT NULL DEFAULT 'needs_problem_screenshot';

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_chapter_problems_import_status ON public.chapter_problems(import_status);
CREATE INDEX IF NOT EXISTS idx_chapter_problems_source_code ON public.chapter_problems(source_code);
CREATE INDEX IF NOT EXISTS idx_parsed_solution_blocks_file_id ON public.parsed_solution_blocks(file_id);
