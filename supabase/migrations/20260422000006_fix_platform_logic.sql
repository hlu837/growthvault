-- ============================================================
-- PLATFORM LOGIC FIXES
-- ============================================================

-- 1. Fix Missing Interest Logic (50/50 Rule)
CREATE OR REPLACE FUNCTION public.calculate_interest_earnings(
    p_user_id UUID,
    p_principal_amount DECIMAL
)
RETURNS TABLE (
    wallet_type TEXT,
    interest_earned DECIMAL,
    principal_earned DECIMAL,
    can_withdraw_principal BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_level INTEGER;
    v_interest_rate DECIMAL DEFAULT 0.01; -- 1% base rate
    v_can_withdraw_principal BOOLEAN DEFAULT FALSE;
    v_interest_multiplier DECIMAL;
    v_principal_multiplier DECIMAL;
BEGIN
    -- Get user's current MLM level from profiles table
    SELECT COALESCE(mlm_level, 1) INTO v_user_level
    FROM profiles
    WHERE id = p_user_id;
    
    -- Check if user can withdraw principal (reached level 5)
    v_can_withdraw_principal := (v_user_level >= 5);
    
    -- Calculate multipliers based on level
    IF v_user_level >= 5 THEN
        -- Level 5+: Full access
        v_interest_multiplier := 1.0;
        v_principal_multiplier := 1.0;
    ELSE
        -- Level 1-4: 50/50 rule
        v_interest_multiplier := 0.5;
        v_principal_multiplier := 0.5;
    END IF;
    
    -- Calculate earnings for MLM Capital wallet
    RETURN QUERY
    SELECT 
        'mlm_capital' as wallet_type,
        p_principal_amount * v_interest_rate * v_interest_multiplier as interest_earned,
        p_principal_amount * v_principal_multiplier as principal_earned,
        v_can_withdraw_principal as can_withdraw_principal
    UNION ALL
    -- Calculate earnings for Trading Principal wallet (always 50/50)
    SELECT 
        'trading_principal' as wallet_type,
        p_principal_amount * v_interest_rate * 0.5 as interest_earned,
        p_principal_amount * 0.5 as principal_earned,
        FALSE as can_withdraw_principal;
END;
$$;

-- 2. Fix the 'Starter' Rank Bug - Create rank update trigger
CREATE OR REPLACE FUNCTION public.update_user_rank()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_downline_count INTEGER;
    v_new_rank TEXT;
BEGIN
    -- Count direct downlines for the user
    SELECT COUNT(*) INTO v_downline_count
    FROM referrals
    WHERE referrer_id = NEW.id AND level = 1;
    
    -- Determine rank based on downline count
    CASE
        WHEN v_downline_count >= 6 THEN
            v_new_rank := 'Silver';
        WHEN v_downline_count >= 3 THEN
            v_new_rank := 'Bronze';
        WHEN v_downline_count >= 0 THEN
            v_new_rank := 'Starter';
        ELSE
            v_new_rank := 'Starter';
    END CASE;
    
    -- Update user's rank in profiles table
    UPDATE profiles
    SET 
        investment_tier = v_new_rank,
        mlm_level = CASE 
            WHEN v_downline_count >= 6 THEN 3
            WHEN v_downline_count >= 3 THEN 2
            ELSE 1
        END,
        updated_at = NOW()
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$;

-- Create trigger to update rank when new referral is added
CREATE OR REPLACE TRIGGER update_rank_on_referral
AFTER INSERT ON referrals
FOR EACH ROW
WHEN (NEW.level = 1) -- Only count direct referrals
EXECUTE FUNCTION public.update_user_rank();

-- Create trigger to update rank when referral is removed
CREATE OR REPLACE TRIGGER update_rank_on_referral_delete
AFTER DELETE ON referrals
FOR EACH ROW
WHEN (OLD.level = 1) -- Only count direct referrals
EXECUTE FUNCTION public.update_user_rank();

-- 3. Fix Loan Submission - Verify and update loan_requests table
DO $$
BEGIN
    -- Check if loan_requests table exists, create if not
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'loan_requests') THEN
        CREATE TABLE public.loan_requests (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            amount_requested NUMERIC(15,2) NOT NULL,
            duration_months INTEGER NOT NULL CHECK (duration_months > 0),
            purpose TEXT NOT NULL,
            member_name TEXT NOT NULL,
            residential_address TEXT,
            business_address TEXT,
            occupation TEXT,
            employer_name TEXT,
            monthly_income NUMERIC(15,2),
            interest_type TEXT DEFAULT 'annual' CHECK (interest_type IN ('annual', 'monthly')),
            interest_rate NUMERIC(5,4) DEFAULT 5.0 CHECK (interest_rate > 0),
            status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'approved', 'rejected', 'converted')),
            surety_user_id UUID REFERENCES profiles(id),
            surety_status TEXT DEFAULT 'pending' CHECK (surety_status IN ('pending', 'accepted', 'rejected')),
            surety_response_at TIMESTAMPTZ,
            admin_notes TEXT,
            submitted_at TIMESTAMPTZ DEFAULT NOW(),
            reviewed_at TIMESTAMPTZ,
            reviewed_by UUID REFERENCES auth.users(id),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        -- Enable RLS
        ALTER TABLE loan_requests ENABLE ROW LEVEL SECURITY;
        
        -- Create policies
        CREATE POLICY "Users can view own loan requests"
            ON public.loan_requests FOR SELECT
            TO authenticated
            USING (user_id = auth.uid());
            
        CREATE POLICY "Users can create own loan requests"
            ON public.loan_requests FOR INSERT
            TO authenticated
            WITH CHECK (user_id = auth.uid());
            
        CREATE POLICY "Admins can view all loan requests"
            ON public.loan_requests FOR ALL
            TO authenticated
            USING (is_admin_or_staff(auth.uid()));
    ELSE
        -- Add missing columns if table exists
        BEGIN
            ALTER TABLE public.loan_requests ADD COLUMN IF NOT EXISTS surety_user_id UUID REFERENCES profiles(id);
        EXCEPTION WHEN duplicate_column THEN NULL;
        END;
        
        BEGIN
            ALTER TABLE public.loan_requests ADD COLUMN IF NOT EXISTS surety_status TEXT DEFAULT 'pending' CHECK (surety_status IN ('pending', 'accepted', 'rejected'));
        EXCEPTION WHEN duplicate_column THEN NULL;
        END;
        
        BEGIN
            ALTER TABLE public.loan_requests ADD COLUMN IF NOT EXISTS surety_response_at TIMESTAMPTZ;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END;
        
        BEGIN
            ALTER TABLE public.loan_requests ADD COLUMN IF NOT EXISTS admin_notes TEXT;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END;
    END IF;
