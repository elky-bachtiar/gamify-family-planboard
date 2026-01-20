-- Add parent_invite_code column to families table for inviting new admins/parents
ALTER TABLE families ADD COLUMN IF NOT EXISTS parent_invite_code TEXT UNIQUE;

-- Generate parent invite codes for existing families
UPDATE families
SET parent_invite_code = 'P' || UPPER(SUBSTRING(md5(random()::text || id::text) FROM 1 FOR 7))
WHERE parent_invite_code IS NULL;

-- Make the column NOT NULL after populating existing rows
ALTER TABLE families ALTER COLUMN parent_invite_code SET NOT NULL;

-- Add a default value for new families
ALTER TABLE families ALTER COLUMN parent_invite_code SET DEFAULT 'P' || UPPER(SUBSTRING(md5(random()::text) FROM 1 FOR 7));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_families_parent_invite_code ON families(parent_invite_code);

-- Create a function to regenerate parent invite code
CREATE OR REPLACE FUNCTION regenerate_parent_invite_code(family_id_param UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_code TEXT;
BEGIN
  new_code := 'P' || UPPER(SUBSTRING(md5(random()::text || now()::text) FROM 1 FOR 7));

  UPDATE families
  SET parent_invite_code = new_code
  WHERE id = family_id_param;

  RETURN new_code;
END;
$$;
