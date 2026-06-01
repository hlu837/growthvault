-- =============================================
-- PAYPAL INTEGRATION MIGRATION
-- =============================================
-- Purpose: Set up PayPal payment processing and wallet funding system
-- Date: May 20, 2026

-- =============================================
-- 1. PAYPAL TRANSACTIONS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS public.paypal_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User Reference
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  
  -- PayPal Order Details
  paypal_order_id TEXT UNIQUE NOT NULL,
  capture_id TEXT,
  
  -- Amount Information
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  currency TEXT DEFAULT 'USD',
  
  -- Status Tracking
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Created but not approved
    'approved',     -- User approved but not captured
    'completed',    -- Successfully captured
    'denied',       -- Payment denied
    'refunded',     -- Refunded
    'expired',      -- Order expired
    'cancelled',    -- User cancelled
    'failed'        -- Payment processing failed
  )),
  
  -- Relationship to Orders
  payment_type TEXT DEFAULT 'paypal', -- 'paypal', 'wallet_transfer', etc.
  escrow_transaction_id UUID REFERENCES public.escrow_transactions(id) ON DELETE SET NULL,
  marketplace_order_id UUID REFERENCES public.marketplace_orders(id) ON DELETE SET NULL,
  
  -- Timeline
  created_at TIMESTAMPTZ DEFAULT now(),
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  error_message TEXT,
  
  -- Soft Delete
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ
);

-- Indexes for paypal_transactions
CREATE INDEX idx_paypal_user ON public.paypal_transactions(user_id) WHERE is_deleted = false;
CREATE INDEX idx_paypal_status ON public.paypal_transactions(status) WHERE is_deleted = false;
CREATE INDEX idx_paypal_order_id ON public.paypal_transactions(paypal_order_id);
CREATE INDEX idx_paypal_escrow ON public.paypal_transactions(escrow_transaction_id) WHERE is_deleted = false;
CREATE INDEX idx_paypal_marketplace_order ON public.paypal_transactions(marketplace_order_id) WHERE is_deleted = false;
CREATE INDEX idx_paypal_created ON public.paypal_transactions(created_at DESC);

-- =============================================
-- 2. RLS POLICIES FOR PAYPAL TRANSACTIONS
-- =============================================

ALTER TABLE public.paypal_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own transactions
CREATE POLICY "Users can view own PayPal transactions"
  ON public.paypal_transactions FOR SELECT
  USING (user_id = auth.uid());

-- Service role can manage all transactions
CREATE POLICY "Service role manages PayPal transactions"
  ON public.paypal_transactions FOR ALL
  USING (auth.role() = 'service_role');

-- Admins can view all transactions
CREATE POLICY "Admins can view all PayPal transactions"
  ON public.paypal_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'staff')
    )
  );

-- =============================================
-- 3. PAYMENT LOGS TABLE (For Audit Trail)
-- =============================================

CREATE TABLE IF NOT EXISTS public.payment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference
  paypal_transaction_id UUID REFERENCES public.paypal_transactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  
  -- Event Details
  event_type TEXT NOT NULL, -- 'order_created', 'order_approved', 'captured', 'refunded', etc.
  old_status TEXT,
  new_status TEXT,
  
  -- PayPal Response Details
  paypal_response JSONB,
  
  -- Timeline
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Metadata
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_payment_logs_transaction ON public.payment_logs(paypal_transaction_id);
CREATE INDEX idx_payment_logs_user ON public.payment_logs(user_id);
CREATE INDEX idx_payment_logs_event ON public.payment_logs(event_type);
CREATE INDEX idx_payment_logs_created ON public.payment_logs(created_at DESC);

-- =============================================
-- 4. FUNCTION: Fund Wallet from PayPal Payment
-- =============================================

CREATE OR REPLACE FUNCTION public.fund_wallet_from_paypal(
  p_user_id UUID,
  p_escrow_transaction_id UUID,
  p_amount NUMERIC,
  p_paypal_transaction_id TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  wallet_id UUID,
  new_balance NUMERIC
) AS $$
DECLARE
  v_escrow_record RECORD;
  v_wallet_id UUID;
  v_wallet_balance NUMERIC;
  v_transaction_id UUID;
