-- Create member_attendance table for storing individual member attendance records
-- This table tracks which members were present/absent/sick/travel for each attendance event

CREATE TABLE IF NOT EXISTS member_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  class_number TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'sick', 'travel')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(attendance_id, member_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_member_attendance_attendance_id ON member_attendance(attendance_id);
CREATE INDEX IF NOT EXISTS idx_member_attendance_member_id ON member_attendance(member_id);
CREATE INDEX IF NOT EXISTS idx_member_attendance_class_number ON member_attendance(class_number);

-- Enable RLS (Row Level Security)
ALTER TABLE member_attendance ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to read/write member_attendance for attendance marking
CREATE POLICY "member_attendance_allow_all" ON member_attendance
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);
