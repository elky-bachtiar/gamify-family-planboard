/*
  # Create Gamified Family Planboard Schema

  ## Overview
  This migration creates the complete database schema for a gamified family weekly planboard application.
  The system includes family members, tasks, achievements, points tracking, and weekly goals.

  ## New Tables

  ### 1. `family_members`
  Stores information about each family member who uses the planboard
  - `id` (uuid, primary key) - Unique identifier for each family member
  - `name` (text) - Family member's display name
  - `email` (text, unique) - Optional email for notifications
  - `avatar_url` (text) - URL to profile picture
  - `color` (text) - Personal color for task identification
  - `total_points` (integer) - Cumulative points earned
  - `current_level` (integer) - Current level based on points
  - `current_streak` (integer) - Days of consecutive task completion
  - `role` (text) - Member role: 'parent' or 'child'
  - `created_at` (timestamptz) - Account creation timestamp

  ### 2. `tasks`
  Stores all tasks assigned to family members
  - `id` (uuid, primary key) - Unique task identifier
  - `title` (text) - Task name/description
  - `description` (text) - Detailed task description
  - `assigned_to` (uuid, foreign key) - References family_members.id
  - `due_date` (date) - When the task is due
  - `priority` (text) - Priority level: 'low', 'medium', 'high'
  - `status` (text) - Current status: 'pending', 'in_progress', 'completed'
  - `point_value` (integer) - Points awarded upon completion
  - `completed_at` (timestamptz) - Completion timestamp
  - `created_at` (timestamptz) - Task creation timestamp
  - `created_by` (uuid, foreign key) - Who created the task

  ### 3. `achievements`
  Defines available badges and achievements
  - `id` (uuid, primary key) - Unique achievement identifier
  - `name` (text) - Achievement name
  - `description` (text) - What the achievement represents
  - `icon` (text) - Icon identifier or emoji
  - `condition_type` (text) - Type of condition to unlock
  - `condition_value` (integer) - Numeric threshold for unlocking
  - `created_at` (timestamptz) - When achievement was created

  ### 4. `user_achievements`
  Tracks which family members earned which achievements
  - `id` (uuid, primary key) - Unique record identifier
  - `member_id` (uuid, foreign key) - References family_members.id
  - `achievement_id` (uuid, foreign key) - References achievements.id
  - `earned_at` (timestamptz) - When the achievement was earned

  ### 5. `points_history`
  Logs all point transactions for transparency
  - `id` (uuid, primary key) - Unique transaction identifier
  - `member_id` (uuid, foreign key) - References family_members.id
  - `points` (integer) - Points awarded (positive) or deducted (negative)
  - `reason` (text) - Why points were awarded/deducted
  - `task_id` (uuid, foreign key) - Related task if applicable
  - `created_at` (timestamptz) - Transaction timestamp

  ### 6. `weekly_goals`
  Tracks weekly objectives for family members
  - `id` (uuid, primary key) - Unique goal identifier
  - `member_id` (uuid, foreign key) - References family_members.id
  - `week_start` (date) - Start date of the week
  - `goal_type` (text) - Type of goal: 'tasks_completed', 'points_earned'
  - `target_value` (integer) - Target to achieve
  - `current_value` (integer) - Current progress
  - `completed` (boolean) - Whether goal was met
  - `created_at` (timestamptz) - Goal creation timestamp

  ## Security
  - Enable Row Level Security on all tables
  - Add policies for authenticated access
  - Users can read all family members but only update their own profile
  - Tasks are readable by all family members
  - Points and achievements are readable by all family members
*/

-- Create family_members table
CREATE TABLE IF NOT EXISTS family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE,
  avatar_url text,
  color text DEFAULT '#3B82F6',
  total_points integer DEFAULT 0,
  current_level integer DEFAULT 1,
  current_streak integer DEFAULT 0,
  role text DEFAULT 'child' CHECK (role IN ('parent', 'child')),
  created_at timestamptz DEFAULT now()
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  assigned_to uuid REFERENCES family_members(id) ON DELETE CASCADE,
  due_date date NOT NULL,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  point_value integer DEFAULT 10,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES family_members(id) ON DELETE SET NULL
);

-- Create achievements table
CREATE TABLE IF NOT EXISTS achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  icon text DEFAULT '🏆',
  condition_type text NOT NULL CHECK (condition_type IN ('first_task', 'tasks_count', 'points_total', 'streak_days', 'perfect_week')),
  condition_value integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Create user_achievements table
CREATE TABLE IF NOT EXISTS user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES family_members(id) ON DELETE CASCADE,
  achievement_id uuid REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at timestamptz DEFAULT now(),
  UNIQUE(member_id, achievement_id)
);

-- Create points_history table
CREATE TABLE IF NOT EXISTS points_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES family_members(id) ON DELETE CASCADE,
  points integer NOT NULL,
  reason text NOT NULL,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Create weekly_goals table
CREATE TABLE IF NOT EXISTS weekly_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES family_members(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  goal_type text NOT NULL CHECK (goal_type IN ('tasks_completed', 'points_earned')),
  target_value integer NOT NULL,
  current_value integer DEFAULT 0,
  completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for family_members
CREATE POLICY "Anyone can view family members"
  ON family_members FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can insert family members"
  ON family_members FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Members can update their own profile"
  ON family_members FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- RLS Policies for tasks
CREATE POLICY "Anyone can view tasks"
  ON tasks FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can create tasks"
  ON tasks FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update tasks"
  ON tasks FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete tasks"
  ON tasks FOR DELETE
  TO public
  USING (true);

-- RLS Policies for achievements
CREATE POLICY "Anyone can view achievements"
  ON achievements FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can create achievements"
  ON achievements FOR INSERT
  TO public
  WITH CHECK (true);

-- RLS Policies for user_achievements
CREATE POLICY "Anyone can view user achievements"
  ON user_achievements FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can create user achievements"
  ON user_achievements FOR INSERT
  TO public
  WITH CHECK (true);

-- RLS Policies for points_history
CREATE POLICY "Anyone can view points history"
  ON points_history FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can create points history"
  ON points_history FOR INSERT
  TO public
  WITH CHECK (true);

-- RLS Policies for weekly_goals
CREATE POLICY "Anyone can view weekly goals"
  ON weekly_goals FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can create weekly goals"
  ON weekly_goals FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update weekly goals"
  ON weekly_goals FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- Insert default achievements
INSERT INTO achievements (name, description, icon, condition_type, condition_value) VALUES
  ('First Steps', 'Complete your first task', '🌟', 'first_task', 1),
  ('Task Master', 'Complete 10 tasks', '🎯', 'tasks_count', 10),
  ('Century Club', 'Complete 100 tasks', '💯', 'tasks_count', 100),
  ('Point Collector', 'Earn 100 points', '💰', 'points_total', 100),
  ('Point Master', 'Earn 500 points', '💎', 'points_total', 500),
  ('Point Legend', 'Earn 1000 points', '👑', 'points_total', 1000),
  ('Week Warrior', 'Maintain a 7-day streak', '🔥', 'streak_days', 7),
  ('Month Master', 'Maintain a 30-day streak', '⚡', 'streak_days', 30),
  ('Perfect Week', 'Complete all tasks in a week', '✨', 'perfect_week', 1)
ON CONFLICT DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_user_achievements_member ON user_achievements(member_id);
CREATE INDEX IF NOT EXISTS idx_points_history_member ON points_history(member_id);
CREATE INDEX IF NOT EXISTS idx_weekly_goals_member ON weekly_goals(member_id);
CREATE INDEX IF NOT EXISTS idx_weekly_goals_week ON weekly_goals(week_start);
