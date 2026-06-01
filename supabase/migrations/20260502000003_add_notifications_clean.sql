-- Create notifications table for seller application status changes
CREATE TABLE IF NOT EXISTS public.seller_application_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES public.seller_applications(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('approved', 'rejected')),
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.seller_application_notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own notifications" ON public.seller_application_notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.seller_application_notifications;

-- Create RLS Policies
CREATE POLICY "Users can view own notifications"
    ON public.seller_application_notifications FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
    ON public.seller_application_notifications FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

-- Update approve function to create notification
CREATE OR REPLACE FUNCTION public.approve_seller_application(
    p_application_id UUID,
    p_commission_rate DECIMAL DEFAULT 8.0,
    p_listing_fee_waived BOOLEAN DEFAULT FALSE
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
    
    -- Check if caller is admin or staff
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.profiles p ON p.id = ur.user_id
        WHERE ur.user_id = auth.uid() 
        AND ur.role IN ('admin', 'staff')
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only admins and staff can approve applications';
    END IF;
    
    -- Generate seller ID
    v_seller_id := generate_seller_id();
    
    -- Create seller profile
    INSERT INTO seller_profiles (
        user_id, seller_id, business_name, business_type,
        commission_rate, listing_fee_waived
    ) VALUES (
        v_application.user_id, v_seller_id, v_application.business_name,
        v_application.business_type, p_commission_rate, p_listing_fee_waived
    );
    
    -- Add seller category
    INSERT INTO seller_categories (seller_id, category, approved_at, approved_by)
    VALUES (
        (SELECT id FROM seller_profiles WHERE user_id = v_application.user_id),
        v_application.business_type,
        NOW(),
        auth.uid()
    );
    
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
    
    -- Create notification for user
    INSERT INTO public.seller_application_notifications (user_id, application_id, type, message)
    VALUES (
        v_application.user_id,
        p_application_id,
        'approved',
        'Congratulations! Your seller application has been approved. You can now start listing products.'
    );
    
    RETURN TRUE;
END;
$$;

-- Create function to handle rejection with notification
CREATE OR REPLACE FUNCTION public.reject_seller_application(
    p_application_id UUID,
    p_rejection_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_application RECORD;
BEGIN
    -- Get application details
    SELECT * INTO v_application
    FROM seller_applications
    WHERE id = p_application_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Application not found';
    END IF;
    
    -- Check if caller is admin or staff
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.profiles p ON p.id = ur.user_id
        WHERE ur.user_id = auth.uid() 
        AND ur.role IN ('admin', 'staff')
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only admins and staff can reject applications';
    END IF;
    
    -- Update application status
    UPDATE seller_applications
    SET status = 'rejected',
        rejection_reason = p_rejection_reason,
        reviewed_at = NOW(),
        reviewed_by = auth.uid()
    WHERE id = p_application_id;
    
    -- Create notification for user
    INSERT INTO public.seller_application_notifications (user_id, application_id, type, message)
    VALUES (
        v_application.user_id,
        p_application_id,
        'rejected',
        'Your seller application has been rejected. Reason: ' || p_rejection_reason
    );
    
    RETURN TRUE;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.approve_seller_application TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_seller_application TO authenticated;
