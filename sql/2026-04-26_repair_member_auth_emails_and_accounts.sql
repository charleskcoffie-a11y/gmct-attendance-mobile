-- Repairs member login data by backfilling missing auth emails and creating
-- missing auth.users rows using the member UUID as the auth user ID.
--
-- Audit missing emails/auth first with:
-- SELECT
--   m.id,
--   m.name,
--   m.class_number,
--   m.member_number,
--   m.email,
--   u.id AS auth_user_id,
--   u.email AS auth_email,
--   CASE
--     WHEN COALESCE(NULLIF(BTRIM(m.email), ''), '') = '' THEN 'missing member email'
--     WHEN u.id IS NULL THEN 'missing auth user'
--     ELSE 'ok'
--   END AS status
-- FROM public.members m
-- LEFT JOIN auth.users u ON u.id = m.id
-- ORDER BY m.name;

CREATE OR REPLACE FUNCTION public.member_login_email(
  p_class_number TEXT,
  p_member_number TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  preferred_identifier TEXT;
BEGIN
  preferred_identifier := COALESCE(
    NULLIF(BTRIM(p_member_number), ''),
    NULLIF(BTRIM(p_class_number), '')
  );

  IF preferred_identifier IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN LOWER(preferred_identifier) || '@gmct.member';
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_member_email_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  derived_email TEXT;
BEGIN
  derived_email := public.member_login_email(NEW.class_number, NEW.member_number);

  IF COALESCE(NULLIF(BTRIM(NEW.email), ''), '') = '' THEN
    IF derived_email IS NULL THEN
      RAISE EXCEPTION 'Member email cannot be blank when member_number and class_number are empty';
    END IF;

    NEW.email := derived_email;
  ELSE
    NEW.email := LOWER(BTRIM(NEW.email));
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_member_email_identity(
  p_user_id UUID,
  p_email TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  normalized_email TEXT;
  conflicting_identity_user UUID;
BEGIN
  normalized_email := LOWER(BTRIM(p_email));

  IF normalized_email IS NULL OR normalized_email = '' THEN
    RAISE EXCEPTION 'Auth identity email cannot be blank';
  END IF;

  SELECT i.user_id
  INTO conflicting_identity_user
  FROM auth.identities i
  WHERE i.provider = 'email'
    AND LOWER(BTRIM(i.provider_id)) = normalized_email
    AND i.user_id <> p_user_id
  LIMIT 1;

  IF conflicting_identity_user IS NOT NULL THEN
    RAISE EXCEPTION 'Auth email already exists under a different identity user';
  END IF;

  DELETE FROM auth.identities
  WHERE provider = 'email'
    AND user_id = p_user_id;

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
  VALUES (
    gen_random_uuid(),
    p_user_id,
    jsonb_build_object(
      'sub', p_user_id::text,
      'email', normalized_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    normalized_email,
    NOW(),
    NOW(),
    NOW()
  );
END;
$$;

DROP TRIGGER IF EXISTS ensure_member_email_before_write ON public.members;
CREATE TRIGGER ensure_member_email_before_write
  BEFORE INSERT OR UPDATE OF email, class_number, member_number ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_member_email_before_write();

UPDATE public.members
SET email = LOWER(BTRIM(email))
WHERE email IS NOT NULL
  AND email <> LOWER(BTRIM(email));

UPDATE public.members
SET email = public.member_login_email(class_number, member_number)
WHERE COALESCE(NULLIF(BTRIM(email), ''), '') = ''
  AND public.member_login_email(class_number, member_number) IS NOT NULL;

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
  v_member_class_number TEXT;
  v_member_number TEXT;
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

  SELECT name, email, class_number, member_number
  INTO v_member_name, v_member_email, v_member_class_number, v_member_number
  FROM public.members
  WHERE id = p_member_id
  LIMIT 1;

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

  UPDATE public.members
  SET email = v_member_email
  WHERE id = p_member_id
    AND COALESCE(NULLIF(LOWER(BTRIM(email)), ''), '') <> v_member_email;

  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = p_member_id
  )
  INTO v_auth_user_exists;

  IF v_auth_user_exists THEN
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
    WHERE id = p_member_id;
  ELSE
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
      p_member_id,
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
  END IF;

  PERFORM public.ensure_member_email_identity(p_member_id, v_member_email);

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

CREATE OR REPLACE FUNCTION public.repair_member_auth_accounts(
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
  member_record RECORD;
  target_email TEXT;
  existing_auth_id UUID;
  existing_auth_email TEXT;
  email_updated_count INTEGER := 0;
  created_results JSONB := '[]'::jsonb;
  skipped_results JSONB := '[]'::jsonb;
  error_results JSONB := '[]'::jsonb;
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

  FOR member_record IN
    SELECT id, name, email, class_number, member_number
    FROM public.members
    ORDER BY name
  LOOP
    BEGIN
      target_email := COALESCE(
        NULLIF(LOWER(BTRIM(member_record.email)), ''),
        public.member_login_email(member_record.class_number, member_record.member_number)
      );

      IF target_email IS NULL THEN
        error_results := error_results || jsonb_build_array(jsonb_build_object(
          'name', member_record.name,
          'email', member_record.email,
          'error', 'Missing both member_number and class_number, so auth email cannot be generated'
        ));
        CONTINUE;
      END IF;

      IF COALESCE(NULLIF(LOWER(BTRIM(member_record.email)), ''), '') <> target_email THEN
        UPDATE public.members
        SET email = target_email
        WHERE id = member_record.id;

        email_updated_count := email_updated_count + 1;
      END IF;

      SELECT id, email
      INTO existing_auth_id, existing_auth_email
      FROM auth.users
      WHERE id = member_record.id
      LIMIT 1;

      IF existing_auth_id IS NOT NULL THEN
        IF COALESCE(NULLIF(LOWER(BTRIM(existing_auth_email)), ''), '') <> target_email THEN
          UPDATE auth.users
          SET
            email = target_email,
            aud = 'authenticated',
            role = 'authenticated',
            raw_app_meta_data = COALESCE(raw_app_meta_data, '{"provider":"email","providers":["email"]}'::jsonb),
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            updated_at = NOW()
          WHERE id = member_record.id;
        END IF;

        PERFORM public.ensure_member_email_identity(member_record.id, target_email);

        skipped_results := skipped_results || jsonb_build_array(jsonb_build_object(
          'name', member_record.name,
          'email', target_email,
          'reason', 'Already has auth account'
        ));
        CONTINUE;
      END IF;

      SELECT id, email
      INTO existing_auth_id, existing_auth_email
      FROM auth.users
      WHERE LOWER(BTRIM(email)) = target_email
      LIMIT 1;

      IF existing_auth_id IS NOT NULL THEN
        skipped_results := skipped_results || jsonb_build_array(jsonb_build_object(
          'name', member_record.name,
          'email', target_email,
          'reason', 'Auth email already exists under a different auth user'
        ));
        CONTINUE;
      END IF;

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
        member_record.id,
        '00000000-0000-0000-0000-000000000000',
        target_email,
        extensions.crypt(default_password, extensions.gen_salt('bf')),
        NOW(),
        jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
        jsonb_build_object('password_changed', false),
        NOW(),
        NOW(),
        'authenticated',
        'authenticated'
      );

      PERFORM public.ensure_member_email_identity(member_record.id, target_email);

      created_results := created_results || jsonb_build_array(jsonb_build_object(
        'name', member_record.name,
        'email', target_email,
        'id', member_record.id
      ));
    EXCEPTION
      WHEN OTHERS THEN
        error_results := error_results || jsonb_build_array(jsonb_build_object(
          'name', member_record.name,
          'email', target_email,
          'error', SQLERRM
        ));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'default_password', default_password,
    'summary', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM public.members),
      'created', jsonb_array_length(created_results),
      'skipped', jsonb_array_length(skipped_results),
      'errors', jsonb_array_length(error_results),
      'emails_updated', email_updated_count
    ),
    'results', jsonb_build_object(
      'created', created_results,
      'skipped', skipped_results,
      'errors', error_results
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.repair_member_auth_accounts(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.repair_member_auth_accounts(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.repair_member_auth_accounts(TEXT) TO authenticated;
