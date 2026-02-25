-- Storage policies for the task-images bucket

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload task images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'task-images');

-- Allow authenticated users to delete their uploaded images
CREATE POLICY "Authenticated users can delete task images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'task-images');

-- Allow public read access (bucket is public)
CREATE POLICY "Public read access for task images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'task-images');
