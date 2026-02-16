-- Add proper columns for task metadata (previously encoded in description field)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignees JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS client TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority TEXT CHECK (priority IN ('low', 'medium', 'high'));

-- Migrate existing data from __META__:json__END__ encoding in description
UPDATE tasks
SET
  assignees = COALESCE(
    (regexp_match(description, '__META__:(.*?)__END__'))[1]::jsonb -> 'assignees',
    '[]'::jsonb
  ),
  client = (regexp_match(description, '__META__:(.*?)__END__'))[1]::jsonb ->> 'client',
  priority = (regexp_match(description, '__META__:(.*?)__END__'))[1]::jsonb ->> 'priority',
  description = CASE
    WHEN description LIKE '__META__%__END__%'
    THEN nullif(trim(substring(description FROM position('__END__' IN description) + 7)), '')
    ELSE description
  END
WHERE description LIKE '__META__%';
