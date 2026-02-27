-- Create new enum for problem pipeline status
CREATE TYPE public.problem_pipeline_status AS ENUM (
  'imported',
  'generated', 
  'approved',
  'banked',
  'ready_to_film',
  'deployed'
);

-- Add new column with the enum type
ALTER TABLE public.chapter_problems 
ADD COLUMN pipeline_status public.problem_pipeline_status NOT NULL DEFAULT 'imported';

-- Migrate existing data from text status to new enum
UPDATE public.chapter_problems SET pipeline_status = 'imported' WHERE status IN ('raw', 'tagged', 'ready', 'pending');
UPDATE public.chapter_problems SET pipeline_status = 'generated' WHERE status = 'generated';
UPDATE public.chapter_problems SET pipeline_status = 'approved' WHERE status = 'approved';