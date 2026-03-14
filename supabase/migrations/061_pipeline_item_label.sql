-- Add label column to pipeline items for partial invoice descriptions
ALTER TABLE pipeline_items ADD COLUMN label text NOT NULL DEFAULT '';
