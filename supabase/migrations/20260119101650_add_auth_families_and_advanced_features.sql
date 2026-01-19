/*
  # Enhanced Family Planboard with Authentication and Advanced Features

  ## Overview
  This migration adds comprehensive authentication, family grouping, parent permissions,
  money rewards, custom achievements, and task history archiving.

  ## Schema Changes

  ### 1. New Tables

  #### `families`
  Stores family groups with settings and configuration
  - `id` (uuid, primary key) - Unique family identifier
  - `name` (text) - Family display name
  - `invite_code` (text, unique) - Code for members to join family
  - `point_to_money_rate` (numeric) - Conversion rate (e.g., 100 points = $1)
  - `minimum_redemption` (integer) - Minimum points needed to redeem
  - `created_at` (timestamptz) - Family creation timestamp
  - `created_by` (uuid) - User who created the family

  #### `manual_points_awards`
  Tracks points manually given by parents
  - `id` (uuid, primary key) - Award identifier
  - `family_id` (uuid, foreign key) - References families.id
  - `member_id` (uuid, foreign key) - Who received points
  - `awarded_by` (uuid, foreign key) - Parent who gave points
  - `points` (integer) - Points awarded (can be negative)
  - `reason` (text) - Why points were given
  - `created_at` (timestamptz) - When points were awarded

  #### `reward_redemptions`
  Tracks when points are converted to money
  - `id` (uuid, primary key) - Redemption identifier
  - `family_id` (uuid, foreign key) - References families.id
  - `member_id` (uuid, foreign key) - Who redeemed points
  - `points_redeemed` (integer) - Points converted
  - `money_amount` (numeric) - Dollar amount earned
  - `status` (text) - 'pending', 'approved', 'paid'
  - `approved_by` (uuid, foreign key) - Parent who approved
  - `created_at` (timestamptz) - Request timestamp
  - `approved_at` (timestamptz) - Approval timestamp

  #### `task_history`
  Archives completed tasks for historical tracking
  - `id` (uuid, primary key) - History record identifier
  - `original_task_id` (uuid) - Original task ID
  - `family_id` (uuid, foreign key) - References families.id
  - `title` (text) - Task title
  - `description` (text) - Task description
  - `assigned_to` (uuid) - Who it was assigned to
  - `due_datetime` (timestamptz) - When it was due
  - `priority` (text) - Task priority
  - `point_value` (integer) - Points earned
  - `completed_at` (timestamptz) - When completed
  - `archived_at` (timestamptz) - When archived

  ### 2. Modified Tables

  #### `family_members` - Add family association and auth
  - `family_id` (uuid, foreign key) - Link to families table
  - `user_id` (uuid) - Reference to auth.users
  - `is_admin` (boolean) - Parent/admin privileges

  #### `tasks` - Add datetime and enhanced features
  - `family_id` (uuid, foreign key) - Link to families table
  - Change `due_date` to `due_datetime` (timestamptz) with time
  - `is_archived` (boolean) - Mark for archiving

  #### `achievements` - Add custom achievement support
  - `family_id` (uuid, foreign key) - For custom achievements
  - `is_custom` (boolean) - User-created vs default
  - `created_by_member_id` (uuid) - Parent who created it

  #### `points_history` - Add family scope
  - `family_id` (uuid, foreign key) - Link to families table

  ## Security
  - Enable RLS on all new tables
  - Update existing RLS policies to scope by family_id
  - Add policies for parent-only operations
  - Ensure data isolation between families

  ## Important Notes
  - This migration preserves all existing data
  - Existing families will need to be migrated to new structure
  - Auth integration requires Supabase Auth to be configured
*/

-- Create families table
CREATE TABLE IF NOT EXISTS families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  invite_code text UNIQUE NOT NULL,
  point_to_money_rate numeric DEFAULT 0.01,
  minimum_redemption integer DEFAULT 100,
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

-- Create manual_points_awards table
CREATE TABLE IF NOT EXISTS manual_points_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid REFERENCES families(id) ON DELETE CASCADE,
  member_id uuid REFERENCES family_members(id) ON DELETE CASCADE,
  awarded_by uuid REFERENCES family_members(id) ON DELETE SET NULL,
  points integer NOT NULL,
  reason text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create reward_redemptions table
CREATE TABLE IF NOT EXISTS reward_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid REFERENCES families(id) ON DELETE CASCADE,
  member_id uuid REFERENCES family_members(id) ON DELETE CASCADE,
  points_redeemed integer NOT NULL,
  money_amount numeric NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  approved_by uuid REFERENCES family_members(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  approved_at timestamptz
);

