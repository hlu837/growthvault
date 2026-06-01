-- ============================================================
-- FIX LOAN & SURETY SYSTEM
-- ============================================================

-- Create loan_requests table if it doesn't exist (for application tracking)
CREATE TABLE IF NOT EXISTS public.loan_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount_requested NUMERIC NOT NULL CHECK (amount_requested > 0),
    duration_months INTEGER NOT NULL CHECK (duration_months > 0),
    purpose TEXT NOT NULL,
    member_name TEXT NOT NULL,
    residential_address TEXT,
    business_address TEXT,
    occupation TEXT,
    employer_name TEXT,
    monthly_income NUMERIC CHECK (monthly_income >= 0),
    interest_type TEXT DEFAULT 'annual' CHECK (interest_type IN ('annual', 'monthly')),
    interest_rate NUMERIC DEFAULT 5.0 CHECK (interest_rate >= 0),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected')),
    rejection_reason TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create loan_surety_requests table for surety visibility
CREATE TABLE IF NOT EXISTS public.loan_surety_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_request_id UUID NOT NULL REFERENCES public.loan_requests(id) ON DELETE CASCADE,
    borrower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    requested_surety_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    guarantee_amount NUMERIC NOT NULL CHECK (guarantee_amount > 0),
    relationship_to_borrower TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
    rejection_reason TEXT,
    accepted_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(loan_request_id, requested_surety_id)
);

