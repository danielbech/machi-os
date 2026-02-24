-- Allow users to create their own membership for projects they own.
-- Without this, initializeUserData fails for fresh signups because
-- the existing INSERT policy requires the user to already be an admin.
CREATE POLICY "Users can join own projects"
  ON workspace_memberships FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );
