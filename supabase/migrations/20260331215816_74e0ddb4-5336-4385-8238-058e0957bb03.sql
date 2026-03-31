
DROP POLICY IF EXISTS "Anyone can insert video requests" ON public.topic_video_requests;
DROP POLICY IF EXISTS "Anyone can read video requests" ON public.topic_video_requests;
CREATE POLICY "Anyone can insert video requests" ON public.topic_video_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read video requests" ON public.topic_video_requests FOR SELECT USING (true);
