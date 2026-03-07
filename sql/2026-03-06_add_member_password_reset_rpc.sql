-- Adds an RPC that lets admin reset a member password back to the default.
-- The function validates the provided admin password against app_settings.admin_password.
-- If the member doesn't have an auth user, it creates one with the default password.
-- If app_settings.admin_password is not present, it falls back to admin_code,
-- and finally to the default code 'admin123'.

CREATE OR REPLACE FUNCTION public.reset_member_password_to_default(
  p_member_id UUID,
  p_admin_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  configured_admin_code TEXT;
  has_app_settings_table BOOLEAN := false;
  has_admin_password_column BOOLEAN := false;
  has_admin_code_column BOOLEAN := false;
  default_password TEXT := 'gmct2026';
  v_member_name TEXT;
  v_member_email TEXT;
  v_auth_user_exists BOOLEAN := false;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'app_settings'
  )
  INTO has_app_settings_table;

  IF has_app_settings_table THEN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'app_settings'
        AND column_name = 'admin_password'
    )
    INTO has_admin_password_column;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'app_settings'
        AND column_name = 'admin_code'
    )
    INTO has_admin_code_column;

    IF has_admin_password_column THEN
      EXECUTE
        'SELECT COALESCE(NULLIF(TRIM(admin_password), ''''), ''admin123'')
         FROM public.app_settings
         WHERE id = ''app_settings''
         LIMIT 1'
      INTO configured_admin_code;
    ELSIF has_admin_code_column THEN
      EXECUTE
        'SELECT COALESCE(NULLIF(TRIM(admin_code), ''''), ''admin123'')
         FROM public.app_settings
         WHERE id = ''app_settings''
         LIMIT 1'
      INTO configured_admin_code;
    END IF;
  END IF;

  IF configured_admin_code IS NULL THEN
    configured_admin_code := 'admin123';
  END IF;

  IF COALESCE(LOWER(TRIM(p_admin_code)), '') <> LOWER(TRIM(configured_admin_code)) THEN
    RAISE EXCEPTION 'Invalid admin password';
  END IF;

  SELECT name, email
  INTO v_member_name, v_member_email
  FROM public.members
  WHERE id = p_member_id
  LIMIT 1;

  IF v_member_email IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  -- Check if auth user exists (IDs should be synced, so check by member ID)
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = p_member_id
  )
  INTO v_auth_user_exists;

  IF v_auth_user_exists THEN
    -- Update existing auth user password
    UPDATE auth.users
    SET
      encrypted_password = extensions.crypt(default_password, extensions.gen_salt('bf')),
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('password_changed', false),
      email_confirmed_at = NOW(),
      updated_at = NOW()
    WHERE id = p_member_id;
  ELSE
    -- Create new auth user with member ID as the auth user ID
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_user_meta_data,
      created_at,
      updated_at,
      aud,
      role
    )
    VALUES (
      p_member_id,
      '00000000-0000-0000-0000-000000000000',
      v_member_email,
      extensions.crypt(default_password, extensions.gen_salt('bf')),
      NOW(),
      jsonb_build_object('password_changed', false),
      NOW(),
      NOW(),
      'authenticated',
      'authenticated'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'member_id', p_member_id,
    'member_name', v_member_name,
    'email', v_member_email,
    'default_password', default_password,
    'auth_user_created', NOT v_auth_user_exists
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reset_member_password_to_default(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_member_password_to_default(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.reset_member_password_to_default(UUID, TEXT) TO authenticated;
