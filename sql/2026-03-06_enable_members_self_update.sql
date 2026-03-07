-- Allow members to update their own profile details.
-- Required for in-app member profile editing.
-- 
-- Members can ONLY update these fields:
--   - name, phone, address, city, province, postal_code, date_of_birth
--   - dob_month, dob_day, day_born (birthday details)
-- 
-- Members CANNOT update:
--   - email (auth identity)
--   - class_number (admin-controlled)
--   - member_number (admin-controlled)
--   - is_active (admin-controlled)
--   - id, created_at, updated_at (system fields)

ALTER TABLE members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can update their own data" ON members;

CREATE POLICY "Members can update their own data" ON members
  FOR UPDATE
  USING (LOWER(auth.jwt() ->> 'email') = LOWER(email))
  WITH CHECK (
    LOWER(auth.jwt() ->> 'email') = LOWER(email)
    AND email IS NOT DISTINCT FROM (SELECT email FROM members WHERE id = members.id)
    AND class_number IS NOT DISTINCT FROM (SELECT class_number FROM members WHERE id = members.id)
    AND member_number IS NOT DISTINCT FROM (SELECT member_number FROM members WHERE id = members.id)
    AND is_active IS NOT DISTINCT FROM (SELECT is_active FROM members WHERE id = members.id)
  );
