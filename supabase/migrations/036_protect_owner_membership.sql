-- Prevent anyone from deleting an owner's membership via RLS.
-- Replace the existing delete policy with one that excludes owner rows.
DROP POLICY IF EXISTS "Owners and admins can remove members" ON workspace_memberships;

CREATE POLICY "Owners and admins can remove non-owner members"
  ON workspace_memberships FOR DELETE
  USING (
    project_id IN (SELECT public.get_user_admin_project_ids(auth.uid()))
    AND role <> 'owner'
  );
