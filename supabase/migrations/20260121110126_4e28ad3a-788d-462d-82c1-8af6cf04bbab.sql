-- 1. Create KYC audit log table
CREATE TABLE IF NOT EXISTS public.kyc_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID NOT NULL,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.kyc_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view kyc audit log" ON public.kyc_audit_log
  FOR SELECT TO authenticated
  USING (is_admin_or_staff(auth.uid()));

-- 2. Create system settings history table
CREATE TABLE IF NOT EXISTS public.system_settings_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL,
  old_value NUMERIC,
  new_value NUMERIC NOT NULL,
  changed_by UUID NOT NULL,
  change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.system_settings_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view settings history" ON public.system_settings_history
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- 3. Create approve_withdrawal function
CREATE OR REPLACE FUNCTION public.approve_withdrawal(p_withdrawal_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_user_id UUID;
  v_amount DECIMAL;
  v_wallet_type wallet_type;
  v_balance DECIMAL;
BEGIN
  -- Only admins can approve
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can approve withdrawals';
  END IF;
  
  -- Get withdrawal details with row lock
  SELECT status, user_id, amount, wallet_type
  INTO v_status, v_user_id, v_amount, v_wallet_type
  FROM withdrawals
  WHERE id = p_withdrawal_id
  FOR UPDATE;
  
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Withdrawal not found';
  END IF;
  
  -- Validate status
  IF v_status != 'pending' THEN
    RAISE EXCEPTION 'Withdrawal not pending (status: %)', v_status;
  END IF;
  
  -- Verify sufficient balance
  SELECT balance INTO v_balance
  FROM wallets
  WHERE user_id = v_user_id AND wallet_type = v_wallet_type
  FOR UPDATE;
  
  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;
  
  IF v_balance < v_amount THEN
    RAISE EXCEPTION 'Insufficient balance: wallet has % but withdrawal is %', v_balance, v_amount;
  END IF;
  
  -- Deduct from wallet
  UPDATE wallets
  SET balance = balance - v_amount, updated_at = NOW()
  WHERE user_id = v_user_id AND wallet_type = v_wallet_type;
  
  -- Update withdrawal
  UPDATE withdrawals
  SET status = 'approved',
      approved_by = auth.uid(),
      approved_at = NOW()
  WHERE id = p_withdrawal_id;
  
  -- Record transaction
  INSERT INTO transactions (user_id, transaction_type, amount, description, status)
  VALUES (v_user_id, 'withdrawal'::transaction_type, v_amount, 'Withdrawal approved from ' || v_wallet_type::TEXT, 'completed');
  
  RETURN TRUE;
END;
$$;

-- 4. Create reject_withdrawal function
CREATE OR REPLACE FUNCTION public.reject_withdrawal(p_withdrawal_id UUID, p_reason TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  -- Only admins can reject
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can reject withdrawals';
  END IF;
  
  -- Get withdrawal status with row lock
  SELECT status INTO v_status
  FROM withdrawals
  WHERE id = p_withdrawal_id
  FOR UPDATE;
  
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Withdrawal not found';
  END IF;
  
  IF v_status != 'pending' THEN
    RAISE EXCEPTION 'Withdrawal not pending (status: %)', v_status;
  END IF;
  
  -- Update withdrawal
  UPDATE withdrawals
  SET status = 'rejected',
      rejection_reason = p_reason,
      approved_by = auth.uid(),
      approved_at = NOW()
  WHERE id = p_withdrawal_id;
  
  RETURN TRUE;
END;
$$;

-- 5. Create approve_kyc function with audit logging
CREATE OR REPLACE FUNCTION public.approve_kyc(
  p_user_id UUID,
  p_new_status TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status TEXT;
BEGIN
  -- Verify admin/staff permission
  IF NOT is_admin_or_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only admin/staff can update KYC status';
  END IF;
  
  -- Validate status (accept staff recommendations and admin final decisions)
  IF p_new_status NOT IN ('pending', 'recommended_approve', 'recommended_reject', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid KYC status: %', p_new_status;
  END IF;
  
  -- Get current status with lock
  SELECT kyc_status INTO v_old_status
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Prevent redundant updates
  IF v_old_status = p_new_status THEN
    RAISE EXCEPTION 'KYC status already set to %', p_new_status;
  END IF;
  
  -- Update KYC status
  UPDATE profiles
  SET kyc_status = p_new_status,
      updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Create audit log
  INSERT INTO kyc_audit_log (user_id, previous_status, new_status, changed_by, rejection_reason)
  VALUES (p_user_id, v_old_status, p_new_status, auth.uid(), p_reason);
  
  RETURN TRUE;
END;
$$;

-- 6. Create update_system_setting function with audit logging
CREATE OR REPLACE FUNCTION public.update_system_setting(
  p_setting_key TEXT,
  p_new_value NUMERIC,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_value NUMERIC;
BEGIN
  -- Only admins can update settings
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can update system settings';
  END IF;
  
  -- Validate setting exists
  SELECT setting_value INTO v_old_value
  FROM system_settings
  WHERE setting_key = p_setting_key
  FOR UPDATE;
  
  IF v_old_value IS NULL THEN
    RAISE EXCEPTION 'Setting % not found', p_setting_key;
  END IF;
  
  -- Validate new value is reasonable
  IF p_new_value < 0 THEN
    RAISE EXCEPTION 'Setting value cannot be negative';
  END IF;
  
  -- For percentages, validate range
  IF p_setting_key LIKE '%_split' OR p_setting_key LIKE '%_rate' THEN
    IF p_new_value > 100 THEN
      RAISE EXCEPTION 'Percentage value cannot exceed 100';
    END IF;
  END IF;
  
  -- Update the setting
  UPDATE system_settings
  SET setting_value = p_new_value,
      updated_by = auth.uid(),
      updated_at = NOW()
  WHERE setting_key = p_setting_key;
  
  -- Record in history
  INSERT INTO system_settings_history (setting_key, old_value, new_value, changed_by, change_reason)
  VALUES (p_setting_key, v_old_value, p_new_value, auth.uid(), p_reason);
  
  RETURN TRUE;
END;
$$;

-- 7. Update exchange_rates policy to require authentication
DROP POLICY IF EXISTS "Anyone can view exchange rates" ON public.exchange_rates;

CREATE POLICY "Authenticated users can view exchange rates" ON public.exchange_rates
  FOR SELECT TO authenticated
  USING (true);

-- 8. Fix profile update policies - restrict staff to using RPC functions only
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));