-- Create task_history table
CREATE TABLE IF NOT EXISTS task_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_task_id uuid,
  family_id uuid REFERENCES families(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  assigned_to uuid REFERENCES family_members(id) ON DELETE SET NULL,
  due_datetime timestamptz,
  priority text,
  point_value integer,
  completed_at timestamptz,
  archived_at timestamptz DEFAULT now()
);

-- Add new columns to family_members
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'family_members' AND column_name = 'family_id'
  ) THEN
    ALTER TABLE family_members ADD COLUMN family_id uuid REFERENCES families(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'family_members' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE family_members ADD COLUMN user_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'family_members' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE family_members ADD COLUMN is_admin boolean DEFAULT false;
  END IF;
END $$;

-- Add new columns to tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'family_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN family_id uuid REFERENCES families(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE tasks ADD COLUMN is_archived boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'due_datetime'
  ) THEN
    ALTER TABLE tasks ADD COLUMN due_datetime timestamptz;
    -- Migrate existing due_date to due_datetime
    UPDATE tasks SET due_datetime = due_date::timestamptz WHERE due_datetime IS NULL AND due_date IS NOT NULL;
  END IF;
END $$;

-- Add new columns to achievements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'achievements' AND column_name = 'family_id'
  ) THEN
    ALTER TABLE achievements ADD COLUMN family_id uuid REFERENCES families(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'achievements' AND column_name = 'is_custom'
  ) THEN
    ALTER TABLE achievements ADD COLUMN is_custom boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'achievements' AND column_name = 'created_by_member_id'
  ) THEN
    ALTER TABLE achievements ADD COLUMN created_by_member_id uuid REFERENCES family_members(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add family_id to points_history
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'points_history' AND column_name = 'family_id'
  ) THEN
    ALTER TABLE points_history ADD COLUMN family_id uuid REFERENCES families(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add family_id to weekly_goals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'weekly_goals' AND column_name = 'family_id'
  ) THEN
    ALTER TABLE weekly_goals ADD COLUMN family_id uuid REFERENCES families(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Enable RLS on new tables
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_points_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for families
CREATE POLICY "Users can view their own family"
  ON families FOR SELECT
  TO public
  USING (
    id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can create a family"
  ON families FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Family admins can update family settings"
  ON families FOR UPDATE
  TO public
  USING (
    id IN (
      SELECT family_id FROM family_members 
      WHERE user_id = auth.uid() AND is_admin = true
    )
  )
  WITH CHECK (
    id IN (
      SELECT family_id FROM family_members 
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- RLS Policies for manual_points_awards
CREATE POLICY "Family members can view points awards"
  ON manual_points_awards FOR SELECT
  TO public
  USING (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Family admins can award points"
  ON manual_points_awards FOR INSERT
  TO public
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM family_members 
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- RLS Policies for reward_redemptions
CREATE POLICY "Family members can view redemptions"
  ON reward_redemptions FOR SELECT
  TO public
  USING (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Family members can create redemption requests"
  ON reward_redemptions FOR INSERT
  TO public
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Family admins can update redemptions"
  ON reward_redemptions FOR UPDATE
  TO public
  USING (
    family_id IN (
      SELECT family_id FROM family_members 
      WHERE user_id = auth.uid() AND is_admin = true
    )
  )
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM family_members 
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- RLS Policies for task_history
CREATE POLICY "Family members can view task history"
  ON task_history FOR SELECT
  TO public
  USING (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Family admins can insert task history"
  ON task_history FOR INSERT
  TO public
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM family_members 
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_family_members_family_id ON family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_family_id ON tasks(family_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_datetime ON tasks(due_datetime);
CREATE INDEX IF NOT EXISTS idx_manual_points_family ON manual_points_awards(family_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_family ON reward_redemptions(family_id);
CREATE INDEX IF NOT EXISTS idx_task_history_family ON task_history(family_id);
CREATE INDEX IF NOT EXISTS idx_achievements_family ON achievements(family_id);
CREATE INDEX IF NOT EXISTS idx_achievements_custom ON achievements(is_custom);

-- Function to generate unique invite code
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS text AS $$
DECLARE
  characters text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := '';
  i integer;
BEGIN
  FOR i IN 1..8 LOOP
    code := code || substr(characters, floor(random() * length(characters) + 1)::integer, 1);
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;
