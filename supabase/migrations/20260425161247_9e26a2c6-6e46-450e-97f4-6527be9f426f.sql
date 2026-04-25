CREATE TABLE public.problem_issue_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL,
  asset_name TEXT,
  user_email TEXT,
  issue_types TEXT[] NOT NULL DEFAULT '{}',
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_problem_issue_reports_asset_id ON public.problem_issue_reports(asset_id);
CREATE INDEX idx_problem_issue_reports_created_at ON public.problem_issue_reports(created_at DESC);

ALTER TABLE public.problem_issue_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit problem issue reports"
ON public.problem_issue_reports
FOR INSERT
WITH CHECK (true);
