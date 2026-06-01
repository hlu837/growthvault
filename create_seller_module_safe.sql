-- Create seller applications table (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS public.seller_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL,
    business_type TEXT NOT NULL CHECK (business_type IN ('real_estate', 'automobile', 'electronic', 'general')),
    business_description TEXT,
    business_address TEXT,
    business_phone TEXT,
    business_email TEXT,
    registration_number TEXT,
    tax_id TEXT,
    website_url TEXT,
    years_in_business INTEGER,
    employee_count INTEGER,
    monthly_revenue DECIMAL(15,2),
    kyc_documents JSONB DEFAULT '[]'::jsonb,
    business_documents JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'suspended')),
    rejection_reason TEXT,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create seller profiles table (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS public.seller_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    seller_id TEXT UNIQUE NOT NULL, -- SLR-XXXXXX format
    business_name TEXT NOT NULL,
    business_type TEXT NOT NULL CHECK (business_type IN ('real_estate', 'automobile', 'electronic', 'general')),
    verification_status TEXT DEFAULT 'verified' CHECK (verification_status IN ('verified', 'suspended', 'banned')),
    rating DECIMAL(3,2) DEFAULT 0.00 CHECK (rating >= 0 AND rating <= 5),
    total_sales DECIMAL(15,2) DEFAULT 0.00,
    total_orders INTEGER DEFAULT 0,
    successful_orders INTEGER DEFAULT 0,
    commission_rate DECIMAL(5,2) DEFAULT 8.00 CHECK (commission_rate >= 0 AND commission_rate <= 15),
    listing_fee_waived BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create seller categories table (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS public.seller_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('real_estate', 'automobile', 'electronic')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES auth.users(id),
    requirements_met JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(seller_id, category)
);

-- Enable RLS (if not already enabled)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = 'seller_applications' 
        AND schemaname = 'public'
        AND rowsecurity = true
    ) THEN
        ALTER TABLE public.seller_applications ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = 'seller_profiles' 
        AND schemaname = 'public'
        AND rowsecurity = true
    ) THEN
        ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = 'seller_categories' 
        AND schemaname = 'public'
        AND rowsecurity = true
    ) THEN
        ALTER TABLE public.seller_categories ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Drop existing policies if they exist, then recreate them
DO $$
BEGIN
    -- Drop seller_applications policies
    DROP POLICY IF EXISTS "Users can view own seller applications" ON public.seller_applications;
    DROP POLICY IF EXISTS "Admins and staff can view all seller applications" ON public.seller_applications;
    DROP POLICY IF EXISTS "Users can create own seller applications" ON public.seller_applications;
    DROP POLICY IF EXISTS "Admins and staff can update seller applications" ON public.seller_applications;
    
    -- Drop seller_profiles policies
    DROP POLICY IF EXISTS "Anyone can view approved seller profiles" ON public.seller_profiles;
    DROP POLICY IF EXISTS "Users can view own seller profile" ON public.seller_profiles;
    DROP POLICY IF EXISTS "Admins and staff can manage all seller profiles" ON public.seller_profiles;
    
    -- Drop seller_categories policies if any exist
    DROP POLICY IF EXISTS "Anyone can view seller categories" ON public.seller_categories;
END $$;

-- Recreate RLS Policies for seller_applications
CREATE POLICY "Users can view own seller applications"
    ON public.seller_applications FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Admins and staff can view all seller applications"
    ON public.seller_applications FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.profiles p ON p.id = ur.user_id
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'staff')
        )
    );

CREATE POLICY "Users can create own seller applications"
    ON public.seller_applications FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins and staff can update seller applications"
    ON public.seller_applications FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.profiles p ON p.id = ur.user_id
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'staff')
        )
    );

-- RLS Policies for seller_profiles
CREATE POLICY "Anyone can view approved seller profiles"
    ON public.seller_profiles FOR SELECT
    TO authenticated
    USING (verification_status = 'verified');

CREATE POLICY "Users can view own seller profile"
    ON public.seller_profiles FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Admins and staff can manage all seller profiles"
    ON public.seller_profiles FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.profiles p ON p.id = ur.user_id
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'staff')
        )
    );

-- Functions for seller management (CREATE OR REPLACE to handle existing)
CREATE OR REPLACE FUNCTION public.apply_as_seller(
    p_business_name TEXT,
    p_business_type TEXT,
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
        monthly_revenue, kyc_documents, business_documents
    ) VALUES (
        auth.uid(), p_business_name, p_business_type, p_business_description,
        p_business_address, p_business_phone, p_business_email, p_registration_number,
        p_tax_id, p_website_url, p_years_in_business, p_employee_count,
        p_monthly_revenue, p_kyc_documents, p_business_documents
    ) RETURNING id INTO v_application_id;
    
    RETURN v_application_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_seller_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_seller_id TEXT;
    v_suffix TEXT;
BEGIN
    -- Generate unique 6-digit suffix
    LOOP
        v_suffix := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
        v_seller_id := 'SLR-' || v_suffix;
        
        -- Check if already exists
        IF NOT EXISTS (SELECT 1 FROM seller_profiles WHERE seller_id = v_seller_id) THEN
            EXIT;
        END IF;
    END LOOP;
    
    RETURN v_seller_id;
END;
$$;

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
    
    RETURN TRUE;
END;
$$;

-- Create triggers for updated_at (CREATE OR REPLACE)
DO $$
BEGIN
    -- Drop existing triggers if they exist
    DROP TRIGGER IF EXISTS update_seller_applications_updated_at ON public.seller_applications;
    DROP TRIGGER IF EXISTS update_seller_profiles_updated_at ON public.seller_profiles;
    
    -- Create new triggers
    CREATE TRIGGER update_seller_applications_updated_at
    BEFORE UPDATE ON public.seller_applications
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
    
    CREATE TRIGGER update_seller_profiles_updated_at
    BEFORE UPDATE ON public.seller_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
END $$;

-- Grant permissions (GRANT doesn't fail if already granted)
GRANT EXECUTE ON FUNCTION public.apply_as_seller TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_seller_application TO authenticated;
