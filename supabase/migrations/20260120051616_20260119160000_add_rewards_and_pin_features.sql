-- Add weekly target bonus configuration to families
ALTER TABLE families ADD COLUMN IF NOT EXISTS weekly_target_points integer DEFAULT 0;
ALTER TABLE families ADD COLUMN IF NOT EXISTS weekly_target_bonus numeric DEFAULT 0;

-- Add PIN login fields to family_members
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS pin_hash text;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS child_invite_code text UNIQUE;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS is_pin_user boolean DEFAULT false;

-- Create index for child_invite_code lookups
CREATE INDEX IF NOT EXISTS idx_family_members_child_invite_code ON family_members(child_invite_code) WHERE child_invite_code IS NOT NULL;


-- Create weekly earnings tracking table
CREATE TABLE IF NOT EXISTS weekly_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid REFERENCES families(id) ON DELETE CASCADE,
  member_id uuid REFERENCES family_members(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  points_earned integer DEFAULT 0,
  bonus_earned numeric DEFAULT 0,
  bonus_paid boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(member_id, week_start)
);

-- Enable RLS on weekly_earnings
ALTER TABLE weekly_earnings ENABLE ROW LEVEL SECURITY;

-- RLS policies for weekly_earnings
CREATE POLICY "Users can view own family weekly earnings"
  ON weekly_earnings FOR SELECT
  TO authenticated
  USING (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert weekly earnings"
  ON weekly_earnings FOR INSERT
  TO authenticated
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins can update weekly earnings"
  ON weekly_earnings FOR UPDATE
  TO authenticated
  USING (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid() AND is_admin = true
    )
  )
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Grant permissions
GRANT ALL ON weekly_earnings TO authenticated;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_weekly_earnings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER weekly_earnings_updated_at
  BEFORE UPDATE ON weekly_earnings
  FOR EACH ROW
  EXECUTE FUNCTION update_weekly_earnings_updated_at();

-- Create function to generate unique child invite code
CREATE OR REPLACE FUNCTION generate_child_invite_code()
RETURNS text AS $$
DECLARE
  code text;
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i integer;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..8 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    -- Check if code already exists
    IF NOT EXISTS (SELECT 1 FROM family_members WHERE child_invite_code = code) THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
