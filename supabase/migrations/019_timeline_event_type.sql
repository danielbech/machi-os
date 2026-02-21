-- Allow timeline entries without a client (for events like holidays, workshops)
ALTER TABLE timeline_entries ALTER COLUMN client_id DROP NOT NULL;

-- Add entry type: 'project' for client-linked entries, 'event' for standalone
ALTER TABLE timeline_entries ADD COLUMN type text NOT NULL DEFAULT 'project';
