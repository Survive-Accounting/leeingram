-- Add lesson_id to focus_sessions for tracking which lesson was worked on
ALTER TABLE public.focus_sessions 
ADD COLUMN lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL;

-- Add actual_minutes to track real time spent (for early end / extensions)
ALTER TABLE public.focus_sessions
ADD COLUMN actual_minutes integer;

-- Add notes column for end-of-session progress report
ALTER TABLE public.focus_sessions
ADD COLUMN notes text DEFAULT '';