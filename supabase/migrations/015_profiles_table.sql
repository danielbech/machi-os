-- Profiles table: one row per auth user with display info + avatar
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  initials text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT 'bg-blue-500',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read profiles of anyone in their workspace
CREATE POLICY "profiles_select_workspace"
  ON profiles FOR SELECT
  USING (
    user_id IN (
      SELECT wm2.user_id FROM workspace_memberships wm1
      JOIN workspace_memberships wm2 ON wm1.project_id = wm2.project_id
      WHERE wm1.user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

-- Users can insert their own profile
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update only their own profile
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (user_id = auth.uid());

-- Reset all task assignees (user confirmed reset)
UPDATE tasks SET assignees = '[]'::jsonb;
