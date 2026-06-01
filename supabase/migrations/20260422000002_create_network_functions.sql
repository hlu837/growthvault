-- ============================================================
-- CREATE NETWORK FUNCTIONS FOR MLM SYSTEM
-- ============================================================

-- Function to get user's upline chain
CREATE OR REPLACE FUNCTION public.get_user_upline()
RETURNS TABLE (
    level INTEGER,
    user_id UUID,
    full_name TEXT,
    email TEXT,
    investment_tier TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_id UUID := auth.uid();
    referrer_id UUID;
    current_level INTEGER := 1;
BEGIN
    -- Get direct referrer
    SELECT referred_by INTO referrer_id
    FROM profiles
    WHERE id = current_user_id;
    
    -- Walk up the referral chain
    WHILE referrer_id IS NOT NULL AND current_level <= 5 LOOP
        RETURN QUERY
        SELECT 
            current_level,
            p.id,
            p.full_name,
            p.email,
            get_tier_display_name(p.investment_tier)
        FROM profiles p
        WHERE p.id = referrer_id;
        
        -- Move to next level up
        SELECT referred_by INTO referrer_id
        FROM profiles
        WHERE id = referrer_id;
        
        current_level := current_level + 1;
    END LOOP;
    
    RETURN;
END;
$$;

-- Function to get user's downline network
CREATE OR REPLACE FUNCTION public.get_user_network()
RETURNS TABLE (
    level INTEGER,
    user_id UUID,
    full_name TEXT,
    email TEXT,
    investment_tier TEXT,
    joined_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Use a recursive CTE to get all downline members
    RETURN QUERY
    WITH RECURSIVE downline_tree AS (
        -- Base case: direct referrals (Level 1)
        SELECT 
            1 as level,
            r.referred_id as user_id,
            p.full_name,
            p.email,
            get_tier_display_name(p.investment_tier) as investment_tier,
            p.created_at as joined_at
        FROM referrals r
        JOIN profiles p ON r.referred_id = p.id
        WHERE r.referrer_id = auth.uid()
        
        UNION ALL
        
        -- Recursive case: referrals of referrals (Levels 2-5)
        SELECT 
            dt.level + 1,
            r.referred_id,
            p.full_name,
            p.email,
            get_tier_display_name(p.investment_tier) as investment_tier,
            p.created_at
        FROM referrals r
        JOIN profiles p ON r.referred_id = p.id
        JOIN downline_tree dt ON r.referrer_id = dt.user_id
        WHERE dt.level < 5
    )
    SELECT * FROM downline_tree
    ORDER BY level, joined_at;
    
    RETURN;
END;
$$;

-- Function to get total team size
CREATE OR REPLACE FUNCTION public.get_team_size()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    team_count INTEGER;
BEGIN
    -- Count all downline members up to 5 levels
    WITH RECURSIVE downline_tree AS (
        -- Base case: direct referrals
        SELECT r.referred_id, 1 as level
        FROM referrals r
        WHERE r.referrer_id = auth.uid()
        
        UNION ALL
        
        -- Recursive case: referrals of referrals
        SELECT r.referred_id, dt.level + 1
        FROM referrals r
        JOIN downline_tree dt ON r.referrer_id = dt.referred_id
        WHERE dt.level < 5  -- Limit to 5 levels
    )
    SELECT COUNT(*) INTO team_count
    FROM downline_tree;
    
    RETURN COALESCE(team_count, 0);
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_upline() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_network() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_size() TO authenticated;
