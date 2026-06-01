-- Drop existing function to avoid conflicts
DROP FUNCTION IF EXISTS public.apply_as_seller;

-- Create enhanced apply_as_seller function to handle all new fields
CREATE OR REPLACE FUNCTION public.apply_as_seller(
    p_account_type TEXT DEFAULT NULL,
    p_full_name TEXT DEFAULT NULL,
    p_username TEXT DEFAULT NULL,
    p_business_name TEXT DEFAULT NULL,
    p_business_type TEXT DEFAULT NULL,
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
    p_date_of_birth DATE DEFAULT NULL,
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
    p_final_declaration_date DATE DEFAULT NULL,
    p_applied_categories JSONB DEFAULT '[]'::jsonb,
    p_real_estate_seller_type TEXT DEFAULT NULL,
    p_has_legal_authority BOOLEAN DEFAULT NULL,
    p_automobile_seller_type TEXT DEFAULT NULL,
    p_estimated_inventory_size INTEGER DEFAULT NULL,
    p_electronics_product_type TEXT DEFAULT NULL,
    p_offers_warranty BOOLEAN DEFAULT NULL,
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
    v_existing_username TEXT;
BEGIN
    -- Check if user already has an application
    SELECT id::TEXT INTO v_existing_application
    FROM seller_applications
    WHERE user_id = auth.uid()
    AND status NOT IN ('rejected');
    
    IF v_existing_application IS NOT NULL THEN
        RAISE EXCEPTION 'You already have a seller application in progress';
    END IF;
    
    -- Check if username is already taken
    IF p_username IS NOT NULL THEN
        SELECT username::TEXT INTO v_existing_username
        FROM seller_applications
        WHERE username = p_username;
        
        IF v_existing_username IS NOT NULL THEN
            RAISE EXCEPTION 'Username is already taken';
        END IF;
    END IF;
    
    -- Validate required agreements
    IF NOT (p_commitment_agreement AND p_escrow_agreement AND p_dispute_agreement AND p_terms_agreement) THEN
        RAISE EXCEPTION 'All agreements must be accepted to submit application';
    END IF;
    
    -- Insert seller application with all fields
    INSERT INTO seller_applications (
        user_id, account_type, full_name, username, business_name, business_type, 
        business_description, business_address, business_phone, business_email, 
        registration_number, tax_id, website_url, years_in_business, employee_count,
        monthly_revenue, date_of_birth, nationality, residential_address, 
        bank_account_name, bank_name, bank_account_number, payout_method, 
        password, security_question, security_answer, commitment_agreement, 
        escrow_agreement, dispute_agreement, terms_agreement, 
        final_declaration_signature, final_declaration_date, applied_categories,
        real_estate_seller_type, has_legal_authority, automobile_seller_type,
        estimated_inventory_size, electronics_product_type, offers_warranty,
        kyc_documents, business_documents, kyc_document_urls, business_document_urls
    ) VALUES (
        auth.uid(), p_account_type, p_full_name, p_username, p_business_name, p_business_type,
        p_business_description, p_business_address, p_business_phone, p_business_email,
        p_registration_number, p_tax_id, p_website_url, p_years_in_business, p_employee_count,
        p_monthly_revenue, p_date_of_birth, p_nationality, p_residential_address,
        p_bank_account_name, p_bank_name, p_bank_account_number, p_payout_method,
        p_password, p_security_question, p_security_answer, p_commitment_agreement,
        p_escrow_agreement, p_dispute_agreement, p_terms_agreement,
        p_final_declaration_signature, p_final_declaration_date, p_applied_categories,
        p_real_estate_seller_type, p_has_legal_authority, p_automobile_seller_type,
        p_estimated_inventory_size, p_electronics_product_type, p_offers_warranty,
        p_kyc_documents, p_business_documents, p_kyc_documents, p_business_documents
    ) RETURNING id INTO v_application_id;
    
    RETURN v_application_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.apply_as_seller TO authenticated;
