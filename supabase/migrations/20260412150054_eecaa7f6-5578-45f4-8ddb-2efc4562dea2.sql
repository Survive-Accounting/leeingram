
CREATE TABLE public.site_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read site content"
  ON public.site_content FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can update site content"
  ON public.site_content FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

INSERT INTO public.site_content (key, value) VALUES (
  'about_lee_bio',
  E'I loved accounting so much in college that I became a full-time tutor. During the pandemic I went fully virtual and created SurviveAccounting.com — and it''s been a blast watching it grow.\n\nNow I travel the world while helping college students actually understand — and even love — accounting. Not just survive it.\n\nI will help you ace exams, but also I hope you discover something I think is more important: thinking like an accountant is an incredibly valuable skill. Both now and for your career. I''m going to help you learn it. Once you think like an accountant, your exam will feel way less brutal.\n\nBest of luck studying!\n— Lee\n\nPS: A huge thanks to all the students who''ve enjoyed and supported my work over the years, so much so that I can work full-time on growing Survive Accounting. As a lifelong teacher, it means a lot.'
);
