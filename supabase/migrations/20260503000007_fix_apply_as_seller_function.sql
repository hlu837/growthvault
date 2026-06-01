-- Drop the existing function and recreate with correct parameter names
DROP FUNCTION IF EXISTS public.apply_as_seller;

-- Create the apply_as_seller function with the exact parameters the frontend sends
CREATE OR REPLACE FUNCTION public.apply_as_seller(
    p_account_type TEXT,
    p_full_name TEXT,
    p_username TEXT,
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
    p_monthly_revenue NUMERIC DEFAULT NULL,
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
    p_applied_categories TEXT[] DEFAULT '{}',
    p_real_estate_seller_type TEXT DEFAULT NULL,
    p_has_legal_authority BOOLEAN DEFAULT NULL,
    p_automobile_seller_type TEXT DEFAULT NULL,
    p_estimated_inventory_size INTEGER DEFAULT NULL,
    p_electronics_product_type TEXT DEFAULT NULL,
    p_offers_warranty BOOLEAN DEFAULT NULL,
    p_kyc_documents TEXT[] DEFAULT '{}',
    p_business_documents TEXT[] DEFAULT '{}'
)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id UUID;
BEGIN
    -- Get the current user ID
    current_user_id := auth.uid();
    
    -- Check if user is authenticated
    IF current_user_id IS NULL THEN
        RETURN QUERY SELECT false, 'User not authenticated.'::TEXT;
        RETURN;
    END IF;
    
    -- Check if user already has an application
    IF EXISTS (SELECT 1 FROM seller_applications WHERE user_id = current_user_id) THEN
        RETURN QUERY SELECT false, 'You already have a pending seller application.'::TEXT;
        RETURN;
    END IF;
    
    -- Check if username is already taken
    IF p_username IS NOT NULL AND EXISTS (SELECT 1 FROM seller_applications WHERE username = p_username) THEN
        RETURN QUERY SELECT false, 'Username is already taken.'::TEXT;
        RETURN;
    END IF;
    
    -- Insert the seller application
    INSERT INTO seller_applications (
        user_id, full_name, username, account_type, business_name, business_description,
        business_address, business_phone, business_email, registration_number, tax_id,
        website, years_in_business, employee_count, monthly_revenue, date_of_birth,
        nationality, residential_address, bank_account_name, bank_name, bank_account_number,
        payout_method, password, security_question, security_answer, applied_categories,
        real_estate_seller_type, has_legal_authority, automobile_seller_type,
        estimated_inventory_size, electronics_product_type, offers_warranty,
        kyc_documents, business_documents, commitment_agreement, escrow_agreement1,
        escrow_agreement2, escrow_agreement3, escrow_agreement4, dispute_agreement1,
        dispute_agreement2, dispute_agreement3, terms_agreement, final_declaration_signature,
        final_declaration_date, status, created_at
    ) VALUES (
        current_user_id, p_full_name, p_username, p_account_type, p_business_name, p_business_description,
        p_business_address, p_business_phone, p_business_email, p_registration_number, p_tax_id,
        p_website_url, p_years_in_business, p_employee_count, p_monthly_revenue, p_date_of_birth,
        p_nationality, p_residential_address, p_bank_account_name, p_bank_name, p_bank_account_number,
        p_payout_method, p_password, p_security_question, p_security_answer, p_applied_categories,
        p_real_estate_seller_type, p_has_legal_authority, p_automobile_seller_type,
        p_estimated_inventory_size, p_electronics_product_type, p_offers_warranty,
        p_kyc_documents, p_business_documents, p_commitment_agreement, p_escrow_agreement,
        p_escrow_agreement, p_escrow_agreement, p_escrow_agreement, p_dispute_agreement,
        p_dispute_agreement, p_dispute_agreement, p_terms_agreement, p_final_declaration_signature,
        p_final_declaration_date, 'pending', NOW()
    );
    
    RETURN QUERY SELECT true, 'Application submitted successfully!'::TEXT;
END;
$$;
