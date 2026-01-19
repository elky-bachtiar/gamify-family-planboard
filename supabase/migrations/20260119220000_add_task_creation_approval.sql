-- Add task creation approval feature
-- When a child creates a task, it needs parent approval before becoming active

-- Add creation approval columns to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS creation_approved boolean DEFAULT true;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS creation_approved_by uuid REFERENCES family_members(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS creation_approved_at timestamptz;

-- Add index for efficient querying of pending creation approvals
CREATE INDEX IF NOT EXISTS idx_tasks_pending_creation_approval
  ON tasks(family_id, creation_approved) WHERE creation_approved = false;

-- Add comment to explain the column
COMMENT ON COLUMN tasks.creation_approved IS 'Whether the task creation has been approved by a parent. Default true for tasks created by parents.';
COMMENT ON COLUMN tasks.creation_approved_by IS 'The family member (parent) who approved the task creation.';
COMMENT ON COLUMN tasks.creation_approved_at IS 'Timestamp when the task creation was approved.';
