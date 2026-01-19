/*
  # Fix Families SELECT Policy to Allow Creator Access

  ## Problem
  When creating a family, the code does:
  1. INSERT into families
  2. Immediately SELECT the created row using .select().single()

  The current SELECT policy only allows reading families where the user is a family_member.
  But at the moment of family creation, the user isn't yet a family_member (that record
  is inserted AFTER the family is created).

  This causes the INSERT to fail with "new row violates row-level security policy"
  because PostgREST cannot return the inserted row (SELECT fails, so the whole operation fails).

  ## Solution
  Update the SELECT policy to also allow access to families where the user is the creator.

  ## Changes
  1. Drop the existing SELECT policy
  2. Create new SELECT policy that allows:
     - Family members to view their family (existing behavior)
     - Family creators to view their family (new)
*/

-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Users can view their own family" ON families;

-- Create new policy that includes creator access
CREATE POLICY "Users can view their own family"
  ON families FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );
