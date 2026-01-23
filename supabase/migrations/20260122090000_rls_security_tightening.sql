/*
  # RLS Security Tightening

  This migration addresses security gaps identified in the RLS policies:

  ## Issues Fixed:
  1. Task UPDATE - Split by role (admins vs non-admins)
  2. Task SELECT - Children can only see their own tasks, unassigned tasks, or tasks they created
  3. Family Members UPDATE - Non-admins can only update their own avatar
  4. Family Members INSERT - Validate family membership
  5. Child task defaults - Enforce 5 points and medium priority for child-created tasks
  6. Field protection triggers - Prevent non-admins from modifying sensitive fields
*/

-- ============================================================================
-- HELPER: Get current user's member ID
-- ============================================================================

CREATE OR REPLACE FUNCTION get_current_member_id()
RETURNS uuid AS $$
  SELECT id FROM family_members
  WHERE user_id = auth.uid() OR id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_current_member_id() TO authenticated;

-- ============================================================================
-- 1. TASK UPDATE POLICY - Split by Role
-- ============================================================================

-- Drop existing permissive policy
DROP POLICY IF EXISTS "Family members can update tasks" ON tasks;

-- Non-admins: Limited task updates (own tasks, restricted operations)
-- They can update status (to mark done), completed_at, completed_by
-- They cannot change point_value, priority, creation_approved, assigned_to (unless claiming)
CREATE POLICY "Members can update own or unassigned tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    family_id = get_user_family_id()
    AND NOT is_family_admin()
    AND (
      assigned_to = get_current_member_id()  -- Own assigned task
      OR assigned_to IS NULL                  -- Unassigned (claimable)
      OR created_by = get_current_member_id() -- Task they created
    )
  )
  WITH CHECK (
    family_id = get_user_family_id()
    AND NOT is_family_admin()
  );

-- Admins: Full task updates within their family
CREATE POLICY "Admins can update any family task"
  ON tasks FOR UPDATE
  TO authenticated
  USING (family_id = get_user_family_id() AND is_family_admin())
  WITH CHECK (family_id = get_user_family_id() AND is_family_admin());

-- ============================================================================
-- 2. TASK SELECT POLICY - Child Visibility Restrictions
-- ============================================================================

-- Drop existing permissive policy
DROP POLICY IF EXISTS "Family members can view tasks" ON tasks;

-- Children should only see:
-- - Their own assigned tasks
-- - Unassigned tasks (claimable)
-- - Tasks they created
-- Admins see all family tasks
CREATE POLICY "Family members can view tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    family_id = get_user_family_id()
    AND (
      is_family_admin()                           -- Admins see all
      OR assigned_to = get_current_member_id()    -- Own tasks
      OR assigned_to IS NULL                      -- Unassigned/claimable
      OR created_by = get_current_member_id()     -- Tasks I created
    )
  );

-- ============================================================================
-- 3. FAMILY MEMBERS UPDATE - Field Restrictions
-- ============================================================================

-- Drop existing permissive policy
DROP POLICY IF EXISTS "Members can update their own profile or admins can update" ON family_members;

-- Non-admins can only update their own record (avatar, name changes limited by trigger)
CREATE POLICY "Members can update own profile"
  ON family_members FOR UPDATE
  TO authenticated
  USING (
    (user_id = auth.uid() OR id = auth.uid())
    AND NOT is_family_admin()
  )
  WITH CHECK (
    (user_id = auth.uid() OR id = auth.uid())
    AND NOT is_family_admin()
  );

-- Admins can update any family member
CREATE POLICY "Admins can update family members"
  ON family_members FOR UPDATE
  TO authenticated
  USING (family_id = get_user_family_id() AND is_family_admin())
  WITH CHECK (family_id = get_user_family_id() AND is_family_admin());

-- ============================================================================
-- 4. FAMILY MEMBERS INSERT - Validate Family
-- ============================================================================

-- Drop existing permissive policy
DROP POLICY IF EXISTS "Authenticated users can insert family members" ON family_members;

-- Users can only insert members to their own family (or create their first record)
CREATE POLICY "Users can insert members to own family"
  ON family_members FOR INSERT
  TO authenticated
  WITH CHECK (
    family_id IS NULL  -- New user creating family (no family yet)
    OR family_id = get_user_family_id()  -- Adding to existing family
    OR NOT EXISTS (  -- First member for this user
      SELECT 1 FROM family_members WHERE user_id = auth.uid() OR id = auth.uid()
    )
  );

