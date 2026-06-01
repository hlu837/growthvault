-- Require a valid admin MFA session for super_admin users on deposit approval

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
  -- Enforce MFA for super_admins when approving deposits
  IF public.has_role(auth.uid(), 'super_admin') THEN
    PERFORM public.check_admin_mfa_session(auth.uid());
  END IF;

  -- Verify staff/admin permission
  IF NOT public.is_admin_or_staff(auth.uid()) THEN
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
