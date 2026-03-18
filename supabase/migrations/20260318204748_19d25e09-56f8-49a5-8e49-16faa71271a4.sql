CREATE POLICY "Anon read chapters"
ON public.chapters
FOR SELECT
TO anon
USING (true);