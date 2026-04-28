-- Deep diagnostics for Supabase Auth 500: "Database error querying schema"
-- Run as postgres in Supabase SQL Editor

-- 1) Core auth tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'auth'
ORDER BY table_name;

-- 2) auth.users columns currently present
SELECT
  ordinal_position,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'auth'
  AND table_name = 'users'
ORDER BY ordinal_position;

-- 3) Check for required auth.users columns often used by GoTrue
WITH required_cols AS (
  SELECT unnest(ARRAY[
    'id',
    'aud',
    'role',
    'email',
    'encrypted_password',
    'email_confirmed_at',
    'last_sign_in_at',
    'raw_app_meta_data',
    'raw_user_meta_data',
    'created_at',
    'updated_at',
    'is_sso_user',
    'is_anonymous'
  ]) AS column_name
), actual_cols AS (
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'auth'
    AND table_name = 'users'
)
SELECT
  r.column_name,
  CASE WHEN a.column_name IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM required_cols r
LEFT JOIN actual_cols a USING (column_name)
ORDER BY r.column_name;

-- 4) auth.users constraints/indexes
SELECT
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
 AND tc.table_name = kcu.table_name
WHERE tc.table_schema = 'auth'
  AND tc.table_name = 'users'
ORDER BY tc.constraint_type, tc.constraint_name, kcu.ordinal_position;

SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'auth'
  AND tablename IN ('users', 'identities')
ORDER BY tablename, indexname;

-- 5) Check for malformed key auth rows
SELECT
  COUNT(*) AS null_id_count
FROM auth.users
WHERE id IS NULL;

SELECT
  COUNT(*) AS null_email_count
FROM auth.users
WHERE email IS NULL OR BTRIM(email) = '';

SELECT
  LOWER(BTRIM(email)) AS email_norm,
  COUNT(*) AS duplicate_count
FROM auth.users
WHERE email IS NOT NULL AND BTRIM(email) <> ''
GROUP BY LOWER(BTRIM(email))
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, email_norm
LIMIT 50;

SELECT
  provider,
  LOWER(BTRIM(provider_id)) AS provider_id_norm,
  COUNT(*) AS duplicate_count
FROM auth.identities
WHERE provider = 'email'
GROUP BY provider, LOWER(BTRIM(provider_id))
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, provider_id_norm
LIMIT 50;

-- 6) Check non-internal triggers/functions on auth tables
SELECT
  tg.tgname AS trigger_name,
  c.relname AS table_name,
  p.proname AS function_name
FROM pg_trigger tg
JOIN pg_class c ON c.oid = tg.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = tg.tgfoid
WHERE n.nspname = 'auth'
  AND c.relname IN ('users', 'identities')
  AND NOT tg.tgisinternal
ORDER BY c.relname, tg.tgname;

-- 7) Count checks
SELECT COUNT(*) AS users_count FROM auth.users;
SELECT COUNT(*) AS email_identities_count FROM auth.identities WHERE provider = 'email';
SELECT COUNT(*) AS schema_migrations_count FROM auth.schema_migrations;
