-- Fix RLS policy so super_admin can view and update seller applications
DROP POLICY IF EXISTS "Admins and staff can view all seller applications" ON public.seller_applications;
DROP POLICY IF EXISTS "Admins and staff can update seller applications" ON public.seller_applications;
DROP POLICY IF EXISTS "Admins and staff can manage all seller profiles" ON public.seller_profiles;

CREATE POLICY "Admins and staff can view all seller applications"
    ON public.seller_applications FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('super_admin', 'admin', 'staff')
        )
    );

CREATE POLICY "Admins and staff can update seller applications"
    ON public.seller_applications FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('super_admin', 'admin', 'staff')
        )
    );

CREATE POLICY "Admins and staff can manage all seller profiles"
    ON public.seller_profiles FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('super_admin', 'admin', 'staff')
        )
    );

-- Add full access for admins to marketplace_products
DROP POLICY IF EXISTS "Admins and staff can view all marketplace products" ON public.marketplace_products;
CREATE POLICY "Admins and staff can view all marketplace products"
    ON public.marketplace_products FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('super_admin', 'admin', 'staff')
        )
    );

DROP POLICY IF EXISTS "Admins and staff can manage all marketplace products" ON public.marketplace_products;
CREATE POLICY "Admins and staff can manage all marketplace products"
    ON public.marketplace_products FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('super_admin', 'admin', 'staff')
        )
    );

-- Add full access for admins to marketplace_documents
DROP POLICY IF EXISTS "Admins and staff can view all marketplace documents" ON public.marketplace_documents;
CREATE POLICY "Admins and staff can view all marketplace documents"
    ON public.marketplace_documents FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('super_admin', 'admin', 'staff')
        )
    );

DROP POLICY IF EXISTS "Admins and staff can manage all marketplace documents" ON public.marketplace_documents;
CREATE POLICY "Admins and staff can manage all marketplace documents"
    ON public.marketplace_documents FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('super_admin', 'admin', 'staff')
        )
    );


-- Fix the same issue in approve_seller_application function
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
    -- Get application detailsse
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
    
    RETURN TRUE;
END;
$$;
