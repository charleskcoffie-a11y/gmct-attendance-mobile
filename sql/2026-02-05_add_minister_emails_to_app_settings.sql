-- Add minister_emails column to app_settings for quarterly report delivery

ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS minister_emails TEXT;
