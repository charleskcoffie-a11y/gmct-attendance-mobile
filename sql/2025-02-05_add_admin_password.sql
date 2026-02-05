-- Add admin_password column to app_settings table
-- This allows admins to change their password in the Settings panel

ALTER TABLE app_settings
ADD COLUMN admin_password TEXT;

-- OPTIONAL: Set a default admin password if needed
-- UPDATE app_settings SET admin_password = 'admin123' WHERE id = 'app_settings';
