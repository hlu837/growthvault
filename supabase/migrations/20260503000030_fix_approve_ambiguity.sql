-- Recreate the single definitive version of the function with robust conflict handling
CREATE OR REPLACE FUNCTION public.approve_seller_application(
    p_application_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_application RECORD;
    v_seller_id TEXT;
BEGIN
    -- Get application details
    SELECT * INTO v_application
    FROM seller_applications
    WHERE id = p_application_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Application not found';
    END IF;
    
    -- Check if caller is admin, staff, or super_admin
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() 
        AND ur.role IN ('super_admin', 'admin', 'staff')
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only admins and staff can approve applications';
    END IF;
    
    -- Generate seller ID
    v_seller_id := generate_seller_id();
    
    -- Create or update seller profile safely
    INSERT INTO seller_profiles (
        user_id, seller_id, business_name, business_type,
        commission_rate, listing_fee_waived
    ) VALUES (
        v_application.user_id, v_seller_id, v_application.business_name,
        v_application.business_type, 8.0, FALSE
    )
    ON CONFLICT (user_id) DO UPDATE 
    SET business_name = EXCLUDED.business_name,
        business_type = EXCLUDED.business_type;
    
    -- Add seller category
    INSERT INTO seller_categories (seller_id, category, approved_at, approved_by)
    VALUES (
        (SELECT id FROM seller_profiles WHERE user_id = v_application.user_id),
        v_application.business_type,
        NOW(),
        auth.uid()
    )
    ON CONFLICT (seller_id, category) DO NOTHING;
    
    -- Update application status
    UPDATE seller_applications
    SET status = 'approved',
        approved_at = NOW(),
        approved_by = auth.uid(),
        reviewed_at = NOW(),
        reviewed_by = auth.uid()
    WHERE id = p_application_id;
    
    -- Add seller role to user
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_application.user_id, 'seller')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RETURN TRUE;
END;
$$;
