-- Fix email case-sensitivity in invite acceptance
-- and make initialization idempotent for race conditions

-- 1. Fix accept_pending_invites to use case-insensitive email matching
CREATE OR REPLACE FUNCTION accept_pending_invites()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  invite RECORD;
  user_email text;
BEGIN
  -- Get current user's email
  SELECT au.email INTO user_email
  FROM auth.users au
  WHERE au.id = auth.uid();

  IF user_email IS NULL THEN
    RETURN;
  END IF;

  -- Process each pending invite for this email (case-insensitive)
  FOR invite IN
    SELECT pi.id, pi.project_id, pi.role
    FROM public.pending_invites pi
    WHERE LOWER(pi.email) = LOWER(user_email)
  LOOP
    -- Create membership if not already exists
    INSERT INTO public.workspace_memberships (project_id, user_id, role)
    VALUES (invite.project_id, auth.uid(), invite.role)
    ON CONFLICT DO NOTHING;

    -- Delete the processed invite
    DELETE FROM public.pending_invites WHERE id = invite.id;
  END LOOP;
END;
$$;

-- 2. Also fix the email lookup in "Users can see own invites" policy
-- to be case-insensitive
DROP POLICY IF EXISTS "Users can see own invites" ON pending_invites;
CREATE POLICY "Users can see own invites"
  ON pending_invites
  FOR SELECT
  USING (
    LOWER(email) = LOWER((SELECT auth.jwt()->>'email'))
  );

-- 3. Make profiles visible to all authenticated users (for feedback author display)
-- Currently profiles are only visible within shared workspaces, which breaks
-- the global feedback page for cross-workspace users
DROP POLICY IF EXISTS "profiles_select_workspace" ON profiles;
CREATE POLICY "profiles_select_authenticated"
  ON profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);
