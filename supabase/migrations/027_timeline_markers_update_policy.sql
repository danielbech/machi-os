CREATE POLICY "timeline_markers_update" ON timeline_markers
  FOR UPDATE USING (project_id IN (SELECT get_user_admin_project_ids(auth.uid())));
