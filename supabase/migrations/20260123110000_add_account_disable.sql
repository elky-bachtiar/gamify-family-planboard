-- Add columns for account disable/lock functionality
ALTER TABLE family_members
ADD COLUMN IF NOT EXISTS is_disabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS disabled_at timestamptz,
ADD COLUMN IF NOT EXISTS disabled_by uuid REFERENCES family_members(id) ON DELETE SET NULL;

-- Create index for faster lookup of disabled accounts
CREATE INDEX IF NOT EXISTS idx_family_members_is_disabled ON family_members(is_disabled) WHERE is_disabled = true;

-- Update RLS policies to prevent disabled users from accessing data
-- Note: The pin-login Edge Function will need to check is_disabled
