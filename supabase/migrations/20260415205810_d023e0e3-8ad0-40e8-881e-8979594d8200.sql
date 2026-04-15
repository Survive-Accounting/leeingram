CREATE POLICY "Authenticated users can update tab visibility"
ON public.cram_tab_visibility
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);