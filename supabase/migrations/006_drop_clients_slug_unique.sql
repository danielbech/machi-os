-- Allow multiple clients to share the same keyboard shortcut (slug)
-- Pressing the key cycles through matching clients

ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_project_id_slug_key;
