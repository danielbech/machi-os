-- Allow users to create their own membership for projects they own.
-- Without this, initializeUserData fails for fresh signups because
-- the existing INSERT policy requires the user to already be an admin.
--
-- We need a SECURITY DEFINER function to check project ownership because
-- the projects table has RLS that requires a membership to SELECT — creating
-- a circular dependency. This function bypasses projects RLS.

CREATE OR REPLACE FUNCTION public.get_user_owned_project_ids(uid UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM projects WHERE user_id = uid;
$$;

-- Drop the broken policy if it was already applied
DROP POLICY IF EXISTS "Users can join own projects" ON workspace_memberships;

CREATE POLICY "Users can join own projects"
  ON workspace_memberships FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND project_id IN (
      SELECT public.get_user_owned_project_ids(auth.uid())
    )
  );
