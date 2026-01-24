/*
  # Allow Family Members to Unclaim Their Own Tasks

  This migration fixes the task assignment trigger to allow members to:
  1. Claim unassigned tasks (existing behavior)
  2. Unclaim tasks they have claimed (set assigned_to back to NULL)

  Previously, unclaiming was blocked with "Only admins can reassign tasks" error.
*/

-- Update the protect_task_fields function to allow unclaiming
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
