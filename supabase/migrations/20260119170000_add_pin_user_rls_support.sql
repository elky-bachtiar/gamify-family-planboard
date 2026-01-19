/*
  # Add RLS Support for PIN Users

  PIN users authenticate via a custom JWT where auth.uid() returns their member_id.
  This migration updates RLS policies to also check member.id = auth.uid()
  in addition to user_id = auth.uid().

  This allows PIN users to access their family's data even though they don't have
  a traditional Supabase auth user account.
*/

-- ============================================================================
-- DROP EXISTING POLICIES (will be recreated with PIN support)
-- ============================================================================

-- families policies
DROP POLICY IF EXISTS "Users can view their own family" ON families;
DROP POLICY IF EXISTS "Family admins can update family settings" ON families;

-- family_members policies
DROP POLICY IF EXISTS "Family members can view members in their family" ON family_members;
DROP POLICY IF EXISTS "Members can update their own profile or admins can update" ON family_members;
DROP POLICY IF EXISTS "Admins can delete family members" ON family_members;

-- tasks policies
DROP POLICY IF EXISTS "Family members can view tasks" ON tasks;
DROP POLICY IF EXISTS "Family members can create tasks" ON tasks;
DROP POLICY IF EXISTS "Family members can update tasks" ON tasks;
DROP POLICY IF EXISTS "Admins can delete tasks" ON tasks;

-- achievements policies
DROP POLICY IF EXISTS "Users can view achievements" ON achievements;
DROP POLICY IF EXISTS "Admins can create custom achievements" ON achievements;

-- user_achievements policies
DROP POLICY IF EXISTS "Family members can view user achievements" ON user_achievements;

-- points_history policies
DROP POLICY IF EXISTS "Family members can view points history" ON points_history;
DROP POLICY IF EXISTS "System can create points history" ON points_history;

-- weekly_goals policies
DROP POLICY IF EXISTS "Family members can view weekly goals" ON weekly_goals;
DROP POLICY IF EXISTS "Family members can create weekly goals" ON weekly_goals;
DROP POLICY IF EXISTS "Family members can update weekly goals" ON weekly_goals;

-- manual_points_awards policies
DROP POLICY IF EXISTS "Family members can view points awards" ON manual_points_awards;
DROP POLICY IF EXISTS "Family admins can award points" ON manual_points_awards;

-- reward_redemptions policies
DROP POLICY IF EXISTS "Family members can view redemptions" ON reward_redemptions;
DROP POLICY IF EXISTS "Family members can create redemption requests" ON reward_redemptions;
DROP POLICY IF EXISTS "Family admins can update redemptions" ON reward_redemptions;

-- task_history policies
DROP POLICY IF EXISTS "Family members can view task history" ON task_history;
DROP POLICY IF EXISTS "Family admins can insert task history" ON task_history;

-- ============================================================================
-- HELPER: Get the current user's family_id (supports both regular and PIN users)
-- For regular users: user_id = auth.uid()
-- For PIN users: id = auth.uid() (member_id is stored in sub claim)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_family_id()
RETURNS uuid AS $$
  SELECT family_id FROM family_members
  WHERE user_id = auth.uid() OR id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper to check if current user is admin in their family
CREATE OR REPLACE FUNCTION is_family_admin()
RETURNS boolean AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM family_members
     WHERE user_id = auth.uid() OR id = auth.uid()
     LIMIT 1),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- RLS POLICIES FOR families (with PIN user support)
-- ============================================================================

-- SELECT: Allow users to view families they belong to OR created
CREATE POLICY "Users can view their own family"
  ON families FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR id = get_user_family_id()
  );

-- UPDATE: Only family admins can update family settings
CREATE POLICY "Family admins can update family settings"
  ON families FOR UPDATE
  TO authenticated
  USING (id = get_user_family_id() AND is_family_admin())
  WITH CHECK (id = get_user_family_id() AND is_family_admin());

-- ============================================================================
-- RLS POLICIES FOR family_members (with PIN user support)
-- ============================================================================

CREATE POLICY "Family members can view members in their family"
  ON family_members FOR SELECT
  TO authenticated
  USING (family_id = get_user_family_id());

CREATE POLICY "Members can update their own profile or admins can update"
  ON family_members FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR id = auth.uid()
    OR (family_id = get_user_family_id() AND is_family_admin())
  )
  WITH CHECK (
    user_id = auth.uid()
    OR id = auth.uid()
    OR (family_id = get_user_family_id() AND is_family_admin())
  );

