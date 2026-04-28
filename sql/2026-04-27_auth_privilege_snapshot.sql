-- Final one-row privilege snapshot for Supabase Auth service role
-- Run in Supabase SQL Editor as postgres

WITH t AS (
  SELECT unnest(ARRAY[
    'users',
    'identities',
    'sessions',
    'refresh_tokens',
    'flow_state',
    'one_time_tokens',
    'mfa_factors',
    'mfa_challenges',
    'mfa_amr_claims',
    'schema_migrations'
  ]) AS table_name
),
privs AS (
  SELECT
    table_name,
    has_table_privilege('supabase_auth_admin', format('auth.%I', table_name), 'SELECT') AS can_select,
    has_table_privilege('supabase_auth_admin', format('auth.%I', table_name), 'INSERT') AS can_insert,
    has_table_privilege('supabase_auth_admin', format('auth.%I', table_name), 'UPDATE') AS can_update,
    has_table_privilege('supabase_auth_admin', format('auth.%I', table_name), 'DELETE') AS can_delete
  FROM t
),
bad_tables AS (
  SELECT json_agg(json_build_object(
    'table', table_name,
    'select', can_select,
    'insert', can_insert,
    'update', can_update,
    'delete', can_delete
  )) AS items
  FROM privs
  WHERE NOT (can_select AND can_insert AND can_update AND can_delete)
),
schema_usage AS (
  SELECT
    has_schema_privilege('supabase_auth_admin', 'auth', 'USAGE') AS auth_usage,
    has_schema_privilege('supabase_auth_admin', 'extensions', 'USAGE') AS extensions_usage,
    has_schema_privilege('supabase_auth_admin', 'public', 'USAGE') AS public_usage
),
ext_privs AS (
  SELECT json_agg(json_build_object(
    'routine_name', routine_name,
    'privilege', privilege_type
  )) AS items
  FROM information_schema.role_routine_grants
  WHERE grantee = 'supabase_auth_admin'
    AND routine_schema = 'extensions'
    AND routine_name IN ('crypt', 'gen_salt')
),
role_table_count AS (
  SELECT COUNT(*) AS grants_count
  FROM information_schema.role_table_grants
  WHERE grantee = 'supabase_auth_admin'
    AND table_schema = 'auth'
),
api_key_role AS (
  SELECT 'anon'::text AS expected_anon_role
)
SELECT
  (SELECT auth_usage FROM schema_usage) AS has_auth_schema_usage,
  (SELECT extensions_usage FROM schema_usage) AS has_extensions_schema_usage,
  (SELECT public_usage FROM schema_usage) AS has_public_schema_usage,
  (SELECT grants_count FROM role_table_count) AS auth_table_grants_count,
  COALESCE((SELECT items FROM bad_tables), '[]'::json) AS tables_missing_full_crud,
  COALESCE((SELECT items FROM ext_privs), '[]'::json) AS extension_function_grants,
  (SELECT COUNT(*) FROM auth.users) AS users_count,
  (SELECT COUNT(*) FROM auth.identities WHERE provider = 'email') AS email_identities_count,
  (SELECT COUNT(*) FROM auth.schema_migrations) AS schema_migrations_count,
  (SELECT expected_anon_role FROM api_key_role) AS expected_anon_role;
