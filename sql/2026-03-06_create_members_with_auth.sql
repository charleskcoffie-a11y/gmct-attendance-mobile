-- Create members table with Supabase Auth integration
-- This allows members to login using their class_number (converted to email format)
-- Email format: {class_number}@gmct.member (e.g., a123@gmct.member)

-- Create members table if it doesn't exist
CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  class_number TEXT,
  member_number TEXT,
  address TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  phone TEXT,
  date_of_birth DATE,
  dob_month INTEGER,
  dob_day INTEGER,
  day_born TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_members_class_number ON members(class_number);
CREATE INDEX IF NOT EXISTS idx_members_is_active ON members(is_active);

-- Enable Row Level Security
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Members can view their own data" ON members;
DROP POLICY IF EXISTS "Admin can view all members" ON members;
DROP POLICY IF EXISTS "Admin can insert members" ON members;
DROP POLICY IF EXISTS "Admin can update members" ON members;
DROP POLICY IF EXISTS "Service role can do anything" ON members;

-- RLS Policies
-- Members can view their own data
CREATE POLICY "Members can view their own data" ON members
  FOR SELECT
  USING (auth.jwt() ->> 'email' = email);

-- Admin users can view all members (class_number = -1 is admin)
CREATE POLICY "Admin can view all members" ON members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM class_leaders
      WHERE class_leaders.class_number = '-1'
      AND class_leaders.active = true
    )
  );

-- Admin can insert new members
CREATE POLICY "Admin can insert members" ON members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM class_leaders
      WHERE class_leaders.class_number = '-1'
      AND class_leaders.active = true
    )
  );

-- Admin can update members
CREATE POLICY "Admin can update members" ON members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM class_leaders
      WHERE class_leaders.class_number = '-1'
      AND class_leaders.active = true
    )
  );

-- Service role can do anything (for system operations)
CREATE POLICY "Service role can do anything" ON members
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS set_members_updated_at ON members;
CREATE TRIGGER set_members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW
  EXECUTE FUNCTION update_members_updated_at();

-- Function to create auth user when member is added
-- This creates a Supabase auth user with email format: {class_number}@gmct.member
CREATE OR REPLACE FUNCTION create_member_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  default_password TEXT := 'gmct2026'; -- Default password for first-time login
BEGIN
  -- Only create auth user if email doesn't exist in auth.users
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = NEW.email) THEN
    -- Insert into auth.users with default password
    -- This will trigger the user to change password on first login
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      NEW.id,
      'authenticated',
      'authenticated',
      NEW.email,
      crypt(default_password, gen_salt('bf')),
      NOW(),
      jsonb_build_object(
        'name', NEW.name,
        'class_number', NEW.class_number,
        'password_changed', false
      ),
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-create auth user
DROP TRIGGER IF EXISTS create_auth_user_on_member_insert ON members;
CREATE TRIGGER create_auth_user_on_member_insert
  AFTER INSERT ON members
  FOR EACH ROW
  EXECUTE FUNCTION create_member_auth_user();

-- Helper function to convert class_number to email format
-- Usage: SELECT class_number_to_email('A123') returns 'a123@gmct.member'
CREATE OR REPLACE FUNCTION class_number_to_email(class_num TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(class_num) || '@gmct.member';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper function to extract class_number from email
-- Usage: SELECT email_to_class_number('a123@gmct.member') returns 'a123'
CREATE OR REPLACE FUNCTION email_to_class_number(email_addr TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN SPLIT_PART(email_addr, '@', 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Sample data (optional - remove if not needed)
-- Uncomment to insert sample members for testing
/*
INSERT INTO members (email, name, class_number, phone, is_active) VALUES
  ('a001@gmct.member', 'John Doe', 'A001', '555-0001', true),
  ('a002@gmct.member', 'Jane Smith', 'A002', '555-0002', true),
  ('b001@gmct.member', 'Bob Johnson', 'B001', '555-0003', true)
ON CONFLICT (email) DO NOTHING;
*/

COMMENT ON TABLE members IS 'Church members with authentication via Supabase Auth. Email format: {class_number}@gmct.member';
COMMENT ON COLUMN members.email IS 'Authentication email in format: {class_number}@gmct.member (lowercase)';
COMMENT ON COLUMN members.class_number IS 'Member class/ID number (e.g., A123, B456)';
COMMENT ON FUNCTION class_number_to_email(TEXT) IS 'Converts class number to email format for authentication';
COMMENT ON FUNCTION email_to_class_number(TEXT) IS 'Extracts class number from authentication email';
