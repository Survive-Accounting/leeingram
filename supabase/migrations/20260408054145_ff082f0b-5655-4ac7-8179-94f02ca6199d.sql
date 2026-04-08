CREATE TABLE public.va_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_url TEXT,
  feedback TEXT NOT NULL,
  va_name TEXT,
  screenshot_url_1 TEXT,
  screenshot_url_2 TEXT,
  screenshot_url_3 TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.va_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert feedback"
ON public.va_feedback
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can read feedback"
ON public.va_feedback
FOR SELECT
TO authenticated
USING (true);