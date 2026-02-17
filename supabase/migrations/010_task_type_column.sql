-- Add type column to tasks (task vs note)
ALTER TABLE tasks ADD COLUMN type text NOT NULL DEFAULT 'task';
ALTER TABLE tasks ADD CONSTRAINT tasks_type_check CHECK (type IN ('task', 'note'));
