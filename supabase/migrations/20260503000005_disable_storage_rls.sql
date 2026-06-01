-- Temporarily disable RLS for storage to allow uploads
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'seller-documents',
    'seller-documents',
    false,
    10485760,
    '{image/jpeg,image/png,image/jpg,application/pdf}'
) ON CONFLICT (id) DO NOTHING;

-- Grant permissions to authenticated users
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;
GRANT USAGE ON SCHEMA storage TO authenticated;