CREATE POLICY "Admins can delete family members"
  ON family_members FOR DELETE
  TO authenticated
  USING (family_id = get_user_family_id() AND is_family_admin());

-- ============================================================================
-- RLS POLICIES FOR tasks (with PIN user support)
-- ============================================================================

CREATE POLICY "Family members can view tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (family_id = get_user_family_id());

CREATE POLICY "Family members can create tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (family_id = get_user_family_id());

CREATE POLICY "Family members can update tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (family_id = get_user_family_id())
  WITH CHECK (family_id = get_user_family_id());

CREATE POLICY "Admins can delete tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (family_id = get_user_family_id() AND is_family_admin());

-- ============================================================================
-- RLS POLICIES FOR achievements (with PIN user support)
-- ============================================================================

CREATE POLICY "Users can view achievements"
  ON achievements FOR SELECT
  TO authenticated
  USING (
    family_id IS NULL
    OR family_id = get_user_family_id()
  );

CREATE POLICY "Admins can create custom achievements"
  ON achievements FOR INSERT
  TO authenticated
  WITH CHECK (
    family_id IS NULL
    OR (family_id = get_user_family_id() AND is_family_admin())
  );

-- ============================================================================
-- RLS POLICIES FOR user_achievements (with PIN user support)
-- ============================================================================

CREATE POLICY "Family members can view user achievements"
  ON user_achievements FOR SELECT
  TO authenticated
  USING (
    member_id IN (
      SELECT id FROM family_members
      WHERE family_id = get_user_family_id()
    )
  );

-- ============================================================================
-- RLS POLICIES FOR points_history (with PIN user support)
-- ============================================================================

CREATE POLICY "Family members can view points history"
  ON points_history FOR SELECT
  TO authenticated
  USING (family_id = get_user_family_id());

CREATE POLICY "System can create points history"
  ON points_history FOR INSERT
  TO authenticated
  WITH CHECK (family_id = get_user_family_id());

-- ============================================================================
-- RLS POLICIES FOR weekly_goals (with PIN user support)
-- ============================================================================

CREATE POLICY "Family members can view weekly goals"
  ON weekly_goals FOR SELECT
  TO authenticated
  USING (family_id = get_user_family_id());

CREATE POLICY "Family members can create weekly goals"
  ON weekly_goals FOR INSERT
  TO authenticated
  WITH CHECK (family_id = get_user_family_id());

CREATE POLICY "Family members can update weekly goals"
  ON weekly_goals FOR UPDATE
  TO authenticated
  USING (family_id = get_user_family_id())
  WITH CHECK (family_id = get_user_family_id());

-- ============================================================================
-- RLS POLICIES FOR manual_points_awards (with PIN user support)
-- ============================================================================

CREATE POLICY "Family members can view points awards"
  ON manual_points_awards FOR SELECT
  TO authenticated
  USING (family_id = get_user_family_id());

CREATE POLICY "Family admins can award points"
  ON manual_points_awards FOR INSERT
  TO authenticated
  WITH CHECK (family_id = get_user_family_id() AND is_family_admin());

-- ============================================================================
-- RLS POLICIES FOR reward_redemptions (with PIN user support)
-- ============================================================================

CREATE POLICY "Family members can view redemptions"
  ON reward_redemptions FOR SELECT
  TO authenticated
  USING (family_id = get_user_family_id());

CREATE POLICY "Family members can create redemption requests"
  ON reward_redemptions FOR INSERT
  TO authenticated
  WITH CHECK (family_id = get_user_family_id());

CREATE POLICY "Family admins can update redemptions"
  ON reward_redemptions FOR UPDATE
  TO authenticated
  USING (family_id = get_user_family_id() AND is_family_admin())
  WITH CHECK (family_id = get_user_family_id() AND is_family_admin());

-- ============================================================================
-- RLS POLICIES FOR task_history (with PIN user support)
-- ============================================================================

CREATE POLICY "Family members can view task history"
  ON task_history FOR SELECT
  TO authenticated
  USING (family_id = get_user_family_id());

CREATE POLICY "Family admins can insert task history"
  ON task_history FOR INSERT
  TO authenticated
  WITH CHECK (family_id = get_user_family_id() AND is_family_admin());

-- ============================================================================
-- GRANT EXECUTE on helper functions
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_user_family_id() TO authenticated;
GRANT EXECUTE ON FUNCTION is_family_admin() TO authenticated;
