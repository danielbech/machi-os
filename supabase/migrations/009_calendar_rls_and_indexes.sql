-- Fix RLS: calendar INSERT/UPDATE policies should also check workspace membership

-- Drop existing INSERT/UPDATE policies
DROP POLICY IF EXISTS "Users can insert own calendar connection" ON calendar_connections;
DROP POLICY IF EXISTS "Users can update own calendar connection" ON calendar_connections;
DROP POLICY IF EXISTS "Users can insert own calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Users can update own calendar events" ON calendar_events;

-- Recreate with workspace membership check
CREATE POLICY "Users can insert own calendar connection"
  ON calendar_connections FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND project_id IN (SELECT public.get_user_project_ids(auth.uid()))
  );

CREATE POLICY "Users can update own calendar connection"
  ON calendar_connections FOR UPDATE
  USING (
    auth.uid() = user_id
    AND project_id IN (SELECT public.get_user_project_ids(auth.uid()))
  );

CREATE POLICY "Users can insert own calendar events"
  ON calendar_events FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND project_id IN (SELECT public.get_user_project_ids(auth.uid()))
  );

CREATE POLICY "Users can update own calendar events"
  ON calendar_events FOR UPDATE
  USING (
    auth.uid() = user_id
    AND project_id IN (SELECT public.get_user_project_ids(auth.uid()))
  );

-- Add indexes for calendar tables
CREATE INDEX IF NOT EXISTS idx_calendar_connections_project_user ON calendar_connections(project_id, user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_project_id ON calendar_events(project_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_connection_id ON calendar_events(connection_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);
