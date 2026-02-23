-- Replace the old unique constraint with one that supports per-connection upserts.
-- Old: UNIQUE(project_id, user_id, google_event_id)
-- New: UNIQUE(connection_id, google_event_id)
-- This is more precise (scoped to connection, not user) and allows atomic upsert syncs.

ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_project_id_user_id_google_event_id_key;

ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_connection_google_event_unique
  UNIQUE (connection_id, google_event_id);
