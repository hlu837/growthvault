-- Create document_verifications table to track admin verification of marketplace documents
CREATE TABLE IF NOT EXISTS public.document_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.marketplace_documents(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  verification_timestamp TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_verifications_document_id ON public.document_verifications(document_id);
CREATE INDEX IF NOT EXISTS idx_document_verifications_admin_id ON public.document_verifications(admin_id);

-- Ensure only one verification per document per admin
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_document_admin_verification
  ON public.document_verifications(document_id, admin_id);

ALTER TABLE public.document_verifications ENABLE ROW LEVEL SECURITY;

-- Only admins can view verifications
CREATE POLICY "Admins can view document verifications"
  ON public.document_verifications FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can insert verifications
CREATE POLICY "Admins can create document verifications"
  ON public.document_verifications FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Function to verify document authenticity
CREATE OR REPLACE FUNCTION public.verify_document_authenticity(p_document_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  -- Check if user is admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  -- Check if document exists
  IF NOT EXISTS (SELECT 1 FROM public.marketplace_documents WHERE id = p_document_id) THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  -- Insert verification record (will fail if already verified by this admin due to unique constraint)
  INSERT INTO public.document_verifications (document_id, admin_id)
  VALUES (p_document_id, auth.uid());

  RETURN TRUE;
END;
$$;

-- Grant execute permission to authenticated users (function checks for admin role internally)
GRANT EXECUTE ON FUNCTION public.verify_document_authenticity(UUID) TO authenticated;