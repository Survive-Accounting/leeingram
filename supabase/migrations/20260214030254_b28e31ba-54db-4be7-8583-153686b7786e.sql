
-- Create the update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Email Factory table
CREATE TABLE public.emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  email_type TEXT NOT NULL DEFAULT 'general',
  audience TEXT NOT NULL DEFAULT '',
  purpose TEXT NOT NULL DEFAULT '',
  giving TEXT NOT NULL DEFAULT '',
  hoping_to_receive TEXT NOT NULL DEFAULT '',
  local_flavor TEXT NOT NULL DEFAULT '',
  journal_body TEXT NOT NULL DEFAULT '',
  ai_refined_body TEXT,
  final_draft TEXT,
  ai_strategy_notes TEXT,
  status TEXT NOT NULL DEFAULT 'planning',
  semester TEXT NOT NULL DEFAULT 'Spring 2026',
  tags TEXT[] DEFAULT '{}',
  course_tags TEXT[] DEFAULT '{}',
  refinement_history JSONB DEFAULT '[]'::jsonb,
  refinement_count INTEGER NOT NULL DEFAULT 0,
  max_refinements INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own emails" ON public.emails FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own emails" ON public.emails FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own emails" ON public.emails FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own emails" ON public.emails FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_emails_updated_at
BEFORE UPDATE ON public.emails
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Email-related columns on user_preferences
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS email_style_guide TEXT DEFAULT '';
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS email_types TEXT[] DEFAULT ARRAY['Post-Exam Feedback', 'Welcome/Onboarding', 'Course Update', 'Promotion', 'Thank You', 'Re-engagement', 'General'];
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS email_max_refinements INTEGER DEFAULT 3;
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS semesters TEXT[] DEFAULT ARRAY['Spring 2026', 'Summer 2026', 'Fall 2026', 'Spring 2027'];
