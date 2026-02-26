ALTER TABLE public.chapter_problems
  ADD COLUMN IF NOT EXISTS ocr_extracted_problem_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ocr_extracted_solution_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ocr_detected_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ocr_detected_lo text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ocr_detected_title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ocr_detected_type text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ocr_confidence text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ocr_confidence_notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ocr_status text NOT NULL DEFAULT 'pending';