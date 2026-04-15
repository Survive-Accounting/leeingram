
CREATE TABLE public.student_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  campus_id UUID REFERENCES public.campuses(id) ON DELETE SET NULL,
  course_slug TEXT,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  page_url TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  session_id TEXT,
  device_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_student_events_email ON public.student_events(email);
CREATE INDEX idx_student_events_student ON public.student_events(student_id);
CREATE INDEX idx_student_events_campus ON public.student_events(campus_id);
CREATE INDEX idx_student_events_type ON public.student_events(event_type);
CREATE INDEX idx_student_events_session ON public.student_events(session_id);
CREATE INDEX idx_student_events_created ON public.student_events(created_at DESC);

ALTER TABLE public.student_events ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts for tracking (no auth required)
CREATE POLICY "Anyone can insert student events"
  ON public.student_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
