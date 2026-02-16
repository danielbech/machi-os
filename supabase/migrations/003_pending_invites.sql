-- Pending invites table
CREATE TABLE pending_invites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Unique constraint: one invite per email per project
CREATE UNIQUE INDEX pending_invites_project_email ON pending_invites(project_id, email);

-- Enable RLS
ALTER TABLE pending_invites ENABLE ROW LEVEL SECURITY;

-- Policy: project admins/owners can see and manage invites for their projects
CREATE POLICY "Admins can manage invites"
  ON pending_invites
  FOR ALL
  USING (
    project_id IN (SELECT get_user_admin_project_ids(auth.uid()))
  )
  WITH CHECK (
    project_id IN (SELECT get_user_admin_project_ids(auth.uid()))
  );

-- Policy: users can see invites addressed to their email
CREATE POLICY "Users can see own invites"
  ON pending_invites
  FOR SELECT
  USING (
    email = (SELECT auth.jwt()->>'email')
  );

-- Function: look up a user ID by email (SECURITY DEFINER to access auth.users)
CREATE OR REPLACE FUNCTION get_user_id_by_email(lookup_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  found_id uuid;
BEGIN
  SELECT id INTO found_id
  FROM auth.users
  WHERE email = lookup_email;

  RETURN found_id;
END;
$$;

-- Revoke direct execution from anon/authenticated — only service role can call this
REVOKE EXECUTE ON FUNCTION get_user_id_by_email(text) FROM anon, authenticated;

-- Function: accept pending invites for the current user
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

  -- Process each pending invite for this email
  FOR invite IN
    SELECT pi.id, pi.project_id, pi.role
    FROM public.pending_invites pi
    WHERE pi.email = user_email
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
