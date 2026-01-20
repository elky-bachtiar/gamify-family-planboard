-- Add start_datetime column to tasks table for time-range visibility
-- Tasks will only be visible to children between start_datetime and due_datetime + 1 hour

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_datetime timestamptz;

-- Index for efficient filtering by start_datetime
CREATE INDEX IF NOT EXISTS idx_tasks_start_datetime ON tasks(start_datetime);
