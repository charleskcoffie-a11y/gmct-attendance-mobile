-- Update existing class leaders emails to the new format: {lowercase_name_with_underscore}@gmct.member
-- This ensures existing class leaders use the unified authentication system

UPDATE class_leaders
SET email = LOWER(REPLACE(REPLACE(full_name, ' ', '_'), '-', '_')) || '@gmct.member'
WHERE email IS NULL 
   OR email NOT LIKE '%@gmct.member';

-- Example result:
-- John Smith → john_smith@gmct.member
-- Jane Doe → jane_doe@gmct.member
-- Mike Johnson → mike_johnson@gmct.member

-- Note: If you have class leaders with custom emails that should NOT be changed,
-- you can manually update them after running this script, or modify the WHERE clause above
-- to exclude specific conditions.
