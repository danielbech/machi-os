-- Add parent_id for nested sub-items (milestones + sub-gantt items)
ALTER TABLE timeline_entries
  ADD COLUMN parent_id uuid REFERENCES timeline_entries(id) ON DELETE CASCADE;

CREATE INDEX timeline_entries_parent_id_idx ON timeline_entries(parent_id);
