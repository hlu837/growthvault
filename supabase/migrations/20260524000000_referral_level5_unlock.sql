-- ============================================================
-- AUTO-UNLOCK INVESTMENT PRINCIPAL ON LEVEL 5 COMPLETION
-- ============================================================

-- Update referral rank trigger function to also sync level-5 capital unlocking.
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

    -- When rank logic executes, also sync 5th-level status and unlock any locked capital
    PERFORM update_user_5th_level_status(NEW.id);

    RETURN NEW;
END;
$$;
