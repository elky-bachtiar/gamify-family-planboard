/*
  # Consolidated Initial Schema for Family Planboard

  This migration consolidates the following archived migrations:

  ## From: 20260119100428_create_family_planboard_schema.sql
  - Tables: family_members, tasks, achievements, user_achievements, points_history, weekly_goals
  - RLS policies (UPDATED: changed from TO public -> TO authenticated)
  - Indexes
  - Default achievements

  ## From: 20260119101650_add_auth_families_and_advanced_features.sql
  - Tables: families, manual_points_awards, reward_redemptions, task_history
  - Added columns: family_id, user_id, is_admin to family_members
  - Added columns: family_id, is_archived, due_datetime to tasks
  - Added columns: family_id, is_custom, created_by_member_id to achievements
  - Added family_id to points_history, weekly_goals
  - generate_invite_code() function

  ## From: 20260119104405_fix_families_insert_rls_policy.sql
  - APPLIED: Changed families INSERT policy from TO public -> TO authenticated

  ## From: 20260119104424_update_all_families_policies_to_authenticated.sql
  - APPLIED: Changed families SELECT/UPDATE policies to TO authenticated

  ## From: 20260119111254_fix_families_insert_policy_with_auth_check.sql
  - SUPERSEDED: Tried auth.uid() IS NOT NULL check (reverted in next migration)

  ## From: 20260119111349_simplify_families_insert_policy_to_true.sql
  - APPLIED: Simplified INSERT policy to WITH CHECK (true)

  ## From: 20260119111452_grant_insert_to_authenticated_role.sql
  - APPLIED: GRANT INSERT ON families TO authenticated

  ## From: 20260119111521_refresh_families_rls.sql
  - NOT NEEDED: Was for cache refresh, not needed in fresh DB

  ## From: 20260119122500_fix_families_select_policy_for_creator.sql
  - APPLIED: SELECT policy includes created_by = auth.uid() check

  ## Key Improvements in This Consolidated Migration
  - All RLS policies use TO authenticated (not public)
  - families SELECT policy allows creator access for INSERT...RETURNING
  - GRANT INSERT/UPDATE/SELECT/DELETE to authenticated role on all tables
*/

-- ============================================================================
-- TABLES
-- ============================================================================

-- Create families table (must be created first since other tables reference it)
CREATE TABLE IF NOT EXISTS families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  invite_code text UNIQUE NOT NULL,
  point_to_money_rate numeric DEFAULT 0.01,
  minimum_redemption integer DEFAULT 100,
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

-- Create family_members table
CREATE TABLE IF NOT EXISTS family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE,
  avatar_url text,
  color text DEFAULT '#3B82F6',
  total_points integer DEFAULT 0,
  current_level integer DEFAULT 1,
  current_streak integer DEFAULT 0,
  role text DEFAULT 'child' CHECK (role IN ('parent', 'child')),
  created_at timestamptz DEFAULT now(),
  family_id uuid REFERENCES families(id) ON DELETE CASCADE,
  user_id uuid,
  is_admin boolean DEFAULT false
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  assigned_to uuid REFERENCES family_members(id) ON DELETE CASCADE,
  due_date date NOT NULL,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  point_value integer DEFAULT 10,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES family_members(id) ON DELETE SET NULL,
  family_id uuid REFERENCES families(id) ON DELETE CASCADE,
  is_archived boolean DEFAULT false,
  due_datetime timestamptz
);

-- Create achievements table
CREATE TABLE IF NOT EXISTS achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  icon text DEFAULT '🏆',
  condition_type text NOT NULL CHECK (condition_type IN ('first_task', 'tasks_count', 'points_total', 'streak_days', 'perfect_week')),
  condition_value integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  family_id uuid REFERENCES families(id) ON DELETE CASCADE,
  is_custom boolean DEFAULT false,
  created_by_member_id uuid REFERENCES family_members(id) ON DELETE SET NULL
);

-- Create user_achievements table
CREATE TABLE IF NOT EXISTS user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES family_members(id) ON DELETE CASCADE,
  achievement_id uuid REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at timestamptz DEFAULT now(),
  UNIQUE(member_id, achievement_id)
);

-- Create points_history table
CREATE TABLE IF NOT EXISTS points_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES family_members(id) ON DELETE CASCADE,
  points integer NOT NULL,
  reason text NOT NULL,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  family_id uuid REFERENCES families(id) ON DELETE CASCADE
);

