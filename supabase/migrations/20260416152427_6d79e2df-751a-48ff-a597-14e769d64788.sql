ALTER TABLE public.va_survey_responses
ADD COLUMN IF NOT EXISTS study_background text,
ADD COLUMN IF NOT EXISTS location_timezone text,
ADD COLUMN IF NOT EXISTS work_hours text,
ADD COLUMN IF NOT EXISTS instruction_preference text,
ADD COLUMN IF NOT EXISTS software_tools text,
ADD COLUMN IF NOT EXISTS edtech_experience text,
ADD COLUMN IF NOT EXISTS hours_per_week text;