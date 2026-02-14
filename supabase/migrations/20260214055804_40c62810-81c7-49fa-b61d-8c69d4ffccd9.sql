-- Activity log for tracking actions during focus sprints
CREATE TABLE public.sprint_activity_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.focus_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  action_detail text DEFAULT '',
  lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.sprint_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own activity logs"
ON public.sprint_activity_log FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own activity logs"
ON public.sprint_activity_log FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own activity logs"
ON public.sprint_activity_log FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_sprint_activity_session ON public.sprint_activity_log(session_id);
CREATE INDEX idx_sprint_activity_created ON public.sprint_activity_log(created_at);