-- Add pending_approval status to tasks
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('pending', 'in_progress', 'pending_approval', 'completed'));

-- Add tracking columns for approval workflow
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES family_members(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES family_members(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Index for efficient pending_approval queries
CREATE INDEX IF NOT EXISTS idx_tasks_pending_approval
  ON tasks(family_id, status) WHERE status = 'pending_approval';

-- Comment explaining the workflow
COMMENT ON COLUMN tasks.completed_by IS 'The family member who marked this task as done (awaiting approval for non-admins)';
COMMENT ON COLUMN tasks.approved_by IS 'The admin who approved this task completion';
COMMENT ON COLUMN tasks.approved_at IS 'When the task was approved by an admin';
