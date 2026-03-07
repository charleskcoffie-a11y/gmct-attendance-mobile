-- One-time script to create auth accounts for ALL existing members
-- Run this once to fix the member login issue

DO $$
DECLARE
  member_record RECORD;
  auth_user_id UUID;
  created_count INTEGER := 0;
  skipped_count INTEGER := 0;
BEGIN
  FOR member_record IN 
    SELECT id, email, name
    FROM public.members
  LOOP
    -- Check if auth user already exists for this email
    SELECT id INTO auth_user_id
    FROM auth.users
    WHERE email = member_record.email
    LIMIT 1;
    
    IF auth_user_id IS NULL THEN
      -- No auth user exists, we need to create one
      -- Note: This requires using Supabase's signup API from your application
      -- We cannot directly insert into auth.users as it causes issues
      RAISE NOTICE 'Member needs auth account: % (%)', member_record.name, member_record.email;
      created_count := created_count + 1;
    ELSE
      RAISE NOTICE 'Auth account exists: % (%)', member_record.name, member_record.email;
      skipped_count := skipped_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Summary: % members need auth accounts, % already have accounts', created_count, skipped_count;
END $$;
