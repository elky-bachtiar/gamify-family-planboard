-- Add start_time column (time only, no date)
-- This enables bulk updates for recurring tasks without updating each task individually
ALTER TABLE tasks ADD COLUMN start_time time;

-- Populate from existing start_datetime values
UPDATE tasks
SET start_time = start_datetime::time
WHERE start_datetime IS NOT NULL;

-- Add index for filtering tasks by start time
CREATE INDEX idx_tasks_start_time ON tasks(start_time);
