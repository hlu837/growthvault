-- Complete Seller Approval System Setup
-- This script sets up the logic for approved users to become sellers

-- First, create the seller module if not exists
\i create_seller_module.sql

-- Then create the commission system if not exists  
\i create_commission_system.sql

-- Enhanced immediate approval function for admin actions
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
    
    -- Log the immediate approval
    INSERT INTO public.audit_logs (
        user_id, action, table_name, record_id, details
    ) VALUES (
        v_application.user_id,
        'immediate_seller_approval',
        'seller_applications',
        p_application_id,
        json_build_object(
            'business_name', v_application.business_name,
            'business_type', v_application.business_type,
            'seller_id', v_seller_id,
            'seller_profile_id', v_seller_profile_id,
            'approved_by', auth.uid(),
            'approved_at', NOW()
        )
    );
    
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

-- Function to get seller status for a user
CREATE OR REPLACE FUNCTION public.get_user_seller_status(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
    v_has_application BOOLEAN;
    v_application_status TEXT;
    v_is_seller BOOLEAN;
    v_seller_profile JSONB;
BEGIN
    -- Check if user has seller application
    SELECT EXISTS(
        SELECT 1 FROM seller_applications WHERE user_id = p_user_id
    ) INTO v_has_application;
    
    -- Get application status if exists
    SELECT status INTO v_application_status
    FROM seller_applications
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Check if user is already a seller
    SELECT EXISTS(
        SELECT 1 FROM user_roles 
        WHERE user_id = p_user_id AND role = 'seller'
    ) INTO v_is_seller;
    
    -- Get seller profile if exists
    SELECT to_jsonb(sp) INTO v_seller_profile
    FROM seller_profiles sp
    WHERE sp.user_id = p_user_id;
    
    v_result := json_build_object(
        'has_application', v_has_application,
        'application_status', COALESCE(v_application_status, 'none'),
        'is_seller', v_is_seller,
        'seller_profile', v_seller_profile
    );
    
    RETURN v_result;
END;
$$;

-- Grant permissions for new functions
GRANT EXECUTE ON FUNCTION public.immediate_approve_seller TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_seller_status TO authenticated;

-- Create audit_logs table if not exists (for tracking auto-approvals)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    table_name TEXT,
    record_id UUID,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy for audit_logs
CREATE POLICY "Admins and staff can view all audit logs"
    ON public.audit_logs FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'staff')
        )
    );

CREATE POLICY "System can insert audit logs"
    ON public.audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (TRUE);

-- Create trigger for audit_logs updated_at
CREATE OR REPLACE TRIGGER update_audit_logs_updated_at
BEFORE UPDATE ON public.audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
