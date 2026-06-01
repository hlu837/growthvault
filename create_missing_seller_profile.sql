-- Create seller profile from approved application
-- Use this if the approval process didn't create the seller profile

CREATE OR REPLACE FUNCTION public.create_seller_profile_from_approved_app(p_user_id UUID)
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
    -- Get the approved application
    SELECT * INTO v_application
    FROM seller_applications
    WHERE user_id = p_user_id AND status = 'approved';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No approved application found for this user';
    END IF;
    
    -- Check if seller profile already exists
    IF EXISTS (SELECT 1 FROM seller_profiles WHERE user_id = p_user_id) THEN
        RETURN json_build_object('success', false, 'message', 'Seller profile already exists');
    END IF;
    
    -- Generate seller ID
    v_seller_id := generate_seller_id();
    
    -- Create seller profile
    INSERT INTO seller_profiles (
        user_id, seller_id, business_name, business_type, commission_rate
    ) VALUES (
        p_user_id, v_seller_id, v_application.business_name,
        v_application.business_type, 8.0
    ) RETURNING id INTO v_seller_profile_id;
    
    -- Add seller category
    INSERT INTO seller_categories (seller_id, category, approved_at, approved_by)
    VALUES (v_seller_profile_id, v_application.business_type, NOW(), p_user_id);
    
    -- Add seller role
    INSERT INTO user_roles (user_id, role)
    VALUES (p_user_id, 'seller')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Create commission wallet
    INSERT INTO wallets (user_id, wallet_type)
    VALUES (p_user_id, 'commission')
    ON CONFLICT (user_id, wallet_type) DO NOTHING;
    
    v_result := json_build_object(
        'success', true,
        'seller_id', v_seller_id,
        'seller_profile_id', v_seller_profile_id,
        'message', 'Seller profile created successfully'
    );
    
    RETURN v_result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_seller_profile_from_approved_app TO authenticated;