-- Fix 1: Create apply_for_loan function that writes to loan_requests
CREATE OR REPLACE FUNCTION public.apply_for_loan(
    p_amount NUMERIC,
    p_duration_months INTEGER,
    p_purpose TEXT,
    p_member_name TEXT,
    p_residential_address TEXT DEFAULT NULL,
    p_business_address TEXT DEFAULT NULL,
    p_occupation TEXT DEFAULT NULL,
    p_employer_name TEXT DEFAULT NULL,
    p_monthly_income NUMERIC DEFAULT NULL,
    p_interest_type TEXT DEFAULT 'annual',
    p_interest_rate NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_loan_request_id UUID;
    v_interest_rate NUMERIC;
BEGIN
    -- Get system default interest rate if not provided
    IF p_interest_rate IS NULL THEN
        SELECT setting_value::NUMERIC INTO v_interest_rate
        FROM system_settings
        WHERE setting_key = 'loan_interest_rate';
        IF v_interest_rate IS NULL THEN v_interest_rate := 5.0; END IF;
    ELSE
        v_interest_rate := p_interest_rate;
    END IF;

    -- Insert into loan_requests table
    INSERT INTO public.loan_requests (
        user_id, amount_requested, duration_months, purpose, member_name,
        residential_address, business_address, occupation, employer_name,
        monthly_income, interest_type, interest_rate, status
    ) VALUES (
        auth.uid(), p_amount, p_duration_months, p_purpose, p_member_name,
        p_residential_address, p_business_address, p_occupation, p_employer_name,
        p_monthly_income, p_interest_type, v_interest_rate, 'submitted'
    ) RETURNING id INTO v_loan_request_id;

    RETURN v_loan_request_id;
END;
$$;

-- Fix 2: Function to get recommended sureties for loan applicant
CREATE OR REPLACE FUNCTION public.get_recommended_sureties(
    p_loan_request_id UUID
)
RETURNS TABLE (
    user_id UUID,
    full_name TEXT,
    email TEXT,
    referral_code TEXT,
    kyc_status TEXT,
    account_status TEXT,
    relationship_score INTEGER,
    is_recommended BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_borrower_id UUID;
BEGIN
    -- Get borrower from loan request
    SELECT user_id INTO v_borrower_id
    FROM loan_requests
    WHERE id = p_loan_request_id;

    -- Return potential sureties (KYC approved, not frozen, good standing)
    RETURN QUERY
    SELECT 
        p.id as user_id,
        p.full_name,
        p.email,
        p.referral_code,
        p.kyc_status,
        p.account_status,
        -- Calculate relationship score based on network proximity
        CASE 
            WHEN p.id IN (
                SELECT referrer_id FROM referrals WHERE referred_id = v_borrower_id
                UNION
                SELECT referred_id FROM referrals WHERE referrer_id = v_borrower_id
            ) THEN 100  -- Direct upline/downline
            WHEN p.id IN (
                SELECT r2.referrer_id 
                FROM referrals r1 
                JOIN referrals r2 ON r1.referred_id = r2.referred_id 
                WHERE r1.referrer_id = v_borrower_id
            ) THEN 80  -- Second level
            WHEN p.id IN (
                SELECT r3.referred_id 
                FROM referrals r1 
                JOIN referrals r2 ON r1.referred_id = r2.referred_id
                JOIN referrals r3 ON r2.referred_id = r3.referred_id
                WHERE r1.referrer_id = v_borrower_id
            ) THEN 60  -- Third level
            ELSE 40  -- Other network members
        END as relationship_score,
        CASE 
            WHEN p.id IN (
                SELECT referrer_id FROM referrals WHERE referred_id = v_borrower_id
                UNION
                SELECT referred_id FROM referrals WHERE referrer_id = v_borrower_id
            ) THEN true
            ELSE false
        END as is_recommended
    FROM profiles p
    WHERE p.kyc_status = 'approved'
      AND p.is_frozen = false
      AND p.account_status = 'active'
      AND p.id != v_borrower_id
    ORDER BY relationship_score DESC, p.full_name
    LIMIT 10;
    
    RETURN;
END;
$$;

-- Fix 3: Function to request surety for loan
CREATE OR REPLACE FUNCTION public.request_loan_surety(
    p_loan_request_id UUID,
    p_surety_user_id UUID,
    p_guarantee_amount NUMERIC,
    p_relationship TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_borrower_id UUID;
    v_surety_exists BOOLEAN;
BEGIN
    -- Verify borrower owns the loan request
    SELECT user_id INTO v_borrower_id
    FROM loan_requests
    WHERE id = p_loan_request_id;
    
    IF v_borrower_id != auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized: Cannot request surety for another user''s loan';
    END IF;

    -- Check if surety request already exists
    SELECT EXISTS(
        SELECT 1 FROM loan_surety_requests 
        WHERE loan_request_id = p_loan_request_id 
        AND requested_surety_id = p_surety_user_id
    ) INTO v_surety_exists;
    
    IF v_surety_exists THEN
        RAISE EXCEPTION 'Surety request already exists for this loan and surety';
    END IF;

    -- Insert surety request
    INSERT INTO public.loan_surety_requests (
        loan_request_id, borrower_id, requested_surety_id, 
        guarantee_amount, relationship_to_borrower, status
    ) VALUES (
        p_loan_request_id, v_borrower_id, p_surety_user_id,
        p_guarantee_amount, p_relationship, 'pending'
    );

    RETURN TRUE;
END;
$$;

-- Fix 4: Function to respond to surety request
CREATE OR REPLACE FUNCTION public.respond_to_surety_request(
    p_surety_request_id UUID,
    p_response TEXT, -- 'accepted' or 'rejected'
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_surety_request RECORD;
BEGIN
    -- Get surety request details
    SELECT * INTO v_surety_request
    FROM loan_surety_requests
    WHERE id = p_surety_request_id AND requested_surety_id = auth.uid();
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Surety request not found or unauthorized';
    END IF;

    -- Validate response
    IF p_response NOT IN ('accepted', 'rejected') THEN
        RAISE EXCEPTION 'Invalid response. Must be "accepted" or "rejected"';
    END IF;

    -- Update surety request
    UPDATE loan_surety_requests
    SET 
        status = p_response,
        rejection_reason = p_rejection_reason,
        accepted_at = CASE WHEN p_response = 'accepted' THEN NOW() ELSE NULL END,
        rejected_at = CASE WHEN p_response = 'rejected' THEN NOW() ELSE NULL END,
        updated_at = NOW()
    WHERE id = p_surety_request_id;

    RETURN TRUE;
END;
$$;

-- Fix 5: Function to convert loan request to actual loan when approved
CREATE OR REPLACE FUNCTION public.convert_loan_request_to_loan(
    p_loan_request_id UUID,
    p_approved_amount NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_loan_request RECORD;
    v_loan_id UUID;
BEGIN
    -- Only admin/staff can convert requests
    IF NOT is_admin_or_staff(auth.uid()) THEN
        RAISE EXCEPTION 'Unauthorized: Only admin/staff can convert loan requests';
    END IF;

    -- Get loan request details
    SELECT * INTO v_loan_request
    FROM loan_requests
    WHERE id = p_loan_request_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Loan request not found';
    END IF;

    -- Use existing apply_for_loan function to create actual loan
    SELECT apply_for_loan(
        v_loan_request.amount_requested,
        v_loan_request.duration_months,
        v_loan_request.purpose,
        v_loan_request.member_name,
        v_loan_request.residential_address,
        v_loan_request.business_address,
        v_loan_request.occupation,
        v_loan_request.employer_name,
        v_loan_request.monthly_income,
        v_loan_request.interest_type,
        v_loan_request.interest_rate
    ) INTO v_loan_id;

    -- Update loan request status
    UPDATE loan_requests
    SET 
        status = 'approved',
        reviewed_by = auth.uid(),
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_loan_request_id;

    RETURN v_loan_id;
END;
$$;

-- Enable RLS on new tables
ALTER TABLE public.loan_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_surety_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies for loan_requests
CREATE POLICY "Users can view own loan requests"
    ON public.loan_requests FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own loan requests"
    ON public.loan_requests FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin/staff can view all loan requests"
    ON public.loan_requests FOR SELECT
    TO authenticated
    USING (is_admin_or_staff(auth.uid()));

CREATE POLICY "Admin/staff can update loan requests"
    ON public.loan_requests FOR UPDATE
    TO authenticated
    USING (is_admin_or_staff(auth.uid()));

-- RLS policies for loan_surety_requests
CREATE POLICY "Users can view surety requests they are involved in"
    ON public.loan_surety_requests FOR SELECT
    TO authenticated
    USING (borrower_id = auth.uid() OR requested_surety_id = auth.uid() OR is_admin_or_staff(auth.uid()));

CREATE POLICY "Users can insert surety requests"
    ON public.loan_surety_requests FOR INSERT
    TO authenticated
    WITH CHECK (borrower_id = auth.uid());

CREATE POLICY "Sureties can update their responses"
    ON public.loan_surety_requests FOR UPDATE
    TO authenticated
    USING (requested_surety_id = auth.uid());

CREATE POLICY "Admin/staff can manage all surety requests"
    ON public.loan_surety_requests FOR ALL
    TO authenticated
    USING (is_admin_or_staff(auth.uid()));

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.apply_for_loan(
    NUMERIC, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, NUMERIC
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_recommended_sureties(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_loan_surety(UUID, UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_surety_request(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_loan_request_to_loan(UUID, NUMERIC) TO authenticated;
