-- Add absence thresholds to app_settings
ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS monthly_absence_threshold INTEGER DEFAULT 4;

ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS quarterly_absence_threshold INTEGER DEFAULT 10;

-- Manual reports archive table
CREATE TABLE IF NOT EXISTS manual_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_number TEXT NOT NULL,
  report_date TIMESTAMP DEFAULT NOW(),
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  absence_types TEXT NOT NULL, -- JSON array: ["absent", "sick", "travel"]
  report_data JSONB NOT NULL, -- {memberId: {name, absent_count, sick_count, travel_count, total_absences}}
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manual_reports_class ON manual_reports(class_number);
CREATE INDEX IF NOT EXISTS idx_manual_reports_date ON manual_reports(report_date DESC);

ALTER TABLE manual_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manual_reports_allow_all" ON manual_reports
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);
