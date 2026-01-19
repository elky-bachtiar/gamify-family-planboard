/*
  Fix infinite recursion in family_members RLS policies.

  The problem: The SELECT policy on family_members queries family_members
  to check if the user belongs to the same family, which triggers the same
  policy evaluation, causing infinite recursion.

  The solution: Create a SECURITY DEFINER function that bypasses RLS to
  get the current user's family_id, then use that function in the policies.
*/

-- Create a function to get the current user's family_id without RLS checks
CREATE OR REPLACE FUNCTION get_my_family_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT family_id FROM family_members WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_my_family_id() TO authenticated;

-- Drop existing family_members policies
DROP POLICY IF EXISTS "Family members can view members in their family" ON family_members;
DROP POLICY IF EXISTS "Authenticated users can insert family members" ON family_members;
DROP POLICY IF EXISTS "Members can update their own profile or admins can update" ON family_members;
DROP POLICY IF EXISTS "Admins can delete family members" ON family_members;

-- Recreate policies using the SECURITY DEFINER function

-- SELECT: Users can view their own record OR members in their family
CREATE POLICY "Family members can view members in their family"
  ON family_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()  -- Always allow viewing own record
    OR family_id = get_my_family_id()  -- Allow viewing family members
  );

-- INSERT: Any authenticated user can create a family member record
-- (needed for registration flow)
CREATE POLICY "Authenticated users can insert family members"
  ON family_members FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: Users can update their own profile, or admins can update anyone in their family
CREATE POLICY "Members can update their own profile or admins can update"
  ON family_members FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      family_id = get_my_family_id()
      AND EXISTS (
        SELECT 1 FROM family_members
        WHERE user_id = auth.uid() AND is_admin = true AND family_id = get_my_family_id()
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (
      family_id = get_my_family_id()
      AND EXISTS (
        SELECT 1 FROM family_members
        WHERE user_id = auth.uid() AND is_admin = true AND family_id = get_my_family_id()
      )
    )
  );

-- DELETE: Only admins can delete family members in their family
CREATE POLICY "Admins can delete family members"
  ON family_members FOR DELETE
  TO authenticated
  USING (
    family_id = get_my_family_id()
    AND EXISTS (
      SELECT 1 FROM family_members
      WHERE user_id = auth.uid() AND is_admin = true AND family_id = get_my_family_id()
    )
  );

-- Also fix policies on other tables that query family_members
-- These won't cause infinite recursion but using the function is more efficient

-- Fix families SELECT policy
DROP POLICY IF EXISTS "Users can view their own family" ON families;
CREATE POLICY "Users can view their own family"
  ON families FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR id = get_my_family_id()
  );

-- Fix families UPDATE policy
DROP POLICY IF EXISTS "Family admins can update family settings" ON families;
CREATE POLICY "Family admins can update family settings"
  ON families FOR UPDATE
  TO authenticated
  USING (
    id = get_my_family_id()
    AND EXISTS (
      SELECT 1 FROM family_members
      WHERE user_id = auth.uid() AND is_admin = true AND family_id = get_my_family_id()
    )
  )
  WITH CHECK (
    id = get_my_family_id()
    AND EXISTS (
      SELECT 1 FROM family_members
      WHERE user_id = auth.uid() AND is_admin = true AND family_id = get_my_family_id()
    )
  );

-- Fix tasks policies
DROP POLICY IF EXISTS "Family members can view tasks" ON tasks;
DROP POLICY IF EXISTS "Family members can create tasks" ON tasks;
DROP POLICY IF EXISTS "Family members can update tasks" ON tasks;
DROP POLICY IF EXISTS "Admins can delete tasks" ON tasks;

CREATE POLICY "Family members can view tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (family_id = get_my_family_id());

CREATE POLICY "Family members can create tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (family_id = get_my_family_id());

CREATE POLICY "Family members can update tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (family_id = get_my_family_id())
  WITH CHECK (family_id = get_my_family_id());

CREATE POLICY "Admins can delete tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (
    family_id = get_my_family_id()
    AND EXISTS (
      SELECT 1 FROM family_members
      WHERE user_id = auth.uid() AND is_admin = true AND family_id = get_my_family_id()
    )
  );

-- Fix achievements policies
DROP POLICY IF EXISTS "Users can view achievements" ON achievements;
DROP POLICY IF EXISTS "Admins can create custom achievements" ON achievements;

CREATE POLICY "Users can view achievements"
  ON achievements FOR SELECT
  TO authenticated
  USING (
    family_id IS NULL  -- Default achievements
    OR family_id = get_my_family_id()  -- Custom family achievements
  );

