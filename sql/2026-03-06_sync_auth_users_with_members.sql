-- Sync auth.users IDs to match members table IDs
-- This ensures the member UUID is the single source of truth across all tables

-- Step 1: Delete all auth users whose IDs don't match their member IDs
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete auth users where the email exists in members but ID doesn't match
  DELETE FROM auth.users u
  WHERE EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.email = u.email
    AND m.id != u.id
  );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % mismatched auth users', deleted_count;
END $$;

-- Step 2: Create auth users for all active members using member ID
DO $$
DECLARE
  member_record RECORD;
  created_count INTEGER := 0;
BEGIN
  FOR member_record IN 
    SELECT m.id as member_id, m.email, m.name
    FROM public.members m
    WHERE NOT EXISTS (
      SELECT 1 FROM auth.users u WHERE u.id = m.id
    )
  LOOP
    -- Create auth user with member ID
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
      member_record.member_id,
      '00000000-0000-0000-0000-000000000000',
      member_record.email,
      extensions.crypt('gmct2026', extensions.gen_salt('bf')),
      NOW(),
      jsonb_build_object('password_changed', false),
      NOW(),
      NOW(),
      'authenticated',
      'authenticated'
    )
    ON CONFLICT (id) DO NOTHING;
    
    created_count := created_count + 1;
    RAISE NOTICE 'Created auth user for: % (%)', member_record.name, member_record.email;
  END LOOP;
  
  RAISE NOTICE 'Created % new auth users', created_count;
END $$;

-- Verify the sync
SELECT 
  m.id as member_id,
  m.name,
  m.email,
  u.id as auth_user_id,
  CASE 
    WHEN m.id = u.id THEN '✓ Synced'
    WHEN u.id IS NULL THEN '✗ No auth user'
    ELSE '✗ ID mismatch'
  END as status
FROM public.members m
LEFT JOIN auth.users u ON u.email = m.email
ORDER BY m.name;
