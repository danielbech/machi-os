-- Enable Row Level Security on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;

-- Projects policies
CREATE POLICY "Users can view their own projects"
  ON projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON projects FOR DELETE
  USING (auth.uid() = user_id);

-- Areas policies (access through project ownership)
CREATE POLICY "Users can view areas from their projects"
  ON areas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = areas.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert areas in their projects"
  ON areas FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = areas.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update areas in their projects"
  ON areas FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = areas.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete areas in their projects"
  ON areas FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = areas.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Team members policies
CREATE POLICY "Users can view their own team members"
  ON team_members FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own team members"
  ON team_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own team members"
  ON team_members FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own team members"
  ON team_members FOR DELETE
  USING (auth.uid() = user_id);

-- Tasks policies (access through area -> project ownership)
CREATE POLICY "Users can view tasks from their areas"
  ON tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM areas
      JOIN projects ON projects.id = areas.project_id
      WHERE areas.id = tasks.area_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert tasks in their areas"
  ON tasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM areas
      JOIN projects ON projects.id = areas.project_id
      WHERE areas.id = tasks.area_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update tasks in their areas"
  ON tasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM areas
      JOIN projects ON projects.id = areas.project_id
      WHERE areas.id = tasks.area_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete tasks in their areas"
  ON tasks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM areas
      JOIN projects ON projects.id = areas.project_id
      WHERE areas.id = tasks.area_id
      AND projects.user_id = auth.uid()
    )
  );

-- Task assignees policies (access through task -> area -> project ownership)
CREATE POLICY "Users can view assignees for their tasks"
  ON task_assignees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      JOIN areas ON areas.id = tasks.area_id
      JOIN projects ON projects.id = areas.project_id
      WHERE tasks.id = task_assignees.task_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert assignees for their tasks"
  ON task_assignees FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks
      JOIN areas ON areas.id = tasks.area_id
      JOIN projects ON projects.id = areas.project_id
      WHERE tasks.id = task_assignees.task_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete assignees from their tasks"
  ON task_assignees FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      JOIN areas ON areas.id = tasks.area_id
      JOIN projects ON projects.id = areas.project_id
      WHERE tasks.id = task_assignees.task_id
      AND projects.user_id = auth.uid()
    )
  );