END $$;

-- 4. Verify Marketplace Logic - Ensure release_escrow_funds includes is_escrow_paused check
CREATE OR REPLACE FUNCTION public.release_escrow_funds()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_days_elapsed INTEGER;
BEGIN
    -- Process orders that are NOT paused and have exceeded their escrow period
    FOR v_order IN 
        SELECT 
            mo.*,
            mp.category,
            EXTRACT(DAYS FROM (NOW() - mo.created_at)) as days_elapsed
        FROM marketplace_orders mo
        JOIN marketplace_products mp ON mo.product_id = mp.id
        WHERE mo.order_status = 'inspection'
          AND mo.is_escrow_paused = false  -- Critical: Only process non-paused orders
          AND mo.created_at < NOW() - INTERVAL '1 day'  -- At least 1 day old
    LOOP
        -- Determine escrow period based on product category
        CASE v_order.category
            WHEN 'electronics' THEN
                IF v_order.days_elapsed >= 7 THEN
                    -- Release funds for electronics after 7 days
                    UPDATE marketplace_orders
                    SET 
                        order_status = 'completed',
                        updated_at = NOW()
                    WHERE id = v_order.id;
                END IF;
            WHEN 'vehicles' THEN
                IF v_order.days_elapsed >= 30 THEN
                    -- Release funds for vehicles after 30 days
                    UPDATE marketplace_orders
                    SET 
                        order_status = 'completed',
                        updated_at = NOW()
                    WHERE id = v_order.id;
                END IF;
            ELSE
                -- Default: 14 days for other categories
                IF v_order.days_elapsed >= 14 THEN
                    UPDATE marketplace_orders
                    SET 
                        order_status = 'completed',
                        updated_at = NOW()
                    WHERE id = v_order.id;
                END IF;
        END CASE;
    END LOOP;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.calculate_interest_earnings(UUID, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_rank() TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_escrow_funds() TO authenticated;

-- Create updated_at trigger for loan_requests
CREATE OR REPLACE TRIGGER update_loan_requests_updated_at
BEFORE UPDATE ON public.loan_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_loan_requests_user_id ON public.loan_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_loan_requests_status ON public.loan_requests(status);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_status_paused ON public.marketplace_orders(order_status, is_escrow_paused);
