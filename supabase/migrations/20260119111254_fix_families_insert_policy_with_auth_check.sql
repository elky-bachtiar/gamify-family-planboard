/*
  # Fix Families INSERT Policy with Explicit Auth Check

  ## Problem
  Despite having a policy that targets authenticated users with WITH CHECK (true),
  inserts are still failing with RLS violations. This suggests the authenticated
  role check alone isn't sufficient.

  ## Solution
  Replace the simple WITH CHECK (true) with an explicit auth.uid() IS NOT NULL check.
  This ensures that only users with valid authentication sessions can create families.

  ## Changes
  1. Drop the existing INSERT policy
  2. Create new INSERT policy with explicit auth check
  3. This maintains security while being more explicit about requirements
*/

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create a family" ON families;

-- Create new policy with explicit auth.uid() check
CREATE POLICY "Authenticated users can create a family"
  ON families FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
