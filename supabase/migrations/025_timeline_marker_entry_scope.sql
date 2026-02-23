ALTER TABLE timeline_markers
  ADD COLUMN entry_id uuid REFERENCES timeline_entries(id) ON DELETE CASCADE;
CREATE INDEX timeline_markers_entry_id_idx ON timeline_markers(entry_id);
