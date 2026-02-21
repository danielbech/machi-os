-- Fix: Restrict calendar_connections SELECT so users can only see their own access tokens.
-- Other workspace members can still see connection metadata (google_email, selected_calendars)
-- but NOT the access_token of other users.

-- Drop the existing permissive policy
DROP POLICY IF EXISTS "Members can view calendar connections" ON calendar_connections;

-- New policy: only see your own connections (includes access_token)
CREATE POLICY "Users can view own calendar connections"
  ON calendar_connections FOR SELECT
  USING (user_id = auth.uid());

-- Add composite index on tasks for common query patterns:
-- loadTasksByDay: WHERE area_id = ? AND day IS NOT NULL ORDER BY sort_order
-- loadBacklogTasks: WHERE area_id = ? AND day IS NULL ORDER BY sort_order
CREATE INDEX IF NOT EXISTS idx_tasks_area_day_sort
  ON tasks (area_id, day, sort_order);
