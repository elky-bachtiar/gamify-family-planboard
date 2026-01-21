-- Add is_weekly_task field to tasks table
-- Weekly tasks can be completed on any day of the week they belong to

ALTER TABLE tasks
ADD COLUMN is_weekly_task boolean NOT NULL DEFAULT false;

-- Add an index for efficient querying of weekly tasks
CREATE INDEX idx_tasks_weekly ON tasks (family_id, is_weekly_task, due_date)
WHERE is_weekly_task = true;

-- Comment explaining the field
COMMENT ON COLUMN tasks.is_weekly_task IS 'When true, this task can be completed on any day of the week containing due_date. due_date should be set to the Sunday (end) of the target week.';
