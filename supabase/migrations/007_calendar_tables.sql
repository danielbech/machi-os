-- Calendar connections: stores each user's Google Calendar OAuth token per workspace
CREATE TABLE calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  selected_calendars text[] NOT NULL DEFAULT '{primary}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Calendar events: cached events synced from Google, shared with all workspace members
CREATE TABLE calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_event_id text NOT NULL,
  calendar_id text NOT NULL DEFAULT 'primary',
  summary text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  location text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id, google_event_id)
);

-- Enable RLS
ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- calendar_connections: workspace members can view all connections
CREATE POLICY "Members can view calendar connections"
  ON calendar_connections FOR SELECT
  USING (project_id IN (SELECT get_user_project_ids()));

-- calendar_connections: users can manage their own connection
CREATE POLICY "Users can insert own calendar connection"
  ON calendar_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar connection"
  ON calendar_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar connection"
  ON calendar_connections FOR DELETE
  USING (auth.uid() = user_id);

-- calendar_events: workspace members can view all events
CREATE POLICY "Members can view calendar events"
  ON calendar_events FOR SELECT
  USING (project_id IN (SELECT get_user_project_ids()));

-- calendar_events: users can manage their own events
CREATE POLICY "Users can insert own calendar events"
  ON calendar_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar events"
  ON calendar_events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar events"
  ON calendar_events FOR DELETE
  USING (auth.uid() = user_id);
