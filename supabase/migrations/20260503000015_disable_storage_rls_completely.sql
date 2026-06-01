-- Disable RLS for storage objects to make files publicly accessible
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- Make the seller-documents bucket public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'seller-documents';

-- Grant full permissions to authenticated users
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;
GRANT USAGE ON SCHEMA storage TO authenticated;
