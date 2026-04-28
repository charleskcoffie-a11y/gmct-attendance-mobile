-- GMCT auth emergency repair script
-- Run in Supabase SQL Editor as role postgres

-- 0) Remove custom objects that may interfere with auth
DROP TRIGGER IF EXISTS ensure_member_email_before_write ON public.members;
DROP FUNCTION IF EXISTS public.ensure_member_email_before_write() CASCADE;
DROP FUNCTION IF EXISTS public.ensure_member_email_identity(uuid, text) CASCADE;

-- 1) Repair auth service permissions
GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA auth
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO supabase_auth_admin;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA auth
GRANT USAGE, SELECT ON SEQUENCES TO supabase_auth_admin;

-- 2) Attempt to disable RLS on core auth tables (safe skip if not owner)
DO $$
BEGIN
  BEGIN
    ALTER TABLE IF EXISTS auth.users DISABLE ROW LEVEL SECURITY;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipped: no ownership privilege on auth.users';
  END;

  BEGIN
    ALTER TABLE IF EXISTS auth.identities DISABLE ROW LEVEL SECURITY;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipped: no ownership privilege on auth.identities';
  END;

  BEGIN
    ALTER TABLE IF EXISTS auth.sessions DISABLE ROW LEVEL SECURITY;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipped: no ownership privilege on auth.sessions';
  END;

  BEGIN
    ALTER TABLE IF EXISTS auth.refresh_tokens DISABLE ROW LEVEL SECURITY;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipped: no ownership privilege on auth.refresh_tokens';
  END;

  BEGIN
    ALTER TABLE IF EXISTS auth.flow_state DISABLE ROW LEVEL SECURITY;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipped: no ownership privilege on auth.flow_state';
  END;

  BEGIN
    ALTER TABLE IF EXISTS auth.one_time_tokens DISABLE ROW LEVEL SECURITY;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipped: no ownership privilege on auth.one_time_tokens';
  END;
END $$;

-- 3) Remove orphan email identities
DELETE FROM auth.identities i
WHERE i.provider = 'email'
  AND NOT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = i.user_id
  );

-- 4) Deduplicate email identities by provider_id (keep most recent)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY provider, LOWER(BTRIM(provider_id))
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM auth.identities
  WHERE provider = 'email'
)
DELETE FROM auth.identities i
USING ranked r
WHERE i.id = r.id
  AND r.rn > 1;

-- 5) Rebuild missing email identity rows from auth.users
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  u.id,
  jsonb_build_object(
    'sub', u.id::text,
    'email', LOWER(BTRIM(u.email)),
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  LOWER(BTRIM(u.email)),
  NOW(),
  NOW(),
  NOW()
FROM auth.users u
LEFT JOIN auth.identities i
  ON i.user_id = u.id
 AND i.provider = 'email'
WHERE u.email IS NOT NULL
  AND BTRIM(u.email) <> ''
  AND i.id IS NULL;

-- 6) Normalize auth user data
UPDATE auth.users
SET email = LOWER(BTRIM(email)),
    aud = COALESCE(NULLIF(aud, ''), 'authenticated'),
    role = COALESCE(NULLIF(role, ''), 'authenticated'),
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    updated_at = NOW()
WHERE email IS NOT NULL
  AND BTRIM(email) <> '';

-- 7) Reset known test account password (member 100)
UPDATE auth.users
SET encrypted_password = extensions.crypt('gmct2026', extensions.gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    updated_at = NOW()
WHERE LOWER(BTRIM(email)) = '100@gmct.member';

-- 8) Verification
SELECT COUNT(*) AS users_count FROM auth.users;
SELECT COUNT(*) AS email_identities_count FROM auth.identities WHERE provider = 'email';

SELECT
  m.member_number,
  m.email AS member_email,
  u.id AS auth_user_id,
  u.email AS auth_email,
  i.provider_id AS identity_email
FROM public.members m
LEFT JOIN auth.users u ON u.id = m.id
LEFT JOIN auth.identities i ON i.user_id = m.id AND i.provider = 'email'
WHERE m.member_number = '100';
