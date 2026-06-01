-- Create savings_vaults table for smart vault functionality
CREATE TABLE public.savings_vaults (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_type wallet_type NOT NULL,
  vault_name TEXT NOT NULL DEFAULT 'My Vault',
  balance NUMERIC NOT NULL DEFAULT 0.00,
  target_amount NUMERIC,
  maturity_date TIMESTAMP WITH TIME ZONE,
  is_locked BOOLEAN NOT NULL DEFAULT true,
  recurring_frequency TEXT CHECK (recurring_frequency IN ('daily', 'weekly', 'monthly', 'manual')),
  recurring_amount NUMERIC DEFAULT 0.00,
  penalty_percentage NUMERIC NOT NULL DEFAULT 0.10,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create platform_fees table to log penalties and fees
CREATE TABLE public.platform_fees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vault_id UUID REFERENCES public.savings_vaults(id) ON DELETE SET NULL,
  fee_type TEXT NOT NULL DEFAULT 'early_withdrawal_penalty',
  amount NUMERIC NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.savings_vaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_fees ENABLE ROW LEVEL SECURITY;

-- RLS policies for savings_vaults
CREATE POLICY "Users can view own vaults" ON public.savings_vaults
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create own vaults" ON public.savings_vaults
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own vaults" ON public.savings_vaults
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own vaults" ON public.savings_vaults
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Admins can view all vaults" ON public.savings_vaults
  FOR SELECT USING (is_admin_or_staff(auth.uid()));

-- RLS policies for platform_fees
CREATE POLICY "Users can view own fees" ON public.platform_fees
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create own fees" ON public.platform_fees
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all fees" ON public.platform_fees
  FOR SELECT USING (is_admin_or_staff(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_savings_vaults_updated_at
  BEFORE UPDATE ON public.savings_vaults
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to process vault withdrawal with penalty
CREATE OR REPLACE FUNCTION public.process_vault_withdrawal(
  p_vault_id UUID,
  p_force_early BOOLEAN DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_vault RECORD;
  v_penalty_amount NUMERIC;
  v_net_amount NUMERIC;
  v_is_early BOOLEAN;
BEGIN
  -- Get vault with lock
  SELECT * INTO v_vault
  FROM savings_vaults
  WHERE id = p_vault_id AND user_id = auth.uid()
  FOR UPDATE;
  
  IF v_vault IS NULL THEN
    RAISE EXCEPTION 'Vault not found or access denied';
  END IF;
  
  IF v_vault.balance <= 0 THEN
    RAISE EXCEPTION 'Vault has no balance to withdraw';
  END IF;
  
  -- Check if early withdrawal
  v_is_early := v_vault.maturity_date IS NOT NULL AND v_vault.maturity_date > NOW();
  
  IF v_is_early AND NOT p_force_early THEN
    -- Return penalty info for confirmation
    v_penalty_amount := v_vault.balance * v_vault.penalty_percentage;
    v_net_amount := v_vault.balance - v_penalty_amount;
    
    RETURN jsonb_build_object(
      'requires_confirmation', true,
      'is_early', true,
      'balance', v_vault.balance,
      'penalty_percentage', v_vault.penalty_percentage,
      'penalty_amount', v_penalty_amount,
      'net_amount', v_net_amount,
      'maturity_date', v_vault.maturity_date
    );
  END IF;
  
  -- Calculate amounts
  IF v_is_early THEN
    v_penalty_amount := v_vault.balance * v_vault.penalty_percentage;
    v_net_amount := v_vault.balance - v_penalty_amount;
    
    -- Log penalty fee
    INSERT INTO platform_fees (user_id, vault_id, fee_type, amount, description)
    VALUES (auth.uid(), p_vault_id, 'early_withdrawal_penalty', v_penalty_amount, 
            'Early withdrawal penalty from vault: ' || v_vault.vault_name);
  ELSE
    v_penalty_amount := 0;
    v_net_amount := v_vault.balance;
  END IF;
  
  -- Credit to savings wallet
  UPDATE wallets
  SET balance = balance + v_net_amount, updated_at = NOW()
  WHERE user_id = auth.uid() AND wallet_type = 'savings';
  
  -- Record transaction
  INSERT INTO transactions (user_id, transaction_type, amount, description, status)
  VALUES (auth.uid(), 'deposit'::transaction_type, v_net_amount, 
          CASE WHEN v_is_early 
            THEN 'Vault withdrawal (early, ' || (v_vault.penalty_percentage * 100)::TEXT || '% penalty applied)'
            ELSE 'Vault withdrawal (matured)'
          END, 'completed');
  
  -- Clear vault balance
  UPDATE savings_vaults
  SET balance = 0, is_locked = false, updated_at = NOW()
  WHERE id = p_vault_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'is_early', v_is_early,
    'withdrawn_amount', v_net_amount,
    'penalty_amount', v_penalty_amount
  );
END;
$$;

-- Function to deposit into vault
CREATE OR REPLACE FUNCTION public.deposit_to_vault(
  p_vault_id UUID,
  p_amount NUMERIC
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_vault RECORD;
  v_savings_balance NUMERIC;
BEGIN
  -- Get vault
  SELECT * INTO v_vault
  FROM savings_vaults
  WHERE id = p_vault_id AND user_id = auth.uid();
  
  IF v_vault IS NULL THEN
    RAISE EXCEPTION 'Vault not found or access denied';
  END IF;
  
  -- Check savings balance
  SELECT balance INTO v_savings_balance
  FROM wallets
  WHERE user_id = auth.uid() AND wallet_type = 'savings'
  FOR UPDATE;
  
  IF v_savings_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient savings balance';
  END IF;
  
  -- Deduct from savings
  UPDATE wallets
  SET balance = balance - p_amount, updated_at = NOW()
  WHERE user_id = auth.uid() AND wallet_type = 'savings';
  
  -- Add to vault
  UPDATE savings_vaults
  SET balance = balance + p_amount, updated_at = NOW()
  WHERE id = p_vault_id;
  
  -- Record transaction
  INSERT INTO transactions (user_id, transaction_type, amount, description, status)
  VALUES (auth.uid(), 'withdrawal'::transaction_type, p_amount, 'Deposit to vault: ' || v_vault.vault_name, 'completed');
  
  RETURN TRUE;
END;
$$;