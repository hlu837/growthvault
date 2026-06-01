-- Add dedicated marketplace_documents table for seller-uploaded documents
-- and enforce RLS so only admins and uploaders can access them.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'marketplace_document_type' AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.marketplace_document_type AS ENUM ('C of O', 'Logbook', 'ID');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.marketplace_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  document_type public.marketplace_document_type NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_documents_product_id ON public.marketplace_documents(product_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_documents_uploaded_by ON public.marketplace_documents(uploaded_by);

ALTER TABLE public.marketplace_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and uploader can access marketplace documents"
  ON public.marketplace_documents FOR ALL
  TO authenticated
  USING (
    uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'admin')
  );

-- RPC function to get secure signed URLs for marketplace documents
-- Only admins or buyers with confirmed orders can access documents
CREATE OR REPLACE FUNCTION public.get_secure_document_url(p_document_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_document RECORD;
  v_is_authorized BOOLEAN := FALSE;
  v_signed_url TEXT;
BEGIN
  -- Get document details
  SELECT md.*, mp.created_by as seller_id
  INTO v_document
  FROM public.marketplace_documents md
  JOIN public.marketplace_products mp ON md.product_id = mp.id
  WHERE md.id = p_document_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  -- Check if user is admin
  IF public.has_role(auth.uid(), 'admin') THEN
    v_is_authorized := TRUE;
  ELSE
    -- Check if user is the seller who uploaded the document
    IF v_document.uploaded_by = auth.uid() THEN
      v_is_authorized := TRUE;
    ELSE
      -- Check if user has a confirmed order for this product
      SELECT EXISTS(
        SELECT 1
        FROM public.marketplace_orders
        WHERE product_id = v_document.product_id
          AND user_id = auth.uid()
          AND payment_status = 'confirmed'
      ) INTO v_is_authorized;
    END IF;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions';
  END IF;

  -- Generate signed URL with 15 minute expiry
  SELECT signed_url INTO v_signed_url
  FROM storage.create_signed_url(v_document.storage_path, 900); -- 900 seconds = 15 minutes

  RETURN v_signed_url;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_secure_document_url(UUID) TO authenticated;
