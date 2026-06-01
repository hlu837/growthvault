-- Create storage bucket for seller documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'seller-documents',
    'seller-documents',
    false,
    10485760,
    '{image/jpeg,image/png,image/jpg,application/pdf}'
) ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload own seller documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own seller documents" ON storage.objects;

-- Create RLS policies for storage bucket
CREATE POLICY "Users can upload own seller documents" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'seller-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own seller documents" ON storage.objects
FOR SELECT USING (
  bucket_id = 'seller-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own seller documents" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'seller-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own seller documents" ON storage.objects
FOR DELETE USING (
  bucket_id = 'seller-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;
GRANT ALL ON storage.objects TO authenticated;
