-- App-specific admin password for GMCT Attendance Mobile.
-- This avoids collisions when multiple apps share the same database.

ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS attendance_admin_password TEXT;

-- One-time backfill so existing attendance admin credentials keep working.
UPDATE public.app_settings
SET attendance_admin_password = admin_password
WHERE id = 'app_settings'
  AND (attendance_admin_password IS NULL OR BTRIM(attendance_admin_password) = '')
  AND admin_password IS NOT NULL
  AND BTRIM(admin_password) <> '';
