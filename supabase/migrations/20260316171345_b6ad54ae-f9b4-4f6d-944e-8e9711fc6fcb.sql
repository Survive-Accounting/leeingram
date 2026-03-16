ALTER TABLE teaching_assets ADD COLUMN IF NOT EXISTS lw_html_added boolean DEFAULT false;
ALTER TABLE teaching_assets ADD COLUMN IF NOT EXISTS lw_csv_exported_at timestamptz;