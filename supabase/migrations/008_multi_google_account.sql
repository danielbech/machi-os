-- Support multiple Google accounts per user per workspace

-- Add google_email column to identify which Google account
ALTER TABLE calendar_connections ADD COLUMN google_email text;

-- Drop old unique constraint (one connection per user per workspace)
ALTER TABLE calendar_connections DROP CONSTRAINT calendar_connections_project_id_user_id_key;

-- New unique constraint (one connection per Google account per user per workspace)
ALTER TABLE calendar_connections ADD CONSTRAINT calendar_connections_project_id_user_id_google_email_key
  UNIQUE(project_id, user_id, google_email);

-- Tie calendar_events to their connection for cascade delete on disconnect
ALTER TABLE calendar_events ADD COLUMN connection_id uuid REFERENCES calendar_connections(id) ON DELETE CASCADE;
