
-- Writing domain: Story Ideas
CREATE TABLE public.story_ideas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.story_ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own story ideas" ON public.story_ideas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own story ideas" ON public.story_ideas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own story ideas" ON public.story_ideas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own story ideas" ON public.story_ideas FOR DELETE USING (auth.uid() = user_id);

-- Writing domain: Story Uploads (PDF tracking)
CREATE TABLE public.story_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_idea_id UUID NOT NULL REFERENCES public.story_ideas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.story_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own story uploads" ON public.story_uploads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own story uploads" ON public.story_uploads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own story uploads" ON public.story_uploads FOR DELETE USING (auth.uid() = user_id);

-- Storage bucket for story PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('story-files', 'story-files', false);

CREATE POLICY "Users can upload story files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'story-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view their own story files" ON storage.objects FOR SELECT USING (bucket_id = 'story-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own story files" ON storage.objects FOR DELETE USING (bucket_id = 'story-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Leeingram domain: Vlog Seasons
CREATE TABLE public.vlog_seasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  series_name TEXT NOT NULL DEFAULT 'Earned Wisdom',
  season_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vlog_seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own vlog seasons" ON public.vlog_seasons FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own vlog seasons" ON public.vlog_seasons FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own vlog seasons" ON public.vlog_seasons FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own vlog seasons" ON public.vlog_seasons FOR DELETE USING (auth.uid() = user_id);

-- Leeingram domain: Vlog Episodes
CREATE TABLE public.vlog_episodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID NOT NULL REFERENCES public.vlog_seasons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  episode_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'idea',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vlog_episodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own vlog episodes" ON public.vlog_episodes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own vlog episodes" ON public.vlog_episodes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own vlog episodes" ON public.vlog_episodes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own vlog episodes" ON public.vlog_episodes FOR DELETE USING (auth.uid() = user_id);

-- Focus sessions for Survive Accounting
CREATE TABLE public.focus_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  domain TEXT NOT NULL DEFAULT 'survive',
  focus_area TEXT NOT NULL,
  focus_detail TEXT DEFAULT '',
  intention TEXT NOT NULL DEFAULT '',
  duration_minutes INTEGER NOT NULL DEFAULT 25,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own focus sessions" ON public.focus_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own focus sessions" ON public.focus_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own focus sessions" ON public.focus_sessions FOR UPDATE USING (auth.uid() = user_id);

-- Music links for domain selector
CREATE TABLE public.music_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  youtube_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.music_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own music links" ON public.music_links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own music links" ON public.music_links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own music links" ON public.music_links FOR DELETE USING (auth.uid() = user_id);

-- Timestamp triggers
CREATE TRIGGER update_story_ideas_updated_at BEFORE UPDATE ON public.story_ideas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_vlog_episodes_updated_at BEFORE UPDATE ON public.vlog_episodes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
