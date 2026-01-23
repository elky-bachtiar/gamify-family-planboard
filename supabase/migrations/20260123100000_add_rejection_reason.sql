-- Add columns for task rejection tracking
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS rejection_reason text,
ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES family_members(id) ON DELETE SET NULL;
