-- Fix auth.users table with proper required fields

-- Get the correct instance_id from existing auth config
DO $$
DECLARE
  correct_instance_id UUID;
BEGIN
  -- Try to get instance_id from auth.config or use a known good one
  SELECT instance_id INTO correct_instance_id
  FROM auth.users
  WHERE instance_id IS NOT NULL
  LIMIT 1;
  
  IF correct_instance_id IS NULL THEN
    -- If no existing users, we need to check auth.instances table
    SELECT id INTO correct_instance_id
    FROM auth.instances
    LIMIT 1;
  END IF;
  
  RAISE NOTICE 'Using instance_id: %', correct_instance_id;
  
  -- Update all member auth users with correct instance_id and ensure all required fields
  UPDATE auth.users u
  SET
    instance_id = COALESCE(correct_instance_id, '00000000-0000-0000-0000-000000000000'::uuid),
    confirmation_token = NULL,
    recovery_token = NULL,
    email_change_token_new = NULL,
    email_change = NULL,
    confirmed_at = COALESCE(email_confirmed_at, NOW()),
    last_sign_in_at = NULL,
    is_super_admin = false,
    phone = NULL,
    phone_confirmed_at = NULL,
    phone_change = NULL,
    phone_change_token = NULL,
    reauthentication_token = NULL,
    is_sso_user = false,
    deleted_at = NULL
  WHERE EXISTS (
    SELECT 1 FROM public.members m WHERE m.id = u.id
  );
  
  RAISE NOTICE 'Updated auth users with proper fields';
END $$;

-- Verify the fix
SELECT 
  id,
  email,
  instance_id,
  email_confirmed_at,
  aud,
  role
FROM auth.users
WHERE EXISTS (SELECT 1 FROM public.members m WHERE m.id = auth.users.id)
LIMIT 5;
