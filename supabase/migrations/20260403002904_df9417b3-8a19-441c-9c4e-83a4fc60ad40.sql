ALTER TABLE public.solutions_qa_assets ADD COLUMN assigned_to text;

CREATE INDEX idx_solutions_qa_assets_course ON public.solutions_qa_assets(course_id);
CREATE INDEX idx_solutions_qa_assets_assigned ON public.solutions_qa_assets(assigned_to);