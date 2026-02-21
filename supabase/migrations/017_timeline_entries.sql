CREATE TABLE IF NOT EXISTS timeline_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  start_date date NOT NULL,
  end_date date NOT NULL,
  color text NOT NULL DEFAULT 'blue',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT timeline_entries_dates_check CHECK (end_date >= start_date)
);

ALTER TABLE timeline_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as clients table)
CREATE POLICY "timeline_entries_select" ON timeline_entries
  FOR SELECT USING (project_id IN (SELECT get_user_project_ids(auth.uid())));
CREATE POLICY "timeline_entries_insert" ON timeline_entries
  FOR INSERT WITH CHECK (project_id IN (SELECT get_user_admin_project_ids(auth.uid())));
CREATE POLICY "timeline_entries_update" ON timeline_entries
  FOR UPDATE USING (project_id IN (SELECT get_user_admin_project_ids(auth.uid())));
CREATE POLICY "timeline_entries_delete" ON timeline_entries
  FOR DELETE USING (project_id IN (SELECT get_user_admin_project_ids(auth.uid())));

CREATE INDEX timeline_entries_project_id_idx ON timeline_entries(project_id);
CREATE INDEX timeline_entries_client_id_idx ON timeline_entries(client_id);
