-- Fix 1: Add authorization check to process_investment
-- Ensures users can only process their own investments (unless admin/staff calling via approve function)
CREATE OR REPLACE FUNCTION public.process_investment(p_user_id uuid, p_amount numeric, p_tier investment_tier)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  INSERT INTO public.transactions (user_id, transaction_type, amount, amount_mlm, amount_trading, description)
  VALUES (p_user_id, 'investment'::transaction_type, p_amount, mlm_amount, trading_amount, 'Investment in ' || p_tier || ' tier')
  RETURNING id INTO transaction_id;
  
  -- Update MLM Capital wallet
  UPDATE public.wallets
  SET balance = balance + mlm_amount, updated_at = NOW()
  WHERE user_id = p_user_id AND wallet_type = 'mlm_capital';
  
  -- Update Trading Principal wallet
  UPDATE public.wallets
  SET balance = balance + trading_amount, updated_at = NOW()
  WHERE user_id = p_user_id AND wallet_type = 'trading_principal';
  
  -- Update user's investment tier
  UPDATE public.profiles
  SET investment_tier = p_tier, updated_at = NOW()
  WHERE id = p_user_id;
  
  RETURN transaction_id;
END;
$$;

-- Fix 2: Create approve_deposit_and_credit function for staff to verify deposits AND credit accounts
CREATE OR REPLACE FUNCTION public.approve_deposit_and_credit(
  p_deposit_id UUID,
  p_tier investment_tier DEFAULT 'starter'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_amount DECIMAL;
  v_status TEXT;
  v_deposit_type TEXT;
BEGIN
  -- Verify staff/admin permission
  IF NOT is_admin_or_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only staff or admin can approve deposits';
  END IF;

  -- Get deposit details with row lock to prevent race conditions
  SELECT user_id, amount, status, deposit_type
  INTO v_user_id, v_amount, v_status, v_deposit_type
  FROM deposits
  WHERE id = p_deposit_id
  FOR UPDATE;

  -- Check deposit exists
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Deposit not found';
  END IF;

  -- Validate status
  IF v_status != 'pending' THEN
    RAISE EXCEPTION 'Deposit already processed (status: %)', v_status;
  END IF;

  -- Process based on deposit type
  IF v_deposit_type = 'investment' THEN
    -- Process the investment (credits wallets and updates tier)
    PERFORM process_investment(v_user_id, v_amount, p_tier);
  ELSIF v_deposit_type = 'general' THEN
    -- Credit main wallet for general deposits
    UPDATE public.wallets
    SET balance = balance + v_amount, updated_at = NOW()
    WHERE user_id = v_user_id AND wallet_type = 'main';

    -- Create transaction record
    INSERT INTO public.transactions (user_id, transaction_type, amount, description)
    VALUES (v_user_id, 'deposit'::transaction_type, v_amount, 'General deposit to main wallet');
  ELSE
    RAISE EXCEPTION 'Invalid deposit type: %', v_deposit_type;
  END IF;

  -- Mark deposit as verified
  UPDATE deposits
  SET status = 'verified',
      verified_by = auth.uid(),
      verified_at = NOW()
  WHERE id = p_deposit_id;

  RETURN TRUE;
END;
$$;