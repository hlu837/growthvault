-- Add admin MFA session support and require it for critical admin operations

CREATE TABLE IF NOT EXISTS public.admin_mfa_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + interval '10 minutes'),
  user_agent TEXT,
  ip_address TEXT
);

ALTER TABLE public.admin_mfa_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can insert own admin MFA sessions" ON public.admin_mfa_sessions;
CREATE POLICY "Admins can insert own admin MFA sessions"
  ON public.admin_mfa_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can select own admin MFA sessions" ON public.admin_mfa_sessions;
CREATE POLICY "Admins can select own admin MFA sessions"
  ON public.admin_mfa_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can delete own admin MFA sessions" ON public.admin_mfa_sessions;
CREATE POLICY "Admins can delete own admin MFA sessions"
  ON public.admin_mfa_sessions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.create_admin_mfa_session(
  p_user_id UUID DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: not authenticated';
  END IF;

  IF p_user_id IS NULL THEN
    p_user_id := auth.uid();
  END IF;

  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: user mismatch';
  END IF;

  IF NOT has_role(auth.uid(), 'admin') AND NOT has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin privileges required';
  END IF;

  INSERT INTO public.admin_mfa_sessions (user_id, user_agent, ip_address)
  VALUES (p_user_id, p_user_agent, p_ip_address);

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_admin_mfa_session(
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: not authenticated';
  END IF;

  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: user mismatch';
  END IF;

  IF NOT has_role(auth.uid(), 'admin') AND NOT has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin privileges required';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.admin_mfa_sessions
    WHERE user_id = p_user_id
      AND expires_at > now()
  )
  INTO v_exists;

  IF NOT v_exists THEN
    RAISE EXCEPTION 'Admin MFA session required';
  END IF;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.invalidate_admin_mfa_sessions(
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: not authenticated';
  END IF;

  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: user mismatch';
  END IF;

  DELETE FROM public.admin_mfa_sessions
  WHERE user_id = p_user_id;

  RETURN TRUE;
END;
$$;

-- Require admin MFA session for critical admin-only RPCs
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
  PERFORM public.check_admin_mfa_session(auth.uid());

  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can approve withdrawals';
  END IF;

  SELECT status, user_id, amount, wallet_type
  INTO v_status, v_user_id, v_amount, v_wallet_type
  FROM withdrawals
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Withdrawal not found';
  END IF;

  IF v_status != 'pending' THEN
    RAISE EXCEPTION 'Withdrawal not pending (status: %)', v_status;
  END IF;

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

  UPDATE wallets
  SET balance = balance - v_amount, updated_at = NOW()
  WHERE user_id = v_user_id AND wallet_type = v_wallet_type;

  UPDATE withdrawals
  SET status = 'approved',
      approved_by = auth.uid(),
      approved_at = NOW()
  WHERE id = p_withdrawal_id;

  INSERT INTO transactions (user_id, transaction_type, amount, description, status)
  VALUES (v_user_id, 'withdrawal'::transaction_type, v_amount, 'Withdrawal approved from ' || v_wallet_type::TEXT, 'completed');

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_withdrawal(p_withdrawal_id UUID, p_reason TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  PERFORM public.check_admin_mfa_session(auth.uid());

  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can reject withdrawals';
  END IF;

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

  UPDATE withdrawals
  SET status = 'rejected',
      rejection_reason = p_reason,
      approved_by = auth.uid(),
      approved_at = NOW()
  WHERE id = p_withdrawal_id;

  RETURN TRUE;
END;
$$;

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
  PERFORM public.check_admin_mfa_session(auth.uid());

  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can update system settings';
  END IF;

  SELECT setting_value INTO v_old_value
  FROM system_settings
  WHERE setting_key = p_setting_key
  FOR UPDATE;

  IF v_old_value IS NULL THEN
    RAISE EXCEPTION 'Setting % not found', p_setting_key;
  END IF;

  IF p_new_value < 0 THEN
    RAISE EXCEPTION 'Setting value cannot be negative';
  END IF;

  IF p_setting_key LIKE '%_split' OR p_setting_key LIKE '%_rate' THEN
    IF p_new_value > 100 THEN
      RAISE EXCEPTION 'Percentage value cannot exceed 100';
    END IF;
  END IF;

  UPDATE system_settings
  SET setting_value = p_new_value,
      updated_by = auth.uid(),
      updated_at = NOW()
  WHERE setting_key = p_setting_key;

  INSERT INTO system_settings_history (setting_key, old_value, new_value, changed_by, change_reason)
  VALUES (p_setting_key, v_old_value, p_new_value, auth.uid(), p_reason);

  RETURN TRUE;
END;
$$;
