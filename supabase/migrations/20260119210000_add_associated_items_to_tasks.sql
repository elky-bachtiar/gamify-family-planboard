-- Add associated_items column for task tags/objects
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS associated_items TEXT[] DEFAULT '{}';

-- Create GIN index for efficient array searches
CREATE INDEX IF NOT EXISTS idx_tasks_associated_items ON tasks USING GIN (associated_items);
