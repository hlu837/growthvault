-- Insert MLM Level Rates (1-5)
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES 
  ('mlm_level_1_rate', 10, 'Level 1 referral commission rate (%)'),
  ('mlm_level_2_rate', 5, 'Level 2 referral commission rate (%)'),
  ('mlm_level_3_rate', 3, 'Level 3 referral commission rate (%)'),
  ('mlm_level_4_rate', 2, 'Level 4 referral commission rate (%)'),
  ('mlm_level_5_rate', 1, 'Level 5 referral commission rate (%)')
ON CONFLICT (setting_key) DO NOTHING;

-- Insert Vault APY Rates
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES 
  ('prudent_vault_apy', 5, 'Prudent Saving vault annual percentage yield (%)'),
  ('golden_vault_apy', 8, 'Golden Saving vault annual percentage yield (%)'),
  ('projects_vault_apy', 10, 'Projects Saving vault annual percentage yield (%)'),
  ('future_vault_apy', 12, 'Future Saving vault annual percentage yield (%)'),
  ('loans_vault_apy', 6, 'Loans Saving vault annual percentage yield (%)')
ON CONFLICT (setting_key) DO NOTHING;

-- Insert Penalty Fee Setting
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES 
  ('early_withdrawal_penalty', 10, 'Early withdrawal penalty percentage (%)')
ON CONFLICT (setting_key) DO NOTHING;

-- Insert Global Platform Freeze Setting
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES 
  ('platform_withdrawals_frozen', 0, 'Global freeze on withdrawals (0 = active, 1 = frozen)')
ON CONFLICT (setting_key) DO NOTHING;

-- Create admin balance adjustment function
CREATE OR REPLACE FUNCTION public.admin_adjust_balance(
  p_user_id UUID,
  p_wallet_type wallet_type,
  p_amount NUMERIC,
  p_reason TEXT
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  -- Only admins can adjust balances
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can adjust balances';
  END IF;

  -- Get current balance
  SELECT balance INTO v_current_balance
  FROM wallets
  WHERE user_id = p_user_id AND wallet_type = p_wallet_type
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  v_new_balance := v_current_balance + p_amount;

  -- Prevent negative balances
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Adjustment would result in negative balance';
  END IF;

  -- Update wallet
  UPDATE wallets
  SET balance = v_new_balance, updated_at = NOW()
  WHERE user_id = p_user_id AND wallet_type = p_wallet_type;

  -- Record transaction
  INSERT INTO transactions (user_id, transaction_type, amount, description, status)
  VALUES (
    p_user_id, 
    CASE WHEN p_amount >= 0 THEN 'bonus'::transaction_type ELSE 'withdrawal'::transaction_type END,
    ABS(p_amount), 
    'Admin adjustment: ' || p_reason, 
    'completed'
  );

  RETURN TRUE;
END;
$$;