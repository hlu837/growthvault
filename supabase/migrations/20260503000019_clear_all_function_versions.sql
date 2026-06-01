-- Drop all versions of the approve_seller_application function
DROP FUNCTION IF EXISTS public.approve_seller_application(p_application_id UUID) CASCADE;
DROP FUNCTION IF EXISTS public.approve_seller_application(p_application_id UUID, p_commission_rate NUMERIC, p_listing_fee_waived BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS public.approve_seller_application() CASCADE;

-- Drop all versions of the reject_seller_application function  
DROP FUNCTION IF EXISTS public.reject_seller_application(p_application_id UUID, p_rejection_reason TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.reject_seller_application() CASCADE;

-- Now create the clean approve_seller_application function
CREATE OR REPLACE FUNCTION public.approve_seller_application(
    p_application_id UUID
)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    application_record RECORD;
    current_admin_id UUID;
BEGIN
    -- Get the current admin user ID
    current_admin_id := auth.uid();
    
    -- Check if user is admin
    IF NOT EXISTS (
        SELECT 1 FROM auth.users 
        WHERE auth.users.id = current_admin_id 
        AND raw_user_meta_data->>'role' = 'admin'
    ) THEN
        RETURN QUERY SELECT false, 'Admin access required.'::TEXT;
        RETURN;
    END IF;
    
    -- Get the application record
    SELECT * INTO application_record 
    FROM seller_applications 
    WHERE id = p_application_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Application not found or already processed.'::TEXT;
        RETURN;
    END IF;
    
    -- Update the application status
    UPDATE seller_applications 
    SET 
        status = 'approved',
        approved_at = NOW(),
        approved_by = current_admin_id,
        updated_at = NOW()
    WHERE id = p_application_id;
    
    -- Update user role to seller
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
        raw_user_meta_data,
        '{role}',
        '"seller"'
    )
    WHERE id = application_record.user_id;
    
    -- Create or update seller profile
    INSERT INTO public.profiles (id, role, updated_at)
    VALUES (application_record.user_id, 'seller', NOW())
    ON CONFLICT (id) DO UPDATE SET
        role = 'seller',
        updated_at = NOW();
    
    RETURN QUERY SELECT true, 'Application approved and user upgraded to seller.'::TEXT;
END;
$$;

-- Create the clean reject_seller_application function
CREATE OR REPLACE FUNCTION public.reject_seller_application(
    p_application_id UUID,
    p_rejection_reason TEXT
)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    application_record RECORD;
    current_admin_id UUID;
BEGIN
    -- Get the current admin user ID
    current_admin_id := auth.uid();
    
    -- Check if user is admin
    IF NOT EXISTS (
        SELECT 1 FROM auth.users 
        WHERE auth.users.id = current_admin_id 
        AND raw_user_meta_data->>'role' = 'admin'
    ) THEN
        RETURN QUERY SELECT false, 'Admin access required.'::TEXT;
        RETURN;
    END IF;
    
    -- Get the application record
    SELECT * INTO application_record 
    FROM seller_applications 
    WHERE id = p_application_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Application not found or already processed.'::TEXT;
        RETURN;
    END IF;
    
    -- Update the application status
    UPDATE seller_applications 
    SET 
        status = 'rejected',
        rejection_reason = p_rejection_reason,
        reviewed_at = NOW(),
        reviewed_by = current_admin_id,
        updated_at = NOW()
    WHERE id = p_application_id;
    
    RETURN QUERY SELECT true, 'Application rejected and user notified.'::TEXT;
END;
$$;
