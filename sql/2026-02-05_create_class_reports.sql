-- Track quarterly report confirmations

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
