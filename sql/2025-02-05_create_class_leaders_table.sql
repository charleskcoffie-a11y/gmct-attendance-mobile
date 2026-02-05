-- Create class_leaders table if it doesn't exist
-- This table stores the credentials for class leaders

CREATE TABLE IF NOT EXISTS class_leaders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_number INT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT,
  last_updated TIMESTAMP DEFAULT NOW()
);

-- Create an index on class_number for faster lookups during login
CREATE INDEX IF NOT EXISTS idx_class_leaders_class_number ON class_leaders(class_number);

-- Create a composite index for login validation (class_number + password + active status)
CREATE INDEX IF NOT EXISTS idx_class_leaders_login ON class_leaders(class_number, active);

-- Enable RLS (Row Level Security) for class leaders table
ALTER TABLE class_leaders ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to read class_leaders for login validation
CREATE POLICY "class_leaders_allow_login" ON class_leaders
  FOR SELECT
  TO anon
  USING (true);
