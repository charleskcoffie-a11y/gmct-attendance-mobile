-- Member contributions table
-- Supports member-facing contribution dashboard grouped by year/month/date.

CREATE TABLE IF NOT EXISTS member_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  contribution_date DATE NOT NULL,
  category TEXT NOT NULL CHECK (
    category IN (
      'tithe',
      'offering',
      'thanksgiving',
      'building_fund',
      'welfare',
      'special_seed',
      'other'
    )
  ),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_member_contributions_member_id
  ON member_contributions(member_id);

CREATE INDEX IF NOT EXISTS idx_member_contributions_date
  ON member_contributions(contribution_date DESC);

CREATE INDEX IF NOT EXISTS idx_member_contributions_member_date
  ON member_contributions(member_id, contribution_date DESC);

CREATE INDEX IF NOT EXISTS idx_member_contributions_category
  ON member_contributions(category);

-- Keep updated_at fresh on edits.
CREATE OR REPLACE FUNCTION update_member_contributions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_member_contributions_updated_at ON member_contributions;
CREATE TRIGGER set_member_contributions_updated_at
  BEFORE UPDATE ON member_contributions
  FOR EACH ROW
  EXECUTE FUNCTION update_member_contributions_updated_at();

ALTER TABLE member_contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Member contributions select own" ON member_contributions;
DROP POLICY IF EXISTS "Member contributions insert own" ON member_contributions;
DROP POLICY IF EXISTS "Member contributions update own" ON member_contributions;
DROP POLICY IF EXISTS "Member contributions delete own" ON member_contributions;
DROP POLICY IF EXISTS "Member contributions service role all" ON member_contributions;

CREATE POLICY "Member contributions select own" ON member_contributions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM members m
      WHERE m.id = member_contributions.member_id
        AND LOWER(m.email) = LOWER(auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "Member contributions insert own" ON member_contributions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM members m
      WHERE m.id = member_contributions.member_id
        AND LOWER(m.email) = LOWER(auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "Member contributions update own" ON member_contributions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM members m
      WHERE m.id = member_contributions.member_id
        AND LOWER(m.email) = LOWER(auth.jwt() ->> 'email')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM members m
      WHERE m.id = member_contributions.member_id
        AND LOWER(m.email) = LOWER(auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "Member contributions delete own" ON member_contributions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM members m
      WHERE m.id = member_contributions.member_id
        AND LOWER(m.email) = LOWER(auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "Member contributions service role all" ON member_contributions
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
