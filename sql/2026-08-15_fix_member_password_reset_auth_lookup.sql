-- Reset member passwords against the Auth account used by member login.
-- Some older accounts have an Auth UUID different from members.id.

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
  default_password TEXT := 'gmct2026';
  v_member_name TEXT;
  v_member_email TEXT;
  v_member_class_number TEXT;
  v_member_number TEXT;
  v_auth_user_id UUID;
  v_auth_user_created BOOLEAN := false;
  has_app_settings_table BOOLEAN := false;
  has_attendance_admin_password_column BOOLEAN := false;
  has_admin_password_column BOOLEAN := false;
  has_admin_code_column BOOLEAN := false;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'app_settings'
  )
  INTO has_app_settings_table;

  IF has_app_settings_table THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'app_settings'
        AND column_name = 'attendance_admin_password'
    ) INTO has_attendance_admin_password_column;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'app_settings'
        AND column_name = 'admin_password'
    ) INTO has_admin_password_column;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'app_settings'
        AND column_name = 'admin_code'
    ) INTO has_admin_code_column;

    IF has_attendance_admin_password_column THEN
      EXECUTE
        'SELECT COALESCE(NULLIF(TRIM(attendance_admin_password), ''''), NULLIF(TRIM(admin_password), ''''), ''admin123'')
         FROM public.app_settings WHERE id = ''app_settings'' LIMIT 1'
      INTO configured_admin_code;
    ELSIF has_admin_password_column THEN
      EXECUTE
        'SELECT COALESCE(NULLIF(TRIM(admin_password), ''''), ''admin123'')
         FROM public.app_settings WHERE id = ''app_settings'' LIMIT 1'
      INTO configured_admin_code;
    ELSIF has_admin_code_column THEN
      EXECUTE
        'SELECT COALESCE(NULLIF(TRIM(admin_code), ''''), ''admin123'')
         FROM public.app_settings WHERE id = ''app_settings'' LIMIT 1'
      INTO configured_admin_code;
    END IF;
  END IF;

  IF configured_admin_code IS NULL THEN
    configured_admin_code := 'admin123';
  END IF;

  IF COALESCE(LOWER(TRIM(p_admin_code)), '') <> LOWER(TRIM(configured_admin_code)) THEN
    RAISE EXCEPTION 'Invalid admin password';
  END IF;

  SELECT name, email, class_number, member_number
  INTO v_member_name, v_member_email, v_member_class_number, v_member_number
  FROM public.members
  WHERE id = p_member_id;

  IF v_member_name IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  v_member_email := COALESCE(
    NULLIF(LOWER(BTRIM(v_member_email)), ''),
    public.member_login_email(v_member_class_number, v_member_number)
  );

  IF v_member_email IS NULL THEN
    RAISE EXCEPTION 'Member is missing both member number and class number, so auth email cannot be generated';
  END IF;

  -- Login resolves the account by this email. Prefer the linked member UUID,
  -- then fall back to the email account used by older sign-up flows.
  SELECT id
  INTO v_auth_user_id
  FROM auth.users
  WHERE id = p_member_id
     OR LOWER(BTRIM(email)) = v_member_email
  ORDER BY (id = p_member_id) DESC
  LIMIT 1;

  IF v_auth_user_id IS NULL THEN
    v_auth_user_id := p_member_id;
    v_auth_user_created := true;

    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      aud,
      role
    )
    VALUES (
      v_auth_user_id,
      '00000000-0000-0000-0000-000000000000',
      v_member_email,
      extensions.crypt(default_password, extensions.gen_salt('bf')),
      NOW(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('password_changed', false),
      NOW(),
      NOW(),
      'authenticated',
      'authenticated'
    );
  ELSE
    UPDATE auth.users
    SET
      email = v_member_email,
      aud = 'authenticated',
      role = 'authenticated',
      encrypted_password = extensions.crypt(default_password, extensions.gen_salt('bf')),
      raw_app_meta_data = COALESCE(raw_app_meta_data, '{"provider":"email","providers":["email"]}'::jsonb),
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('password_changed', false),
      email_confirmed_at = NOW(),
      updated_at = NOW()
    WHERE id = v_auth_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'member_id', p_member_id,
    'member_name', v_member_name,
    'email', v_member_email,
    'auth_user_id', v_auth_user_id,
    'default_password', default_password,
    'auth_user_created', v_auth_user_created
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reset_member_password_to_default(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_member_password_to_default(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.reset_member_password_to_default(UUID, TEXT) TO authenticated;