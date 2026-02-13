-- Add sick and travel count columns to attendance table
-- These columns track the total number of members marked as sick or traveling

ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS total_members_sick INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_members_travel INTEGER DEFAULT 0;

-- Update existing records to set default values
UPDATE attendance
SET total_members_sick = 0
WHERE total_members_sick IS NULL;

UPDATE attendance
SET total_members_travel = 0
WHERE total_members_travel IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN attendance.total_members_sick IS 'Number of members marked as sick for this attendance';
COMMENT ON COLUMN attendance.total_members_travel IS 'Number of members marked as traveling for this attendance';
