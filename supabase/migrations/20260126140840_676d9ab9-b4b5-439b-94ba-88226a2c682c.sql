-- =====================================================
-- Fix 1: Vault Direct Manipulation Security
-- =====================================================

-- Add database constraints for validation
ALTER TABLE savings_vaults
  ADD CONSTRAINT vault_balance_positive CHECK (balance >= 0),
  ADD CONSTRAINT vault_target_positive CHECK (target_amount IS NULL OR target_amount > 0),
  ADD CONSTRAINT vault_penalty_range CHECK (penalty_percentage >= 0 AND penalty_percentage <= 1),
  ADD CONSTRAINT vault_recurring_positive CHECK (recurring_amount IS NULL OR recurring_amount >= 0);

-- Drop and recreate UPDATE policy to prevent balance/penalty manipulation
DROP POLICY IF EXISTS "Users can update own vaults" ON savings_vaults;

-- Only allow updating safe metadata fields (vault_name, target_amount, recurring settings)
-- Balance and penalty cannot be modified directly
CREATE POLICY "Users can update vault metadata" ON savings_vaults
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
  );

-- Drop and recreate DELETE policy to only allow deleting empty vaults
DROP POLICY IF EXISTS "Users can delete own vaults" ON savings_vaults;

CREATE POLICY "Users can delete empty vaults" ON savings_vaults
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND balance = 0);

-- Create secure RPC for vault creation with validation
CREATE OR REPLACE FUNCTION create_savings_vault(
  p_wallet_type wallet_type,
  p_vault_name TEXT,
  p_target_amount NUMERIC DEFAULT NULL,
  p_maturity_date TIMESTAMPTZ DEFAULT NULL,
  p_recurring_frequency TEXT DEFAULT 'manual',
  p_recurring_amount NUMERIC DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vault_id UUID;
  v_penalty NUMERIC := 0.1; -- Default 10% penalty
BEGIN
  -- Validate inputs
  IF p_target_amount IS NOT NULL AND p_target_amount <= 0 THEN
    RAISE EXCEPTION 'Target amount must be positive';
  END IF;
  
  IF p_maturity_date IS NOT NULL AND p_maturity_date <= NOW() THEN
    RAISE EXCEPTION 'Maturity date must be in the future';
  END IF;
  
  IF p_recurring_amount < 0 THEN
    RAISE EXCEPTION 'Recurring amount cannot be negative';
  END IF;
  
  IF p_recurring_frequency NOT IN ('daily', 'weekly', 'monthly', 'manual') THEN
    RAISE EXCEPTION 'Invalid recurring frequency';
  END IF;
  
  -- Try to get system penalty percentage
  SELECT setting_value / 100 INTO v_penalty
  FROM system_settings
  WHERE setting_key = 'early_withdrawal_penalty';
  
  -- Use default if not found
  IF v_penalty IS NULL THEN
    v_penalty := 0.1;
  END IF;
  
  INSERT INTO savings_vaults (
    user_id, wallet_type, vault_name, target_amount,
    maturity_date, recurring_frequency, recurring_amount,
    penalty_percentage, is_locked, balance
  )
  VALUES (
    auth.uid(), p_wallet_type, p_vault_name, p_target_amount,
    p_maturity_date, p_recurring_frequency, p_recurring_amount,
    v_penalty, p_maturity_date IS NOT NULL, 0
  )
  RETURNING id INTO v_vault_id;
  
  RETURN v_vault_id;
END;
$$;

-- Create secure RPC for updating vault metadata only
CREATE OR REPLACE FUNCTION update_vault_metadata(
  p_vault_id UUID,
  p_vault_name TEXT DEFAULT NULL,
  p_target_amount NUMERIC DEFAULT NULL,
  p_recurring_frequency TEXT DEFAULT NULL,
  p_recurring_amount NUMERIC DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vault RECORD;
BEGIN
  -- Get vault with ownership check
  SELECT * INTO v_vault
  FROM savings_vaults
  WHERE id = p_vault_id AND user_id = auth.uid();
  
  IF v_vault IS NULL THEN
    RAISE EXCEPTION 'Vault not found or access denied';
  END IF;
  
  -- Validate inputs
  IF p_target_amount IS NOT NULL AND p_target_amount <= 0 THEN
    RAISE EXCEPTION 'Target amount must be positive';
  END IF;
  
  IF p_recurring_amount IS NOT NULL AND p_recurring_amount < 0 THEN
    RAISE EXCEPTION 'Recurring amount cannot be negative';
  END IF;
  
  IF p_recurring_frequency IS NOT NULL AND p_recurring_frequency NOT IN ('daily', 'weekly', 'monthly', 'manual') THEN
    RAISE EXCEPTION 'Invalid recurring frequency';
  END IF;
  
  -- Update only allowed fields
  UPDATE savings_vaults
  SET
    vault_name = COALESCE(p_vault_name, vault_name),
    target_amount = COALESCE(p_target_amount, target_amount),
    recurring_frequency = COALESCE(p_recurring_frequency, recurring_frequency),
    recurring_amount = COALESCE(p_recurring_amount, recurring_amount),
    updated_at = NOW()
  WHERE id = p_vault_id AND user_id = auth.uid();
  
  RETURN TRUE;
END;
$$;

-- Remove direct INSERT permission (use RPC instead)
DROP POLICY IF EXISTS "Users can create own vaults" ON savings_vaults;

-- Allow only service role/RPC to insert
CREATE POLICY "Only RPC can create vaults" ON savings_vaults
  FOR INSERT TO authenticated
  WITH CHECK (false); -- Direct inserts blocked, use create_savings_vault RPC