CREATE POLICY "Admins can create custom achievements"
  ON achievements FOR INSERT
  TO authenticated
  WITH CHECK (
    family_id IS NULL
    OR (
      family_id = get_my_family_id()
      AND EXISTS (
        SELECT 1 FROM family_members
        WHERE user_id = auth.uid() AND is_admin = true AND family_id = get_my_family_id()
      )
    )
  );

-- Fix user_achievements policies
DROP POLICY IF EXISTS "Family members can view user achievements" ON user_achievements;

CREATE POLICY "Family members can view user achievements"
  ON user_achievements FOR SELECT
  TO authenticated
  USING (
    member_id IN (
      SELECT id FROM family_members WHERE family_id = get_my_family_id()
    )
  );

-- Fix points_history policies
DROP POLICY IF EXISTS "Family members can view points history" ON points_history;
DROP POLICY IF EXISTS "System can create points history" ON points_history;

CREATE POLICY "Family members can view points history"
  ON points_history FOR SELECT
  TO authenticated
  USING (family_id = get_my_family_id());

CREATE POLICY "System can create points history"
  ON points_history FOR INSERT
  TO authenticated
  WITH CHECK (family_id = get_my_family_id());

-- Fix weekly_goals policies
DROP POLICY IF EXISTS "Family members can view weekly goals" ON weekly_goals;
DROP POLICY IF EXISTS "Family members can create weekly goals" ON weekly_goals;
DROP POLICY IF EXISTS "Family members can update weekly goals" ON weekly_goals;

CREATE POLICY "Family members can view weekly goals"
  ON weekly_goals FOR SELECT
  TO authenticated
  USING (family_id = get_my_family_id());

CREATE POLICY "Family members can create weekly goals"
  ON weekly_goals FOR INSERT
  TO authenticated
  WITH CHECK (family_id = get_my_family_id());

CREATE POLICY "Family members can update weekly goals"
  ON weekly_goals FOR UPDATE
  TO authenticated
  USING (family_id = get_my_family_id())
  WITH CHECK (family_id = get_my_family_id());

-- Fix manual_points_awards policies
DROP POLICY IF EXISTS "Family members can view points awards" ON manual_points_awards;
DROP POLICY IF EXISTS "Family admins can award points" ON manual_points_awards;

CREATE POLICY "Family members can view points awards"
  ON manual_points_awards FOR SELECT
  TO authenticated
  USING (family_id = get_my_family_id());

CREATE POLICY "Family admins can award points"
  ON manual_points_awards FOR INSERT
  TO authenticated
  WITH CHECK (
    family_id = get_my_family_id()
    AND EXISTS (
      SELECT 1 FROM family_members
      WHERE user_id = auth.uid() AND is_admin = true AND family_id = get_my_family_id()
    )
  );

-- Fix reward_redemptions policies
DROP POLICY IF EXISTS "Family members can view redemptions" ON reward_redemptions;
DROP POLICY IF EXISTS "Family members can create redemption requests" ON reward_redemptions;
DROP POLICY IF EXISTS "Family admins can update redemptions" ON reward_redemptions;

CREATE POLICY "Family members can view redemptions"
  ON reward_redemptions FOR SELECT
  TO authenticated
  USING (family_id = get_my_family_id());

CREATE POLICY "Family members can create redemption requests"
  ON reward_redemptions FOR INSERT
  TO authenticated
  WITH CHECK (family_id = get_my_family_id());

CREATE POLICY "Family admins can update redemptions"
  ON reward_redemptions FOR UPDATE
  TO authenticated
  USING (
    family_id = get_my_family_id()
    AND EXISTS (
      SELECT 1 FROM family_members
      WHERE user_id = auth.uid() AND is_admin = true AND family_id = get_my_family_id()
    )
  )
  WITH CHECK (
    family_id = get_my_family_id()
    AND EXISTS (
      SELECT 1 FROM family_members
      WHERE user_id = auth.uid() AND is_admin = true AND family_id = get_my_family_id()
    )
  );

-- Fix task_history policies
DROP POLICY IF EXISTS "Family members can view task history" ON task_history;
DROP POLICY IF EXISTS "Family admins can insert task history" ON task_history;

CREATE POLICY "Family members can view task history"
  ON task_history FOR SELECT
  TO authenticated
  USING (family_id = get_my_family_id());

CREATE POLICY "Family admins can insert task history"
  ON task_history FOR INSERT
  TO authenticated
  WITH CHECK (
    family_id = get_my_family_id()
    AND EXISTS (
      SELECT 1 FROM family_members
      WHERE user_id = auth.uid() AND is_admin = true AND family_id = get_my_family_id()
    )
  );
