-- Align class leader email with member auth email where possible.
-- This helps role detection resolve class leaders from authenticated member accounts.

UPDATE class_leaders cl
SET email = LOWER(TRIM(m.email))
FROM members m
WHERE LOWER(TRIM(m.name)) = LOWER(TRIM(cl.full_name))
  AND m.email IS NOT NULL
  AND TRIM(m.email) <> ''
  AND (cl.email IS NULL OR LOWER(TRIM(cl.email)) <> LOWER(TRIM(m.email)));
