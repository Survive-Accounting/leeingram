
ALTER TABLE teaching_assets 
ADD COLUMN fix_status text DEFAULT NULL;

CREATE INDEX idx_teaching_assets_fix_status 
ON teaching_assets(fix_status);
