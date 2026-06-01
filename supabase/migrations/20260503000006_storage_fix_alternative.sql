-- Alternative approach: Create bucket with public access temporarily
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'seller-documents',
    'seller-documents',
    true,  -- Make public temporarily
    10485760,
    '{image/jpeg,image/png,image/jpg,application/pdf}'
) ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = '{image/jpeg,image/png,image/jpg,application/pdf}';

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT SELECT ON storage.buckets TO authenticated;
GRANT ALL ON storage.objects TO authenticated;

-- Create a permissive policy for uploads
CREATE POLICY "Allow all authenticated users to upload" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'seller-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Allow all authenticated users to view" ON storage.objects
FOR SELECT USING (bucket_id = 'seller-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Allow all authenticated users to update" ON storage.objects
FOR UPDATE USING (bucket_id = 'seller-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Allow all authenticated users to delete" ON storage.objects
FOR DELETE USING (bucket_id = 'seller-documents' AND auth.role() = 'authenticated');
