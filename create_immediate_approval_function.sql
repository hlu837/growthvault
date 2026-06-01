-- Create immediate seller approval function
-- Run this script directly in Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.immediate_approve_seller(
    p_application_id UUID,
    p_commission_rate DECIMAL DEFAULT 8.0,
    p_listing_fee_waived BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_application RECORD;
    v_seller_id TEXT;
    v_seller_profile_id UUID;
    v_result JSONB;
BEGIN
    -- Get application details and lock the row
    SELECT * INTO v_application
    FROM seller_applications
    WHERE id = p_application_id AND status = 'pending'
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pending application not found';
    END IF;
    
    -- Check if caller is admin or staff
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() 
        AND ur.role IN ('admin', 'staff')
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only admins and staff can approve applications';
    END IF;
    
    -- Generate unique seller ID immediately
    v_seller_id := public.generate_seller_id();
    
    -- Create seller profile immediately
    INSERT INTO seller_profiles (
        user_id, seller_id, business_name, business_type,
        commission_rate, listing_fee_waived
    ) VALUES (
        v_application.user_id, v_seller_id, v_application.business_name,
        v_application.business_type, p_commission_rate, p_listing_fee_waived
    ) RETURNING id INTO v_seller_profile_id;
    
    -- Add seller category immediately
    INSERT INTO seller_categories (seller_id, category, approved_at, approved_by)
    VALUES (
        v_seller_profile_id,
        v_application.business_type,
        NOW(),
        auth.uid()
    );
    
    -- Update application status immediately
    UPDATE seller_applications
    SET status = 'approved',
        approved_at = NOW(),
        approved_by = auth.uid(),
        reviewed_at = NOW(),
        reviewed_by = auth.uid()
    WHERE id = p_application_id;
    
    -- Add seller role to user immediately
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_application.user_id, 'seller')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Create commission wallet for seller if not exists
    INSERT INTO wallets (user_id, wallet_type)
    VALUES (v_application.user_id, 'commission')
    ON CONFLICT (user_id, wallet_type) DO NOTHING;
    
    -- Return success result with seller details
    v_result := json_build_object(
        'success', true,
        'seller_id', v_seller_id,
        'seller_profile_id', v_seller_profile_id,
        'user_id', v_application.user_id,
        'business_name', v_application.business_name,
        'message', 'User immediately became a seller'
    );
    
    RETURN v_result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.immediate_approve_seller TO authenticated;
