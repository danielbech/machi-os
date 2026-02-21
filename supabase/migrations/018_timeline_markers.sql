CREATE TABLE IF NOT EXISTS timeline_markers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label text NOT NULL,
  date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE timeline_markers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timeline_markers_select" ON timeline_markers
  FOR SELECT USING (project_id IN (SELECT get_user_project_ids(auth.uid())));
CREATE POLICY "timeline_markers_insert" ON timeline_markers
  FOR INSERT WITH CHECK (project_id IN (SELECT get_user_admin_project_ids(auth.uid())));
CREATE POLICY "timeline_markers_delete" ON timeline_markers
  FOR DELETE USING (project_id IN (SELECT get_user_admin_project_ids(auth.uid())));

CREATE INDEX timeline_markers_project_id_idx ON timeline_markers(project_id);
