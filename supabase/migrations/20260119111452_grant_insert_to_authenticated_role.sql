/*
  # Grant INSERT Permission to Authenticated Role

  ## Problem
  Even though RLS policies are correctly configured, the authenticated role
  might not have the base GRANT permission to INSERT into the families table.
  PostgreSQL requires both:
  1. GRANT permission at the table level
  2. RLS policy allowing the operation

  ## Solution
  Explicitly grant INSERT permission to the authenticated role on the families table.

  ## Changes
  1. Grant INSERT permission to authenticated users
  2. This works in conjunction with the RLS policy
*/

-- Grant INSERT permission to authenticated role
GRANT INSERT ON families TO authenticated;
