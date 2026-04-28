-- Fix for HTTP 500 auth error:
-- "error finding user: sql: Scan error on column confirmation_token: converting NULL to string is unsupported"
-- Supabase Support recommended fix: set confirmation_token to '' where NULL

UPDATE auth.users
SET confirmation_token = ''
WHERE confirmation_token IS NULL;
