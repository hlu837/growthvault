-- COMPLETE SELLER SYSTEM - Apply -> Admin Approves -> Immediate Seller
-- Run this entire file in Supabase SQL Editor

-- Step 1: Add seller role to enum if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e 
        JOIN pg_type t ON e.enumtypid = t.oid 
        WHERE t.typname = 'app_role' AND e.enumlabel = 'seller'
    ) THEN
        ALTER TYPE app_role ADD VALUE 'seller' AFTER 'member';
    END IF;
END $$;

-- Step 2: Create immediate approval function
CREATE OR REPLACE FUNCTION public.immediate_approve_seller(p_application_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_application RECORD;
    v_seller_id TEXT;
    v_seller_profile_id UUID;
BEGIN
    -- Get application and lock it
    SELECT * INTO v_application
    FROM seller_applications
    WHERE id = p_application_id AND status = 'pending'
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Application not found or not pending');
    END IF;
    
    -- Check admin authorization
    IF NOT EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'staff')
    ) THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    -- Generate seller ID
    v_seller_id := 'SLR-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    
    -- Create seller profile immediately
    INSERT INTO seller_profiles (
        user_id, seller_id, business_name, business_type, commission_rate
    ) VALUES (
        v_application.user_id, v_seller_id, v_application.business_name,
        v_application.business_type, 8.0
    ) RETURNING id INTO v_seller_profile_id;
    
    -- Add seller category
    INSERT INTO seller_categories (seller_id, category, approved_at, approved_by)
    VALUES (v_seller_profile_id, v_application.business_type, NOW(), auth.uid());
    
    -- Update application to approved
    UPDATE seller_applications
    SET status = 'approved', approved_at = NOW(), approved_by = auth.uid()
    WHERE id = p_application_id;
    
    -- Add seller role
    INSERT INTO user_roles (user_id, role)
    VALUES (v_application.user_id, 'seller')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Create commission wallet
    INSERT INTO wallets (user_id, wallet_type)
    VALUES (v_application.user_id, 'commission')
    ON CONFLICT (user_id, wallet_type) DO NOTHING;
    
    RETURN json_build_object(
        'success', true,
        'seller_id', v_seller_id,
        'message', 'User is now a seller'
    );
END;
$$;

-- Step 3: Create function to check if user is seller
CREATE OR REPLACE FUNCTION public.is_user_seller(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM seller_profiles WHERE user_id = p_user_id);
END;
$$;

-- Step 4: Grant permissions
GRANT EXECUTE ON FUNCTION public.immediate_approve_seller TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_seller TO authenticated;

-- Step 5: Test query to approve application
-- Uncomment and run this with actual application ID:
-- SELECT immediate_approve_seller('your-application-id-here');

-- Step 6: Test query to check seller status
-- Uncomment and run this with actual user ID:
-- SELECT is_user_seller('your-user-id-here');
