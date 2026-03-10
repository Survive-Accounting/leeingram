
-- Add assigned_role to va_assignments
ALTER TABLE public.va_assignments ADD COLUMN IF NOT EXISTS assigned_role text NOT NULL DEFAULT 'content_creation_va';
