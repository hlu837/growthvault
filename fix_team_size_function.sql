-- Fix the get_team_size() function to properly track recursion levels
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
