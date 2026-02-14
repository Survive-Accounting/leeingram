-- Roadmap items table
CREATE TABLE public.roadmap_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  priority text NOT NULL DEFAULT 'medium',
  target_semester text DEFAULT '',
  status text NOT NULL DEFAULT 'idea',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.roadmap_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roadmap items" ON public.roadmap_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own roadmap items" ON public.roadmap_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own roadmap items" ON public.roadmap_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own roadmap items" ON public.roadmap_items FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_roadmap_items_updated_at
  BEFORE UPDATE ON public.roadmap_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();