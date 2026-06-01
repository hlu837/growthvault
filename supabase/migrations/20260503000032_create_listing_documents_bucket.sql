-- Create listing_documents bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('listing_documents', 'listing_documents', true)
ON CONFLICT (id) DO NOTHING;

-- Set up security policies for the bucket
-- Allow public read access to listing documents
CREATE POLICY "Public Access" ON storage.objects
    FOR SELECT USING (bucket_id = 'listing_documents');

-- Allow authenticated users to upload documents
CREATE POLICY "Authenticated users can upload documents" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'listing_documents' 
        AND auth.role() = 'authenticated'
    );

-- Allow users to update their own documents
CREATE POLICY "Users can update their own documents" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'listing_documents' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Allow users to delete their own documents
CREATE POLICY "Users can delete their own documents" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'listing_documents' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );
