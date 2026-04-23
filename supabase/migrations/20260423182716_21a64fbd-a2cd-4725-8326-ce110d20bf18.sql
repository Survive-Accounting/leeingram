INSERT INTO public.campuses (slug, name, domains, is_active, mascot_cheer)
VALUES ('general', 'Survive Accounting', ARRAY[]::text[], true, NULL)
ON CONFLICT (slug) DO NOTHING;