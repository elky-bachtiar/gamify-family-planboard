-- Add recurring task support to tasks table
-- This allows tasks to be created as recurring (daily, weekly, or specific days)

-- Add new columns to tasks table
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT CHECK (recurrence_pattern IN ('daily', 'weekly', 'specific_days')),
ADD COLUMN IF NOT EXISTS recurrence_days INTEGER[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS recurrence_end_date DATE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS recurring_task_group_id UUID DEFAULT NULL;

-- Add index for looking up tasks by their recurring group
CREATE INDEX IF NOT EXISTS idx_tasks_recurring_task_group_id ON tasks(recurring_task_group_id) WHERE recurring_task_group_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN tasks.recurrence_pattern IS 'Pattern for recurring tasks: daily, weekly (same weekday), or specific_days (chosen weekdays)';
COMMENT ON COLUMN tasks.recurrence_days IS 'Array of weekday numbers [0-6] where 0=Sunday, used when recurrence_pattern is specific_days';
COMMENT ON COLUMN tasks.recurrence_end_date IS 'End date for recurring task generation';
COMMENT ON COLUMN tasks.recurring_task_group_id IS 'UUID that links all instances of a recurring task together';
