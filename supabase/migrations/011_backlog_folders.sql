-- Backlog folders: organize tasks within clients
CREATE TABLE backlog_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE backlog_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view backlog folders in their projects"
  ON backlog_folders FOR SELECT
  USING (area_id IN (SELECT id FROM areas WHERE project_id IN (SELECT get_user_project_ids(auth.uid()))));

CREATE POLICY "Users can create backlog folders in their projects"
  ON backlog_folders FOR INSERT
  WITH CHECK (area_id IN (SELECT id FROM areas WHERE project_id IN (SELECT get_user_project_ids(auth.uid()))));

CREATE POLICY "Users can update backlog folders in their projects"
  ON backlog_folders FOR UPDATE
  USING (area_id IN (SELECT id FROM areas WHERE project_id IN (SELECT get_user_project_ids(auth.uid()))));

CREATE POLICY "Users can delete backlog folders in their projects"
  ON backlog_folders FOR DELETE
  USING (area_id IN (SELECT id FROM areas WHERE project_id IN (SELECT get_user_project_ids(auth.uid()))));

-- Add folder_id to tasks
ALTER TABLE tasks ADD COLUMN folder_id UUID REFERENCES backlog_folders(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX idx_backlog_folders_area_client ON backlog_folders(area_id, client_id);
CREATE INDEX idx_tasks_folder_id ON tasks(folder_id);
