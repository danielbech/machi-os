# Task Image Uploads Plan

## Overview
Add drag-and-drop image uploads to the task edit dialog. No upload button — just drop an image onto the dialog and it appears as a preview. Images are stored in Supabase Storage and referenced by URL in the task.

## UX Flow
1. User opens task edit dialog
2. Drags an image file onto the dialog (or pastes from clipboard)
3. Image uploads immediately, shows a loading placeholder, then renders as a thumbnail preview
4. Multiple images supported — displayed as a row/grid of thumbnails
5. Click X on a thumbnail to remove it
6. Images persist with the task

## Implementation Steps

### 1. Database: Add images column to tasks
- Create migration `supabase/migrations/040_task_images.sql`
- Add `images text[] default '{}'` column to tasks table
- Stores array of Supabase Storage public URLs

### 2. Supabase Storage: Create task-images bucket
- Add `uploadTaskImage(file, taskId)` and `deleteTaskImage(url)` to `lib/supabase/storage.ts`
- Use a dedicated `task-images` bucket (or subfolder in existing bucket)
- Path: `task-images/{taskId}/{timestamp}-{filename}`
- Return public URL after upload
- **Note:** Bucket needs to be created in Supabase dashboard (Storage → New bucket → public)

### 3. Update Task type
- In `lib/types.ts`, add `images?: string[]` to the Task interface

### 4. Update saveTask function
- In `lib/supabase/tasks-simple.ts`, include `images` in the insert/update payload

### 5. Task Edit Dialog: Drop zone + previews
- In `components/task-edit-dialog.tsx`:
  - Wrap the entire `DialogContent` in a drop zone (onDragOver, onDrop handlers)
  - Show a subtle overlay when dragging over ("Drop image here")
  - On drop: validate file (reuse `validateImageFile` from `lib/validate-file.ts`), upload to storage, add URL to task.images
  - Also support paste (onPaste handler for clipboard images)
  - Show image previews below the description, above the checklist:
    ```
    [Title]
    [Project | Assignee]
    [Description]
    [Image thumbnails]    ← new
    [Checklist]
    [Cancel | Save]
    ```
  - Each thumbnail: ~80px, rounded, with an X button on hover to remove
  - Show a loading skeleton while uploading
  - Max file size: 5MB (already validated by existing util)
  - Allowed types: jpeg, png, gif, webp (already in validate-file.ts)

### 6. Board card preview (optional enhancement)
- In `components/board-task-card.tsx`: if task has images, show a small image indicator or first image as a tiny thumbnail
- Keep it subtle — maybe just a small image icon with count, similar to checklist count

## Files to modify
- `lib/types.ts` — add `images` field
- `lib/supabase/storage.ts` — add upload/delete functions for task images
- `lib/supabase/tasks-simple.ts` — include images in save payload
- `components/task-edit-dialog.tsx` — drop zone, paste handler, image previews
- `supabase/migrations/040_task_images.sql` — new migration

## Files to potentially modify
- `components/board-task-card.tsx` — optional image indicator on cards
- `lib/validate-file.ts` — already exists, reuse as-is

## Existing infrastructure to reuse
- `lib/supabase/storage.ts` — pattern for Supabase Storage uploads (client logos)
- `lib/validate-file.ts` — file validation (5MB, image types)
- `lib/supabase/client.ts` — Supabase browser client

## Migration SQL
```sql
-- Add images array column to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}';
```

## Notes
- Bucket `task-images` must be created manually in Supabase dashboard before use (set to public)
- RLS on storage: allow authenticated users to upload/delete in the bucket
- Consider adding a storage policy: users can only delete images from tasks in their workspaces
