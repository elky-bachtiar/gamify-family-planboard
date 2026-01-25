/*
  # Skip Trigger Checks for Service Role Operations

  The triggers `enforce_child_task_defaults` and `protect_task_fields` check
  `is_family_admin()` to determine if defaults should be enforced. However,
  when using the service role (auth.uid() is NULL), these checks incorrectly
  return false and apply child defaults.

  This migration updates the triggers to skip their checks when there's no
  authenticated user (i.e., service role operations).
*/

-- Update enforce_child_task_defaults to skip for service role
CREATE OR REPLACE FUNCTION enforce_child_task_defaults()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip check for service role operations (no auth context)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

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

-- Update protect_task_fields to skip for service role
CREATE OR REPLACE FUNCTION protect_task_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip check for service role operations (no auth context)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

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

  -- Non-admins assignment rules:
  -- 1. Can claim unassigned tasks (assign to self)
  -- 2. Can unclaim their own tasks (set to NULL)
  -- 3. Cannot reassign to others
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    -- Case 1: Claiming an unassigned task
    IF OLD.assigned_to IS NULL THEN
      -- Must assign to self when claiming
      IF NEW.assigned_to != get_current_member_id() THEN
        RAISE EXCEPTION 'Can only claim tasks for yourself';
      END IF;
    -- Case 2: Unclaiming own task (setting to NULL)
    ELSIF OLD.assigned_to = get_current_member_id() AND NEW.assigned_to IS NULL THEN
      -- This is allowed - member is unclaiming their own task
      NULL;
    -- Case 3: Any other reassignment is not allowed
    ELSE
      RAISE EXCEPTION 'Only admins can reassign tasks';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update protect_family_member_fields to skip for service role
CREATE OR REPLACE FUNCTION protect_family_member_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip check for service role operations (no auth context)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

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