-- Create weekly_goals table
CREATE TABLE IF NOT EXISTS weekly_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES family_members(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  goal_type text NOT NULL CHECK (goal_type IN ('tasks_completed', 'points_earned')),
  target_value integer NOT NULL,
  current_value integer DEFAULT 0,
  completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  family_id uuid REFERENCES families(id) ON DELETE CASCADE
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

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_points_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- GRANT PERMISSIONS TO AUTHENTICATED ROLE
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON families TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON family_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON achievements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_achievements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON points_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON weekly_goals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON manual_points_awards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON reward_redemptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON task_history TO authenticated;

-- ============================================================================
-- RLS POLICIES FOR families
-- ============================================================================

-- SELECT: Allow users to view families they belong to OR created
-- IMPORTANT: Must include created_by check for INSERT...RETURNING to work
CREATE POLICY "Users can view their own family"
  ON families FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

-- INSERT: Any authenticated user can create a family
CREATE POLICY "Authenticated users can create a family"
  ON families FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: Only family admins can update family settings
CREATE POLICY "Family admins can update family settings"
  ON families FOR UPDATE
  TO authenticated
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

-- ============================================================================
-- RLS POLICIES FOR family_members
-- ============================================================================

CREATE POLICY "Family members can view members in their family"
  ON family_members FOR SELECT
  TO authenticated
  USING (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can insert family members"
  ON family_members FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Members can update their own profile or admins can update"
  ON family_members FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR family_id IN (
      SELECT family_id FROM family_members
      WHERE user_id = auth.uid() AND is_admin = true
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR family_id IN (
      SELECT family_id FROM family_members
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins can delete family members"
  ON family_members FOR DELETE
  TO authenticated
  USING (
    family_id IN (
      SELECT family_id FROM family_members
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- ============================================================================
-- RLS POLICIES FOR tasks
-- ============================================================================

CREATE POLICY "Family members can view tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Family members can create tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Family members can update tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (
    family_id IN (
      SELECT family_id FROM family_members
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- ============================================================================
-- RLS POLICIES FOR achievements
-- ============================================================================

-- Default achievements (family_id IS NULL) are viewable by everyone
-- Custom achievements are viewable by family members
CREATE POLICY "Users can view achievements"
  ON achievements FOR SELECT
  TO authenticated
  USING (
    family_id IS NULL
    OR family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can create custom achievements"
  ON achievements FOR INSERT
  TO authenticated
  WITH CHECK (
    family_id IS NULL
    OR family_id IN (
      SELECT family_id FROM family_members
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- ============================================================================
-- RLS POLICIES FOR user_achievements
-- ============================================================================

CREATE POLICY "Family members can view user achievements"
  ON user_achievements FOR SELECT
  TO authenticated
  USING (
    member_id IN (
      SELECT id FROM family_members
      WHERE family_id IN (
        SELECT family_id FROM family_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "System can create user achievements"
  ON user_achievements FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- RLS POLICIES FOR points_history
-- ============================================================================

CREATE POLICY "Family members can view points history"
  ON points_history FOR SELECT
  TO authenticated
  USING (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can create points history"
  ON points_history FOR INSERT
  TO authenticated
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES FOR weekly_goals
-- ============================================================================

CREATE POLICY "Family members can view weekly goals"
  ON weekly_goals FOR SELECT
  TO authenticated
  USING (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Family members can create weekly goals"
  ON weekly_goals FOR INSERT
  TO authenticated
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Family members can update weekly goals"
  ON weekly_goals FOR UPDATE
  TO authenticated
  USING (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES FOR manual_points_awards
-- ============================================================================

CREATE POLICY "Family members can view points awards"
  ON manual_points_awards FOR SELECT
  TO authenticated
  USING (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Family admins can award points"
  ON manual_points_awards FOR INSERT
  TO authenticated
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM family_members
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- ============================================================================
-- RLS POLICIES FOR reward_redemptions
-- ============================================================================

CREATE POLICY "Family members can view redemptions"
  ON reward_redemptions FOR SELECT
  TO authenticated
  USING (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Family members can create redemption requests"
  ON reward_redemptions FOR INSERT
  TO authenticated
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Family admins can update redemptions"
  ON reward_redemptions FOR UPDATE
  TO authenticated
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

-- ============================================================================
-- RLS POLICIES FOR task_history
-- ============================================================================

CREATE POLICY "Family members can view task history"
  ON task_history FOR SELECT
  TO authenticated
  USING (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Family admins can insert task history"
  ON task_history FOR INSERT
  TO authenticated
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM family_members
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- ============================================================================
-- INDEXES
-- ============================================================================

-- family_members indexes
CREATE INDEX IF NOT EXISTS idx_family_members_family_id ON family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON family_members(user_id);

-- tasks indexes
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_due_datetime ON tasks(due_datetime);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_family_id ON tasks(family_id);

-- achievements indexes
CREATE INDEX IF NOT EXISTS idx_achievements_family ON achievements(family_id);
CREATE INDEX IF NOT EXISTS idx_achievements_custom ON achievements(is_custom);

-- user_achievements indexes
CREATE INDEX IF NOT EXISTS idx_user_achievements_member ON user_achievements(member_id);

-- points_history indexes
CREATE INDEX IF NOT EXISTS idx_points_history_member ON points_history(member_id);

-- weekly_goals indexes
CREATE INDEX IF NOT EXISTS idx_weekly_goals_member ON weekly_goals(member_id);
CREATE INDEX IF NOT EXISTS idx_weekly_goals_week ON weekly_goals(week_start);

-- Other table indexes
CREATE INDEX IF NOT EXISTS idx_manual_points_family ON manual_points_awards(family_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_family ON reward_redemptions(family_id);
CREATE INDEX IF NOT EXISTS idx_task_history_family ON task_history(family_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

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

-- ============================================================================
-- DEFAULT ACHIEVEMENTS
-- ============================================================================

INSERT INTO achievements (name, description, icon, condition_type, condition_value) VALUES
  ('First Steps', 'Complete your first task', '🌟', 'first_task', 1),
  ('Task Master', 'Complete 10 tasks', '🎯', 'tasks_count', 10),
  ('Century Club', 'Complete 100 tasks', '💯', 'tasks_count', 100),
  ('Point Collector', 'Earn 100 points', '💰', 'points_total', 100),
  ('Point Master', 'Earn 500 points', '💎', 'points_total', 500),
  ('Point Legend', 'Earn 1000 points', '👑', 'points_total', 1000),
  ('Week Warrior', 'Maintain a 7-day streak', '🔥', 'streak_days', 7),
  ('Month Master', 'Maintain a 30-day streak', '⚡', 'streak_days', 30),
  ('Perfect Week', 'Complete all tasks in a week', '✨', 'perfect_week', 1)
ON CONFLICT DO NOTHING;