BEGIN
  -- Get escrow transaction details
  SELECT 
    et.id,
    et.buyer_id,
    et.escrow_amount,
    et.buyer_source_wallet,
    et.escrow_status
  INTO v_escrow_record
  FROM public.escrow_transactions et
  WHERE et.id = p_escrow_transaction_id
  AND et.is_deleted = false;

  IF v_escrow_record IS NULL THEN
    RETURN QUERY SELECT false, 'Escrow transaction not found', NULL::UUID, NULL::NUMERIC;
    RETURN;
  END IF;

  -- Verify user is the buyer
  IF v_escrow_record.buyer_id != p_user_id THEN
    RETURN QUERY SELECT false, 'User is not the buyer of this escrow transaction', NULL::UUID, NULL::NUMERIC;
    RETURN;
  END IF;

  -- Verify amount matches
  IF p_amount != v_escrow_record.escrow_amount THEN
    RETURN QUERY SELECT false, 'Payment amount does not match escrow amount', NULL::UUID, NULL::NUMERIC;
    RETURN;
  END IF;

  -- Get or create wallet for buyer
  SELECT id INTO v_wallet_id
  FROM public.wallets
  WHERE user_id = p_user_id
  AND wallet_type = v_escrow_record.buyer_source_wallet;

  IF v_wallet_id IS NULL THEN
    -- Create wallet if it doesn't exist
    INSERT INTO public.wallets (user_id, wallet_type, balance)
    VALUES (p_user_id, v_escrow_record.buyer_source_wallet, 0)
    RETURNING id INTO v_wallet_id;
  END IF;

  -- Record the wallet transaction
  INSERT INTO public.wallet_transactions (
    wallet_id,
    user_id,
    transaction_type,
    amount,
    description,
    reference_type,
    reference_id,
    status
  )
  VALUES (
    v_wallet_id,
    p_user_id,
    'debit', -- Payment is a debit from wallet
    p_amount,
    'Payment for escrow transaction via PayPal',
    'paypal_payment',
    p_paypal_transaction_id,
    'completed'
  )
  RETURNING id INTO v_transaction_id;

  -- Update wallet balance (deduct from wallet)
  UPDATE public.wallets
  SET balance = balance - p_amount,
      updated_at = now()
  WHERE id = v_wallet_id
  RETURNING balance INTO v_wallet_balance;

  -- Update escrow transaction status to funded
  UPDATE public.escrow_transactions
  SET 
    escrow_status = 'funded',
    funded_at = now(),
    updated_at = now(),
    metadata = jsonb_set(
      COALESCE(metadata, '{}'),
      '{paypal_transaction_id}',
      to_jsonb(p_paypal_transaction_id)
    )
  WHERE id = p_escrow_transaction_id;

  -- Log the payment in audit trail
  INSERT INTO public.payment_logs (
    paypal_transaction_id,
    user_id,
    event_type,
    old_status,
    new_status,
    metadata
  )
  SELECT 
    pt.id,
    p_user_id,
    'wallet_funded',
    'pending',
    'completed',
    jsonb_build_object(
      'escrow_transaction_id', p_escrow_transaction_id,
      'wallet_id', v_wallet_id,
      'amount', p_amount
    )
  FROM public.paypal_transactions pt
  WHERE pt.paypal_order_id = p_paypal_transaction_id;

  RETURN QUERY SELECT true, 'Wallet funded successfully', v_wallet_id, v_wallet_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 5. FUNCTION: Process PayPal Refund
-- =============================================

CREATE OR REPLACE FUNCTION public.process_paypal_refund(
  p_paypal_transaction_id TEXT,
  p_refund_amount NUMERIC,
  p_refund_reason TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  refund_status TEXT
) AS $$
DECLARE
  v_paypal_tx RECORD;
  v_wallet_id UUID;
BEGIN
  -- Get PayPal transaction
  SELECT id, user_id, paypal_order_id, amount, status
  INTO v_paypal_tx
  FROM public.paypal_transactions
  WHERE paypal_order_id = p_paypal_transaction_id
  AND is_deleted = false;

  IF v_paypal_tx IS NULL THEN
    RETURN QUERY SELECT false, 'PayPal transaction not found', 'failed'::TEXT;
    RETURN;
  END IF;

  -- Update transaction status
  UPDATE public.paypal_transactions
  SET status = 'refunded',
      updated_at = now(),
      metadata = jsonb_set(
        COALESCE(metadata, '{}'),
        '{refund_reason}',
        to_jsonb(p_refund_reason)
      )
  WHERE id = v_paypal_tx.id;

  -- If there's an associated escrow transaction, update it
  UPDATE public.escrow_transactions
  SET escrow_status = 'refunded',
      refunded_at = now(),
      updated_at = now()
  WHERE id = (
    SELECT escrow_transaction_id
    FROM public.paypal_transactions
    WHERE id = v_paypal_tx.id
  )
  AND is_deleted = false;

  RETURN QUERY SELECT true, 'Refund processed successfully', 'refunded'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 6. TRIGGER: Update paypal_transactions timestamp
-- =============================================

CREATE OR REPLACE FUNCTION public.update_paypal_transactions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER paypal_transactions_update_timestamp
BEFORE UPDATE ON public.paypal_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_paypal_transactions_timestamp();

-- =============================================
-- 7. TRIGGER: Log PayPal transaction status changes
-- =============================================

CREATE OR REPLACE FUNCTION public.log_paypal_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.payment_logs (
      paypal_transaction_id,
      user_id,
      event_type,
      old_status,
      new_status,
      metadata
    )
    VALUES (
      NEW.id,
      NEW.user_id,
      'status_changed',
      OLD.status,
      NEW.status,
      jsonb_build_object('trigger', 'status_change_trigger')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER paypal_log_status_change
AFTER UPDATE ON public.paypal_transactions
FOR EACH ROW
EXECUTE FUNCTION public.log_paypal_status_change();
