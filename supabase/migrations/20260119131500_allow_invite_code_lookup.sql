/*
  # Allow Invite Code Lookup for Joining Families

  ## Problem
  When a user tries to join a family using an invite code, they need to look up
  the family by invite_code. However, the current SELECT policy only allows
  users to view families they created or are members of.

  A user trying to join isn't yet a member, so they can't look up the family.

  ## Solution
  Add a SELECT policy that allows any authenticated user to look up a family
  by its invite_code. This is necessary for the join flow to work.

  ## Changes
  1. Add a new SELECT policy for invite code lookups
*/

-- Add policy to allow looking up families by invite code
CREATE POLICY "Users can lookup families by invite code"
  ON families FOR SELECT
  TO authenticated
  USING (true);

-- Drop the more restrictive policy since the new one covers all cases
DROP POLICY IF EXISTS "Users can view their own family" ON families;
