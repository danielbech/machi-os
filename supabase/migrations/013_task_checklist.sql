ALTER TABLE tasks ADD COLUMN checklist JSONB DEFAULT '[]'::jsonb;