-- ============================================================================
-- 5. ENFORCE CHILD TASK DEFAULTS (5 points per requirements)
-- ============================================================================

-- Force child-created tasks to use 5 points and medium priority
CREATE OR REPLACE FUNCTION enforce_child_task_defaults()
RETURNS TRIGGER AS $$
BEGIN
  -- On INSERT: If non-admin creating task, enforce defaults
  IF TG_OP = 'INSERT' THEN
    IF NOT is_family_admin() THEN
      NEW.point_value := 5;  -- Enforced default per requirements
      NEW.priority := 'medium';
      NEW.creation_approved := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists to allow recreation
DROP TRIGGER IF EXISTS enforce_child_task_defaults_trigger ON tasks;

CREATE TRIGGER enforce_child_task_defaults_trigger
  BEFORE INSERT ON tasks
  FOR EACH ROW EXECUTE FUNCTION enforce_child_task_defaults();

-- ============================================================================
-- 6. FIELD PROTECTION TRIGGERS
-- ============================================================================

-- Prevent non-admins from modifying sensitive fields on family_members
CREATE OR REPLACE FUNCTION protect_family_member_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip check for admins
  IF is_family_admin() THEN
    RETURN NEW;
  END IF;

  -- Non-admins cannot modify these fields
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    RAISE EXCEPTION 'Cannot modify admin status';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Cannot modify role';
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Cannot modify user_id';
  END IF;

  IF NEW.pin_hash IS DISTINCT FROM OLD.pin_hash THEN
    RAISE EXCEPTION 'Cannot modify PIN';
  END IF;

  IF NEW.total_points IS DISTINCT FROM OLD.total_points THEN
    RAISE EXCEPTION 'Cannot modify points directly';
  END IF;

  IF NEW.current_level IS DISTINCT FROM OLD.current_level THEN
    RAISE EXCEPTION 'Cannot modify level directly';
  END IF;

  IF NEW.family_id IS DISTINCT FROM OLD.family_id THEN
    RAISE EXCEPTION 'Cannot change family';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists to allow recreation
DROP TRIGGER IF EXISTS protect_family_member_fields_trigger ON family_members;

CREATE TRIGGER protect_family_member_fields_trigger
  BEFORE UPDATE ON family_members
  FOR EACH ROW EXECUTE FUNCTION protect_family_member_fields();

-- Prevent non-admins from modifying sensitive task fields (especially unapproved tasks)
CREATE OR REPLACE FUNCTION protect_task_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip check for admins
  IF is_family_admin() THEN
    RETURN NEW;
  END IF;

  -- Non-admins cannot approve task creation
  IF NEW.creation_approved IS DISTINCT FROM OLD.creation_approved THEN
    RAISE EXCEPTION 'Only admins can approve task creation';
  END IF;

  -- Non-admins cannot approve task completion
  IF NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
    RAISE EXCEPTION 'Only admins can approve task completion';
  END IF;

  -- Non-admins cannot change point values
  IF NEW.point_value IS DISTINCT FROM OLD.point_value THEN
    RAISE EXCEPTION 'Only admins can change point values';
  END IF;

  -- Non-admins cannot change priority
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    RAISE EXCEPTION 'Only admins can change priority';
  END IF;

  -- Non-admins cannot reassign tasks (except claiming unassigned)
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    -- Allow claiming unassigned tasks
    IF OLD.assigned_to IS NOT NULL THEN
      RAISE EXCEPTION 'Only admins can reassign tasks';
    END IF;
    -- When claiming, must assign to self
    IF NEW.assigned_to != get_current_member_id() THEN
      RAISE EXCEPTION 'Can only claim tasks for yourself';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists to allow recreation
DROP TRIGGER IF EXISTS protect_task_fields_trigger ON tasks;

CREATE TRIGGER protect_task_fields_trigger
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION protect_task_fields();

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION enforce_child_task_defaults() TO authenticated;
GRANT EXECUTE ON FUNCTION protect_family_member_fields() TO authenticated;
GRANT EXECUTE ON FUNCTION protect_task_fields() TO authenticated;
