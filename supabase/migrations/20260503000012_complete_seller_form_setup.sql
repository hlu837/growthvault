-- COMPLETE DATABASE SETUP FOR SELLER APPLICATION FORM
-- Drop and recreate everything from scratch

-- Drop existing table and function
DROP TABLE IF EXISTS seller_applications CASCADE;
DROP FUNCTION IF EXISTS public.apply_as_seller CASCADE;

-- Create the complete seller_applications table
CREATE TABLE seller_applications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    username TEXT UNIQUE,
    account_type TEXT NOT NULL CHECK (account_type IN ('individual', 'business')),
    business_name TEXT,
    business_type TEXT,
    business_description TEXT,
    business_address TEXT,
    business_phone TEXT,
    business_email TEXT,
    registration_number TEXT,
    tax_id TEXT,
    website TEXT,
    website_url TEXT,
    years_in_business INTEGER,
    employee_count INTEGER,
    monthly_revenue NUMERIC,
    date_of_birth DATE,
    nationality TEXT,
    residential_address TEXT,
    bank_account_name TEXT,
    bank_name TEXT,
    bank_account_number TEXT,
    payout_method TEXT,
    password TEXT,
    security_question TEXT,
    security_answer TEXT,
    applied_categories TEXT[],
    real_estate_seller_type TEXT,
    has_legal_authority BOOLEAN,
    automobile_seller_type TEXT,
    estimated_inventory_size INTEGER,
    electronics_product_type TEXT,
    offers_warranty BOOLEAN,
    kyc_documents TEXT[],
    business_documents TEXT[],
    commitment_agreement BOOLEAN DEFAULT FALSE,
    escrow_agreement BOOLEAN DEFAULT FALSE,
    escrow_agreement1 BOOLEAN DEFAULT FALSE,
    escrow_agreement2 BOOLEAN DEFAULT FALSE,
    escrow_agreement3 BOOLEAN DEFAULT FALSE,
    escrow_agreement4 BOOLEAN DEFAULT FALSE,
    dispute_agreement BOOLEAN DEFAULT FALSE,
    dispute_agreement1 BOOLEAN DEFAULT FALSE,
    dispute_agreement2 BOOLEAN DEFAULT FALSE,
    dispute_agreement3 BOOLEAN DEFAULT FALSE,
    terms_agreement BOOLEAN DEFAULT FALSE,
    final_declaration_signature TEXT,
    final_declaration_date DATE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_seller_applications_user_id ON seller_applications(user_id);
CREATE INDEX idx_seller_applications_status ON seller_applications(status);
CREATE INDEX idx_seller_applications_username ON seller_applications(username) WHERE username IS NOT NULL;

-- Create the apply_as_seller function
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
        user_id, full_name, username, account_type, business_name, business_type, business_description,
        business_address, business_phone, business_email, registration_number, tax_id,
        website_url, years_in_business, employee_count, monthly_revenue, date_of_birth,
        nationality, residential_address, bank_account_name, bank_name, bank_account_number,
        payout_method, password, security_question, security_answer, applied_categories,
        real_estate_seller_type, has_legal_authority, automobile_seller_type,
        estimated_inventory_size, electronics_product_type, offers_warranty,
        kyc_documents, business_documents, commitment_agreement, escrow_agreement1,
        escrow_agreement2, escrow_agreement3, escrow_agreement4, dispute_agreement1,
        dispute_agreement2, dispute_agreement3, terms_agreement, final_declaration_signature,
        final_declaration_date, status, created_at
    ) VALUES (
        current_user_id, p_full_name, p_username, p_account_type, p_business_name, p_business_type, p_business_description,
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

-- Enable RLS
ALTER TABLE seller_applications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own applications" ON seller_applications
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own applications" ON seller_applications
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own applications" ON seller_applications
FOR UPDATE USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON seller_applications TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
