-- Add dev_fund_pledge column to members table
-- This tracks whether a member has pledged to contribute to the development fund

-- Add the column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'members' 
    AND column_name = 'dev_fund_pledge'
  ) THEN
    ALTER TABLE members ADD COLUMN dev_fund_pledge BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_members_dev_fund_pledge ON members(dev_fund_pledge);

-- Update existing members who should have the pledge (optional - adjust as needed)
-- Example: UPDATE members SET dev_fund_pledge = true WHERE <your criteria>;
