-- Make the seller-documents bucket public without touching storage RLS
UPDATE storage.buckets 
SET public = true 
WHERE id = 'seller-documents';

-- Grant permissions for authenticated users to access storage
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT SELECT ON storage.buckets TO authenticated;
GRANT ALL ON storage.objects TO authenticated;
