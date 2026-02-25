-- Custom board columns for "custom" week mode
CREATE TABLE IF NOT EXISTS board_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE board_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view board columns for their projects"
  ON board_columns FOR SELECT
  USING (project_id IN (SELECT get_user_project_ids(auth.uid())));

CREATE POLICY "board_columns_insert"
  ON board_columns FOR INSERT
  WITH CHECK (project_id IN (SELECT get_user_project_ids(auth.uid())));

CREATE POLICY "board_columns_update"
  ON board_columns FOR UPDATE
  USING (project_id IN (SELECT get_user_admin_project_ids(auth.uid())));

CREATE POLICY "board_columns_delete"
  ON board_columns FOR DELETE
  USING (project_id IN (SELECT get_user_admin_project_ids(auth.uid())));
