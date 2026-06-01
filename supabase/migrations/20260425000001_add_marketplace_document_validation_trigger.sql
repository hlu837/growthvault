-- Add pending_verification status to product_status enum
ALTER TYPE public.product_status ADD VALUE IF NOT EXISTS 'pending_verification';

-- Update document validation trigger to use marketplace_documents table
-- This validates that required documents exist in marketplace_documents based on category

CREATE OR REPLACE FUNCTION public.check_required_documents()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  doc_count INTEGER;
  required_count INTEGER;
BEGIN
  -- Only check documents when trying to set status to 'active'
  IF NEW.status = 'active' THEN
    -- Determine required documents based on category
    CASE NEW.category
      WHEN 'real_estate' THEN
        required_count := 4;
        -- Check for distinct records: 'c_of_o', 'deed_of_assignment', 'survey_plan', 'ownership_auth'
        SELECT COUNT(DISTINCT md.document_type)
        INTO doc_count
        FROM public.marketplace_products mp
        JOIN public.marketplace_documents md ON mp.id = md.product_id
        WHERE mp.id = NEW.id
          AND md.document_type IN ('c_of_o', 'deed_of_assignment', 'survey_plan', 'ownership_auth');
        
        IF doc_count < required_count THEN
          RAISE EXCEPTION 'Missing required documents for Real Estate';
        END IF;
      
      WHEN 'automobile' THEN
        required_count := 3;
        -- Check for distinct records: 'vehicle_reg', 'proof_of_ownership', 'inspection_report'
        SELECT COUNT(DISTINCT md.document_type)
        INTO doc_count
        FROM public.marketplace_products mp
        JOIN public.marketplace_documents md ON mp.id = md.product_id
        WHERE mp.id = NEW.id
          AND md.document_type IN ('vehicle_reg', 'proof_of_ownership', 'inspection_report');
        
        IF doc_count < required_count THEN
          RAISE EXCEPTION 'Missing required documents for Automobile';
        END IF;
      
      ELSE
        -- No documents required for other categories
        NULL;
    END CASE;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on marketplace_products table
DROP TRIGGER IF EXISTS check_required_documents_trigger ON public.marketplace_products;

CREATE TRIGGER check_required_documents_trigger
  BEFORE INSERT OR UPDATE ON public.marketplace_products
  FOR EACH ROW
  EXECUTE FUNCTION public.check_required_documents();