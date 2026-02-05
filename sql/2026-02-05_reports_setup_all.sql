-- Reports setup (single file)
-- Includes minister emails setting, report notes, and quarterly report tracking

-- 1) Add minister_emails column to app_settings
ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS minister_emails TEXT;

-- 2) Notes per member for monthly/quarterly reports
CREATE TABLE IF NOT EXISTS report_member_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_number TEXT NOT NULL,
  member_id UUID NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('monthly', 'quarterly')),
  period_key TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(class_number, member_id, report_type, period_key)
);

CREATE INDEX IF NOT EXISTS idx_report_notes_class_period ON report_member_notes(class_number, report_type, period_key);
CREATE INDEX IF NOT EXISTS idx_report_notes_member ON report_member_notes(member_id);

ALTER TABLE report_member_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_member_notes_allow_all" ON report_member_notes
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- 3) Track quarterly report confirmations
CREATE TABLE IF NOT EXISTS class_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_number TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('quarterly')),
  period_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'submitted')),
  submitted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(class_number, report_type, period_key)
);

CREATE INDEX IF NOT EXISTS idx_class_reports_class_period ON class_reports(class_number, report_type, period_key);

ALTER TABLE class_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_reports_allow_all" ON class_reports
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);
