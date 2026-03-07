-- Add username field to class_leaders table if it doesn't exist
-- This allows for better username management and display

ALTER TABLE class_leaders ADD COLUMN IF NOT EXISTS username TEXT;

-- For existing class leaders, populate username from their full_name (if not already set)
UPDATE class_leaders
SET username = LOWER(REPLACE(REPLACE(REPLACE(full_name, ' ', '_'), '-', '_'), '''', ''))
WHERE username IS NULL AND full_name IS NOT NULL;

-- Create an index on username for faster lookups during authentication
CREATE INDEX IF NOT EXISTS idx_class_leaders_username ON class_leaders(username);
