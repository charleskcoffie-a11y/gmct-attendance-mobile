-- Diagnose and fix Supabase Auth role access issues
-- Run in Supabase SQL Editor as postgres

-- 1) Ensure auth service role can access schemas/tables/functions it needs
GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;
GRANT USAGE ON SCHEMA extensions TO supabase_auth_admin;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO supabase_auth_admin;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO supabase_auth_admin;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA auth
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO supabase_auth_admin;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA auth
GRANT USAGE, SELECT ON SEQUENCES TO supabase_auth_admin;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA auth
GRANT EXECUTE ON FUNCTIONS TO supabase_auth_admin;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA extensions
GRANT EXECUTE ON FUNCTIONS TO supabase_auth_admin;

-- 2) Verify member 100 rows still present
SELECT
  m.id AS member_id,
  m.member_number,
  m.email AS member_email,
  u.id AS auth_user_id,
  u.email AS auth_email,
  (u.encrypted_password IS NOT NULL) AS has_encrypted_password,
  i.id AS identity_id,
  i.provider_id AS identity_email
FROM public.members m
LEFT JOIN auth.users u ON u.id = m.id
LEFT JOIN auth.identities i ON i.user_id = m.id AND i.provider = 'email'
WHERE m.member_number = '100';

-- 3) Inspect grants without role impersonation (dashboard sessions cannot SET ROLE)
SELECT
  table_schema,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'supabase_auth_admin'
  AND table_schema = 'auth'
ORDER BY table_name, privilege_type;

SELECT
  routine_schema,
  routine_name,
  privilege_type
FROM information_schema.role_routine_grants
WHERE grantee = 'supabase_auth_admin'
  AND routine_schema IN ('auth', 'extensions')
ORDER BY routine_schema, routine_name, privilege_type;

-- 4) Show auth-table triggers that may break token flow
SELECT
  tg.tgname AS trigger_name,
  c.relname AS table_name,
  n.nspname AS schema_name,
  p.proname AS function_name
FROM pg_trigger tg
JOIN pg_class c ON c.oid = tg.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = tg.tgfoid
WHERE n.nspname = 'auth'
  AND c.relname IN ('users', 'identities')
  AND NOT tg.tgisinternal
ORDER BY c.relname, tg.tgname;

-- 5) Summary checks
SELECT COUNT(*) AS users_count FROM auth.users;
SELECT COUNT(*) AS email_identities_count FROM auth.identities WHERE provider = 'email';
