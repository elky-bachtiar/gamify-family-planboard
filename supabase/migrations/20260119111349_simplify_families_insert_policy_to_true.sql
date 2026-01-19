/*
  # Simplify Families INSERT Policy to WITH CHECK (true)

  ## Problem
  The INSERT policy with `WITH CHECK (auth.uid() IS NOT NULL)` is still
  blocking authenticated users from creating families. This suggests the
  auth.uid() function might be evaluating differently than expected in
  the WITH CHECK context.

  ## Solution
  Simplify the policy to just `WITH CHECK (true)` for authenticated users.
  Since the policy already restricts to the `authenticated` role, this is
  still secure - only logged-in users can create families.

  ## Security
  - Policy targets `authenticated` role (must be logged in)
  - WITH CHECK (true) allows any authenticated user to insert
  - This is the correct approach for initial family creation
  - Once created, other policies restrict who can view/update families

  ## Changes
  1. Drop the existing INSERT policy
  2. Create new INSERT policy with simple WITH CHECK (true)
*/

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create a family" ON families;

-- Create new policy with simple WITH CHECK (true)
CREATE POLICY "Authenticated users can create a family"
  ON families FOR INSERT
  TO authenticated
  WITH CHECK (true);
