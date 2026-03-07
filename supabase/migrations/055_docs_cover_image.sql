-- Add cover_image column to docs table
ALTER TABLE docs ADD COLUMN IF NOT EXISTS cover_image text;
