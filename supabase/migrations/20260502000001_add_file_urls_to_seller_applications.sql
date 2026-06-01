-- Add file URL columns to seller_applications table
ALTER TABLE public.seller_applications 
ADD COLUMN IF NOT EXISTS kyc_document_urls JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS business_document_urls JSONB DEFAULT '[]'::jsonb;

-- Create storage bucket for seller documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'seller-documents', 
    'seller-documents', 
    false, -- private bucket
    10485760, -- 10MB limit
    ARRAY['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for storage bucket
CREATE POLICY "Users can upload own seller documents"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'seller-documents' AND 
        (storage.foldername(name))[1] = auth.uid()::TEXT
    );

CREATE POLICY "Users can view own seller documents"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'seller-documents' AND 
        (storage.foldername(name))[1] = auth.uid()::TEXT
    );

CREATE POLICY "Admins and staff can view all seller documents"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'seller-documents' AND
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.profiles p ON p.id = ur.user_id
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'staff')
        )
    );

-- Create function to get public URL for private files
CREATE OR REPLACE FUNCTION public.get_document_url(p_file_path TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Generate signed URL for private files
    RETURN (
        SELECT public_url 
        FROM storage.objects 
        WHERE bucket_id = 'seller-documents' AND name = p_file_path
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_document_url TO authenticated;
