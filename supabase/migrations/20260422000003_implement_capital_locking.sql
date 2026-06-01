-- ============================================================
-- INVESTMENT & CAPITAL LOCKING (50/50 RULE)
-- ============================================================

-- Add column to track if user has reached 5th level
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reached_5th_level BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS level_5_reached_at TIMESTAMPTZ;

-- Add locked_balance column to track locked capital
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS locked_balance DECIMAL(15,2) DEFAULT 0.00;

-- Function to check if user has reached 5th level in MLM structure
CREATE OR REPLACE FUNCTION public.check_user_5th_level(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    level_5_exists BOOLEAN;
BEGIN
    -- Check if user has any downline at level 5
    SELECT EXISTS(
        SELECT 1 
        FROM (
            WITH RECURSIVE downline_tree AS (
                -- Level 1
                SELECT r.referred_id, 1 as level
                FROM referrals r
                WHERE r.referrer_id = p_user_id
                
                UNION ALL
                
                -- Levels 2-5
                SELECT r.referred_id, dt.level + 1
                FROM referrals r
                JOIN downline_tree dt ON r.referrer_id = dt.referred_id
                WHERE dt.level < 5
            )
            SELECT 1 FROM downline_tree WHERE level = 5
        ) level5_check
    ) INTO level_5_exists;
    
    RETURN level_5_exists;
END;
$$;

-- Function to update user's 5th level status
CREATE OR REPLACE FUNCTION public.update_user_5th_level_status(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    has_level_5 BOOLEAN;
    current_status BOOLEAN;
BEGIN
    -- Get current status
    SELECT reached_5th_level INTO current_status
    FROM profiles
    WHERE id = p_user_id;
    
    -- Check if user now has level 5 downline
    has_level_5 := check_user_5th_level(p_user_id);
    
    -- Update if status changed
    IF has_level_5 AND NOT current_status THEN
        UPDATE profiles
        SET 
            reached_5th_level = TRUE,
            level_5_reached_at = NOW(),
            updated_at = NOW()
        WHERE id = p_user_id;
        
        -- Unlock all locked capital when 5th level is reached
        UPDATE wallets
        SET 
            balance = COALESCE(balance, 0) + COALESCE(locked_balance, 0),
            locked_balance = 0,
            updated_at = NOW()
        WHERE user_id = p_user_id AND wallet_type IN ('mlm_capital', 'trading_principal');
            
        -- Create transaction record for unlocking
        INSERT INTO transactions (user_id, transaction_type, amount, description, status)
        VALUES (
            p_user_id, 
            'bonus'::transaction_type, 
            (SELECT COALESCE(SUM(locked_balance), 0) FROM wallets WHERE user_id = p_user_id AND wallet_type IN ('mlm_capital', 'trading_principal')),
            'Capital unlocked - Reached 5th MLM level', 
            'completed'
        );
    END IF;
    
    RETURN TRUE;
END;
$$;

-- Update process_investment to implement 50/50 rule
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
    has_level_5 BOOLEAN;
    locked_mlm_amount DECIMAL;
    locked_trading_amount DECIMAL;
BEGIN
    -- Authorization check
    IF p_user_id != auth.uid() AND NOT is_admin_or_staff(auth.uid()) THEN
        RAISE EXCEPTION 'Unauthorized: Cannot process investment for another user';
    END IF;

    -- Check if user has reached 5th level
    has_level_5 := check_user_5th_level(p_user_id);
    
    -- Calculate 50/50 split
    mlm_amount := p_amount / 2;
    trading_amount := p_amount / 2;
    
    -- Create transaction record
    INSERT INTO transactions (user_id, transaction_type, amount, amount_mlm, amount_trading, description)
    VALUES (p_user_id, 'investment'::transaction_type, p_amount, mlm_amount, trading_amount, 'Investment in ' || p_tier || ' tier')
    RETURNING id INTO transaction_id;
    
    -- Handle MLM Capital wallet with locking logic
    IF has_level_5 THEN
        -- User has reached 5th level - unlock full amount
        UPDATE wallets
        SET balance = COALESCE(balance, 0) + mlm_amount, updated_at = NOW()
        WHERE user_id = p_user_id AND wallet_type = 'mlm_capital';
    ELSE
        -- User hasn't reached 5th level - lock 50% of MLM portion
        locked_mlm_amount := mlm_amount / 2;  -- Lock 50% of MLM portion
        UPDATE wallets
        SET 
            balance = COALESCE(balance, 0) + (mlm_amount - locked_mlm_amount),
            locked_balance = COALESCE(locked_balance, 0) + locked_mlm_amount,
            updated_at = NOW()
        WHERE user_id = p_user_id AND wallet_type = 'mlm_capital';
    END IF;
    
    -- Handle Trading Principal wallet with locking logic
    IF has_level_5 THEN
        -- User has reached 5th level - unlock full amount
        UPDATE wallets
        SET balance = COALESCE(balance, 0) + trading_amount, updated_at = NOW()
        WHERE user_id = p_user_id AND wallet_type = 'trading_principal';
    ELSE
        -- User hasn't reached 5th level - lock 50% of Trading portion
        locked_trading_amount := trading_amount / 2;  -- Lock 50% of Trading portion
        UPDATE wallets
        SET 
            balance = COALESCE(balance, 0) + (trading_amount - locked_trading_amount),
            locked_balance = COALESCE(locked_balance, 0) + locked_trading_amount,
            updated_at = NOW()
        WHERE user_id = p_user_id AND wallet_type = 'trading_principal';
    END IF;
    
    -- Update user's investment tier
    UPDATE profiles
    SET investment_tier = p_tier, updated_at = NOW()
    WHERE id = p_user_id;
    
    -- Update 5th level status (in case this investment pushes them to level 5)
    PERFORM update_user_5th_level_status(p_user_id);
    
    -- TRIGGER MLM BONUS DISTRIBUTION
    PERFORM distribute_mlm_bonus(p_user_id, p_amount, p_tier);
    
    RETURN transaction_id;
END;
$$;

-- Function to calculate interest based on 50/50 rule
CREATE OR REPLACE FUNCTION public.calculate_available_balance(p_user_id UUID, p_wallet_type wallet_type)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    total_balance DECIMAL;
    locked_balance DECIMAL;
    has_level_5 BOOLEAN;
BEGIN
    -- Get wallet balances
    SELECT balance, locked_balance INTO total_balance, locked_balance
    FROM wallets
    WHERE user_id = p_user_id AND wallet_type = p_wallet_type;
    
    -- Check if user has reached 5th level
    has_level_5 := check_user_5th_level(p_user_id);
    
    -- If user has reached 5th level, return full balance
    -- If not, return only unlocked portion (balance - locked_balance)
    IF has_level_5 THEN
        RETURN COALESCE(total_balance, 0);
    ELSE
        RETURN COALESCE(total_balance, 0) - COALESCE(locked_balance, 0);
    END IF;
END;
$$;

-- Function to get wallet details with locking info
CREATE OR REPLACE FUNCTION public.get_wallet_details(p_user_id UUID)
RETURNS TABLE (
    wallet_type TEXT,
    total_balance DECIMAL,
    available_balance DECIMAL,
    locked_balance DECIMAL,
    is_locked BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        w.wallet_type,
        COALESCE(w.balance, 0) as total_balance,
        calculate_available_balance(p_user_id, w.wallet_type) as available_balance,
        COALESCE(w.locked_balance, 0) as locked_balance,
        CASE 
            WHEN check_user_5th_level(p_user_id) THEN FALSE
            WHEN COALESCE(w.locked_balance, 0) > 0 THEN TRUE
            ELSE FALSE
        END as is_locked
    FROM wallets w
    WHERE w.user_id = p_user_id
    ORDER BY w.wallet_type;
    
    RETURN;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_user_5th_level(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_5th_level_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_available_balance(UUID, wallet_type) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_wallet_details(UUID) TO authenticated;

-- Update existing users' 5th level status
UPDATE profiles 
SET reached_5th_level = check_user_5th_level(id),
    level_5_reached_at = CASE 
        WHEN check_user_5th_level(id) AND level_5_reached_at IS NULL THEN NOW()
        ELSE level_5_reached_at
    END,
    updated_at = NOW()
WHERE id IN (
    SELECT DISTINCT user_id FROM wallets
);
