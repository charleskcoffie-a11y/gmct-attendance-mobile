-- Add absent reason codes for member attendance records
ALTER TABLE member_attendance
ADD COLUMN IF NOT EXISTS absence_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'member_attendance_absence_reason_check'
  ) THEN
    ALTER TABLE member_attendance
    ADD CONSTRAINT member_attendance_absence_reason_check
    CHECK (absence_reason IS NULL OR absence_reason IN ('S', 'D', 'B'));
  END IF;
END $$;
