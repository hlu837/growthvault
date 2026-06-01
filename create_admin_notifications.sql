-- Create admin notification system for new seller applications
CREATE TABLE IF NOT EXISTS public.admin_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('new_seller_application', 'application_approved', 'application_rejected')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    related_id UUID, -- application_id or user_id
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view all notifications"
    ON public.admin_notifications FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'staff')
        )
    );

CREATE POLICY "System can insert notifications"
    ON public.admin_notifications FOR INSERT
    TO authenticated
    WITH CHECK (TRUE);

-- Create function to create notification for new seller application
CREATE OR REPLACE FUNCTION public.notify_admin_new_seller_application(p_application_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Create notification for admins
    INSERT INTO public.admin_notifications (
        type, title, message, related_id, created_by
    ) VALUES (
        'new_seller_application',
        'New Seller Application',
        'A new seller application has been submitted and requires review.',
        p_application_id,
        (SELECT user_id FROM seller_applications WHERE id = p_application_id LIMIT 1)
    );
    
    RETURN TRUE;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.notify_admin_new_seller_application TO authenticated;

-- Update apply_as_seller function to notify admins
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
    
    -- Insert seller application
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
    
    -- Notify admins about new application
    PERFORM notify_admin_new_seller_application(v_application_id);
    
    RETURN v_application_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.apply_as_seller TO authenticated;
