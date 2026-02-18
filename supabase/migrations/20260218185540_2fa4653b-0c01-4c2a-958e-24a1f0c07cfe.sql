
-- Trip tasks for planning dashboard
CREATE TABLE public.trip_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  assigned_to TEXT NOT NULL DEFAULT 'both',
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'todo',
  is_listed BOOLEAN DEFAULT false,
  is_sold BOOLEAN DEFAULT false,
  sold_price NUMERIC(10,2),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trip_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own trip tasks" ON public.trip_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own trip tasks" ON public.trip_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own trip tasks" ON public.trip_tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own trip tasks" ON public.trip_tasks FOR DELETE USING (auth.uid() = user_id);

-- Trip task links
CREATE TABLE public.trip_task_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.trip_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  url TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trip_task_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own task links" ON public.trip_task_links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own task links" ON public.trip_task_links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own task links" ON public.trip_task_links FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own task links" ON public.trip_task_links FOR DELETE USING (auth.uid() = user_id);

-- Explore items for the Exploring page
CREATE TABLE public.trip_explore_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'restaurants',
  url TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trip_explore_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own explore items" ON public.trip_explore_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own explore items" ON public.trip_explore_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own explore items" ON public.trip_explore_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own explore items" ON public.trip_explore_items FOR DELETE USING (auth.uid() = user_id);
