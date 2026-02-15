-- Create workspace_memberships table
CREATE TABLE IF NOT EXISTS workspace_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Migrate existing data: make all project owners members
INSERT INTO workspace_memberships (project_id, user_id, role)
SELECT id, user_id, 'owner'
FROM projects
ON CONFLICT (project_id, user_id) DO NOTHING;

-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_memberships ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view projects they're members of
CREATE POLICY "Users can view their workspace projects"
  ON projects FOR SELECT
  USING (
    id IN (
      SELECT project_id FROM workspace_memberships
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can update projects they own/admin
CREATE POLICY "Owners and admins can update projects"
  ON projects FOR UPDATE
  USING (
    id IN (
      SELECT project_id FROM workspace_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- RLS Policy: Users can insert their own projects
CREATE POLICY "Users can create projects"
  ON projects FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS Policy: Only owners can delete projects
CREATE POLICY "Owners can delete projects"
  ON projects FOR DELETE
  USING (
    id IN (
      SELECT project_id FROM workspace_memberships
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- RLS Policy: Users can view areas in their workspaces
CREATE POLICY "Users can view workspace areas"
  ON areas FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM workspace_memberships
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Members can modify areas in their workspaces
CREATE POLICY "Members can modify workspace areas"
  ON areas FOR ALL
  USING (
    project_id IN (
      SELECT project_id FROM workspace_memberships
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can view tasks in their workspaces
CREATE POLICY "Users can view workspace tasks"
  ON tasks FOR SELECT
  USING (
    area_id IN (
      SELECT a.id FROM areas a
      JOIN workspace_memberships wm ON wm.project_id = a.project_id
      WHERE wm.user_id = auth.uid()
    )
  );

-- RLS Policy: Members can modify tasks in their workspaces
CREATE POLICY "Members can modify workspace tasks"
  ON tasks FOR ALL
  USING (
    area_id IN (
      SELECT a.id FROM areas a
      JOIN workspace_memberships wm ON wm.project_id = a.project_id
      WHERE wm.user_id = auth.uid()
    )
  );

-- RLS Policy: Users can view team members in their workspaces
CREATE POLICY "Users can view workspace team members"
  ON team_members FOR SELECT
  USING (
    user_id IN (
      SELECT wm.user_id FROM workspace_memberships wm
      WHERE wm.project_id IN (
        SELECT project_id FROM workspace_memberships
        WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policy: Users can manage team members in their workspaces
CREATE POLICY "Users can manage workspace team members"
  ON team_members FOR ALL
  USING (
    user_id IN (
      SELECT wm.user_id FROM workspace_memberships wm
      WHERE wm.project_id IN (
        SELECT project_id FROM workspace_memberships
        WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policy: Users can view memberships in their workspaces
CREATE POLICY "Users can view workspace memberships"
  ON workspace_memberships FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM workspace_memberships
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Owners and admins can invite users
CREATE POLICY "Owners and admins can invite users"
  ON workspace_memberships FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM workspace_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- RLS Policy: Owners and admins can remove members
CREATE POLICY "Owners and admins can remove members"
  ON workspace_memberships FOR DELETE
  USING (
    project_id IN (
      SELECT project_id FROM workspace_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Create index for faster membership lookups
CREATE INDEX IF NOT EXISTS idx_workspace_memberships_user_id ON workspace_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_memberships_project_id ON workspace_memberships(project_id);
