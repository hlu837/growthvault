-- Create storage bucket for KYC documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for kyc-documents bucket
-- Users can upload their own documents
CREATE POLICY "Users can upload own kyc documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'kyc-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can view their own documents
CREATE POLICY "Users can view own kyc documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'kyc-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Staff/Admin can view all KYC documents
CREATE POLICY "Staff can view all kyc documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'kyc-documents' 
  AND is_admin_or_staff(auth.uid())
);

-- Add KYC document fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS id_type text,
ADD COLUMN IF NOT EXISTS id_number text,
ADD COLUMN IF NOT EXISTS kyc_document_url text,
ADD COLUMN IF NOT EXISTS kyc_submitted_at timestamp with time zone;