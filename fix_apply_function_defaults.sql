-- Drop existing function and recreate with correct parameter order
DROP FUNCTION IF EXISTS public.apply_as_seller CASCADE;

CREATE OR REPLACE FUNCTION public.apply_as_seller(
    p_business_name TEXT,
    p_business_type TEXT,
    p_account_type TEXT DEFAULT NULL,
    p_full_name TEXT DEFAULT NULL,
    p_username TEXT DEFAULT NULL,
    p_business_description TEXT DEFAULT NULL,
    p_business_address TEXT DEFAULT NULL,
    p_business_phone TEXT DEFAULT NULL,
    p_business_email TEXT DEFAULT NULL,
    p_registration_number TEXT DEFAULT NULL,
    p_tax_id TEXT DEFAULT NULL,
    p_website_url TEXT DEFAULT NULL,
    p_years_in_business INTEGER DEFAULT NULL,
    p_employee_count INTEGER DEFAULT NULL,
    p_monthly_revenue DECIMAL DEFAULT NULL,
    p_date_of_birth TEXT DEFAULT NULL,
    p_nationality TEXT DEFAULT NULL,
    p_residential_address TEXT DEFAULT NULL,
    p_bank_account_name TEXT DEFAULT NULL,
    p_bank_name TEXT DEFAULT NULL,
    p_bank_account_number TEXT DEFAULT NULL,
    p_payout_method TEXT DEFAULT NULL,
    p_password TEXT DEFAULT NULL,
    p_security_question TEXT DEFAULT NULL,
    p_security_answer TEXT DEFAULT NULL,
    p_commitment_agreement BOOLEAN DEFAULT FALSE,
    p_escrow_agreement BOOLEAN DEFAULT FALSE,
    p_dispute_agreement BOOLEAN DEFAULT FALSE,
    p_terms_agreement BOOLEAN DEFAULT FALSE,
    p_final_declaration_signature TEXT DEFAULT NULL,
    p_final_declaration_date TEXT DEFAULT NULL,
    p_applied_categories TEXT[] DEFAULT '{}',
    p_real_estate_seller_type TEXT DEFAULT NULL,
    p_has_legal_authority BOOLEAN DEFAULT FALSE,
    p_automobile_seller_type TEXT DEFAULT NULL,
    p_estimated_inventory_size INTEGER DEFAULT NULL,
    p_electronics_product_type TEXT DEFAULT NULL,
    p_offers_warranty BOOLEAN DEFAULT FALSE,
    p_kyc_documents JSONB DEFAULT '[]'::jsonb,
    p_business_documents JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_application_id UUID;
    v_existing_application TEXT;
BEGIN
    -- Check if user already has an application
    SELECT id::TEXT INTO v_existing_application
    FROM seller_applications
    WHERE user_id = auth.uid()
    AND status NOT IN ('rejected');
    
    IF v_existing_application IS NOT NULL THEN
        RAISE EXCEPTION 'You already have a seller application in progress';
    END IF;
    
    -- Insert seller application with estimated_inventory_size field
    INSERT INTO seller_applications (
        user_id, business_name, business_type, business_description,
        business_address, business_phone, business_email, registration_number,
        tax_id, website_url, years_in_business, employee_count,
        monthly_revenue, inventory_size, kyc_documents, business_documents
    ) VALUES (
        auth.uid(), p_business_name, p_business_type, p_business_description,
        p_business_address, p_business_phone, p_business_email, p_registration_number,
        p_tax_id, p_website_url, p_years_in_business, p_employee_count,
        p_monthly_revenue, p_estimated_inventory_size, p_kyc_documents, p_business_documents
    ) RETURNING id INTO v_application_id;
    
    RETURN v_application_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.apply_as_seller TO authenticated;
