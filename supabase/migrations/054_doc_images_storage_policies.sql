-- Storage policies for the doc-images bucket

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload doc images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'doc-images');

-- Allow authenticated users to delete their uploaded images
CREATE POLICY "Authenticated users can delete doc images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'doc-images');

-- Allow public read access (bucket is public)
CREATE POLICY "Public read access for doc images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'doc-images');
