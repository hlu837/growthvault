-- ============================================================
-- FIX MLM BONUS SYSTEM & TIER MAPPING
-- ============================================================

-- Fix 1: Create MLM bonus distribution function
CREATE OR REPLACE FUNCTION public.distribute_mlm_bonus(
    p_investor_id UUID,
    p_investment_amount DECIMAL,
    p_tier investment_tier
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    referrer_id UUID;
    current_level INTEGER DEFAULT 1;
    bonus_amount DECIMAL;
    bonus_rate DECIMAL;
    total_distributed DECIMAL DEFAULT 0;
BEGIN
    -- Get direct referrer
    SELECT referred_by INTO referrer_id
    FROM profiles
    WHERE id = p_investor_id AND referred_by IS NOT NULL;
    
    -- If no referrer, no bonus to distribute
    IF referrer_id IS NULL THEN
        RETURN TRUE;
    END IF;
    
    -- Distribute bonuses up 5 levels
    WHILE referrer_id IS NOT NULL AND current_level <= 5 LOOP
        -- Get bonus rate for current level
        SELECT setting_value::DECIMAL / 100 INTO bonus_rate
        FROM system_settings
        WHERE setting_key = 'mlm_level_' || current_level || '_rate';
        
        -- Use default rates if not found in settings
        IF bonus_rate IS NULL THEN
            bonus_rate := CASE current_level
                WHEN 1 THEN 0.10  -- 10%
                WHEN 2 THEN 0.05  -- 5%
                WHEN 3 THEN 0.03  -- 3%
                WHEN 4 THEN 0.02  -- 2%
                WHEN 5 THEN 0.01  -- 1%
                ELSE 0
            END;
        END IF;
        
        -- Calculate bonus amount (based on MLM portion only)
        bonus_amount := (p_investment_amount / 2) * bonus_rate;
        
        -- Update referrer's MLM bonus wallet
        UPDATE wallets
        SET balance = COALESCE(balance, 0) + bonus_amount, updated_at = NOW()
        WHERE user_id = referrer_id AND wallet_type = 'mlm_bonus';
        
        -- Create bonus transaction record
        INSERT INTO transactions (user_id, transaction_type, amount, description, status)
        VALUES (referrer_id, 'bonus'::transaction_type, bonus_amount, 
                'MLM Bonus - Level ' || current_level || ' from ' || p_tier || ' investment', 'completed');
        
        -- Update referral earnings
        UPDATE referrals
        SET earnings = COALESCE(earnings, 0) + bonus_amount
        WHERE referrer_id = referrer_id AND referred_id = p_investor_id;
        
        total_distributed := total_distributed + bonus_amount;
        
        -- Move to next level upline
        SELECT referred_by INTO referrer_id
        FROM profiles
        WHERE id = referrer_id;
        
        current_level := current_level + 1;
    END LOOP;
    
    RETURN TRUE;
END;
$$;

-- Fix 2: Update process_investment to trigger MLM bonus distribution
CREATE OR REPLACE FUNCTION public.process_investment(
    p_user_id UUID,
    p_amount DECIMAL,
    p_tier investment_tier
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    mlm_amount DECIMAL;
    trading_amount DECIMAL;
    transaction_id UUID;
BEGIN
    -- Authorization: Only allow if caller is processing their own investment
    -- OR if called internally by admin/staff via approve_deposit_and_credit
    IF p_user_id != auth.uid() AND NOT is_admin_or_staff(auth.uid()) THEN
        RAISE EXCEPTION 'Unauthorized: Cannot process investment for another user';
    END IF;

    -- Calculate 50/50 split
    mlm_amount := p_amount / 2;
    trading_amount := p_amount / 2;
    
    -- Create transaction record
    INSERT INTO transactions (user_id, transaction_type, amount, amount_mlm, amount_trading, description)
    VALUES (p_user_id, 'investment'::transaction_type, p_amount, mlm_amount, trading_amount, 'Investment in ' || p_tier || ' tier')
    RETURNING id INTO transaction_id;
    
    -- Update MLM Capital wallet
    UPDATE wallets
    SET balance = balance + mlm_amount, updated_at = NOW()
    WHERE user_id = p_user_id AND wallet_type = 'mlm_capital';
    
    -- Update Trading Principal wallet
    UPDATE wallets
    SET balance = balance + trading_amount, updated_at = NOW()
    WHERE user_id = p_user_id AND wallet_type = 'trading_principal';
    
    -- Update user's investment tier
    UPDATE profiles
    SET investment_tier = p_tier, updated_at = NOW()
    WHERE id = p_user_id;
    
    -- TRIGGER MLM BONUS DISTRIBUTION IMMEDIATELY
    PERFORM distribute_mlm_bonus(p_user_id, p_amount, p_tier);
    
    RETURN transaction_id;
END;
$$;

-- Fix 3: Create function to map investment tiers to display names
CREATE OR REPLACE FUNCTION public.get_tier_display_name(p_tier investment_tier)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN CASE p_tier
        WHEN 'starter' THEN 'Bronze'
        WHEN 'golden' THEN 'Silver'
        WHEN 'premium' THEN 'Gold'
        WHEN 'business' THEN 'Platinum'
        WHEN 'platinum' THEN 'Diamond'
        WHEN 'achiever' THEN 'Achiever'
        ELSE 'Starter'
    END;
END;
$$;

-- Fix 4: Update investment tier enum to include proper tier names
-- Note: This is a comment for reference - actual enum values are used in the database
-- The display mapping is handled by the get_tier_display_name function above

-- Fix 5: Create view for referral stats with proper tier mapping
CREATE OR REPLACE VIEW public.referral_stats_view AS
SELECT 
    r.id,
    r.referrer_id,
    r.referred_id,
    r.level,
    r.earnings,
    r.created_at,
    p.full_name,
    p.email,
    get_tier_display_name(p.investment_tier) as display_tier,
    p.investment_tier as raw_tier
FROM referrals r
LEFT JOIN profiles p ON r.referred_id = p.id
WHERE r.referrer_id IS NOT NULL AND r.referred_id IS NOT NULL;

-- Grant access to the view
GRANT SELECT ON public.referral_stats_view TO authenticated;
GRANT SELECT ON public.referral_stats_view TO service_role;
