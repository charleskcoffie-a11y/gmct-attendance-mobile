-- One-row diagnostic report for Supabase Auth 500 errors
-- Run in Supabase SQL Editor as postgres

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
  ]) AS col
),
actual_cols AS (
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'auth' AND table_name = 'users'
),
missing_cols AS (
  SELECT col
  FROM required_cols r
  LEFT JOIN actual_cols a ON a.column_name = r.col
  WHERE a.column_name IS NULL
),
custom_triggers AS (
  SELECT json_agg(json_build_object(
    'trigger_name', tg.tgname,
    'table_name', c.relname,
    'function_name', p.proname
  )) AS items
  FROM pg_trigger tg
  JOIN pg_class c ON c.oid = tg.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_proc p ON p.oid = tg.tgfoid
  WHERE n.nspname = 'auth'
    AND c.relname IN ('users', 'identities')
    AND NOT tg.tgisinternal
),
dup_user_emails AS (
  SELECT json_agg(json_build_object('email', email_norm, 'count', duplicate_count)) AS items
  FROM (
    SELECT LOWER(BTRIM(email)) AS email_norm, COUNT(*) AS duplicate_count
    FROM auth.users
    WHERE email IS NOT NULL AND BTRIM(email) <> ''
    GROUP BY LOWER(BTRIM(email))
    HAVING COUNT(*) > 1
    ORDER BY duplicate_count DESC, email_norm
    LIMIT 20
  ) d
),
dup_identities AS (
  SELECT json_agg(json_build_object('provider_id', provider_id_norm, 'count', duplicate_count)) AS items
  FROM (
    SELECT LOWER(BTRIM(provider_id)) AS provider_id_norm, COUNT(*) AS duplicate_count
    FROM auth.identities
    WHERE provider = 'email'
    GROUP BY LOWER(BTRIM(provider_id))
    HAVING COUNT(*) > 1
    ORDER BY duplicate_count DESC, provider_id_norm
    LIMIT 20
  ) d
),
member_100 AS (
  SELECT json_build_object(
    'member_exists', (m.id IS NOT NULL),
    'member_number', m.member_number,
    'member_email', m.email,
    'auth_user_id', u.id,
    'auth_email', u.email,
    'has_encrypted_password', (u.encrypted_password IS NOT NULL),
    'identity_id', i.id,
    'identity_email', i.provider_id
  ) AS info
  FROM public.members m
  LEFT JOIN auth.users u ON u.id = m.id
  LEFT JOIN auth.identities i ON i.user_id = m.id AND i.provider = 'email'
  WHERE m.member_number = '100'
  LIMIT 1
)
SELECT
  (SELECT COUNT(*) FROM auth.schema_migrations) AS schema_migrations_count,
  (SELECT COUNT(*) FROM auth.users) AS users_count,
  (SELECT COUNT(*) FROM auth.identities WHERE provider = 'email') AS email_identities_count,
  (SELECT COUNT(*) FROM missing_cols) AS missing_required_user_columns,
  COALESCE((SELECT json_agg(col) FROM missing_cols), '[]'::json) AS missing_columns_list,
  COALESCE((SELECT items FROM custom_triggers), '[]'::json) AS custom_auth_triggers,
  COALESCE((SELECT items FROM dup_user_emails), '[]'::json) AS duplicate_user_emails,
  COALESCE((SELECT items FROM dup_identities), '[]'::json) AS duplicate_identity_provider_ids,
  COALESCE((SELECT info FROM member_100), '{}'::json) AS member_100_status;
