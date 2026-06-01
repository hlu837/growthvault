-- Admin Breach Refund Function for Section 15A.3
-- Allows admin to process a 'Breach of Terms' refund
-- Refunds 90% of Commitment Fee to Buyer, forfeits 10% Commission to platform_revenue

-- Add missing columns to platform_fees table
ALTER TABLE public.platform_fees
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.marketplace_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION admin_process_breach_refund(order_id_param UUID, admin_id_param UUID)
RETURNS JSON AS $$
DECLARE
  order_record RECORD;
  notes_json JSONB;
  commitment_fee NUMERIC;
  refund_amount NUMERIC;
  forfeit_amount NUMERIC;
  buyer_wallet RECORD;
BEGIN
  -- Check if admin/staff
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = admin_id_param
    AND role IN ('admin', 'staff')
  ) THEN
    RETURN json_build_object('success', false, 'message', 'Unauthorized: Admin or staff access required');
  END IF;

  -- Get order details
  SELECT * INTO order_record
  FROM marketplace_orders
  WHERE id = order_id_param;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Order not found');
  END IF;

  -- Parse notes to get commitment_fee
  BEGIN
    notes_json := order_record.notes::jsonb;
    commitment_fee := (notes_json ->> 'commitment_fee')::numeric;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN json_build_object('success', false, 'message', 'Invalid order notes format');
  END;

  IF commitment_fee IS NULL OR commitment_fee <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'No commitment fee found in order');
  END IF;

  -- Calculate amounts
  refund_amount := commitment_fee * 0.9;
  forfeit_amount := commitment_fee * 0.1;

  -- Get buyer's main wallet
  SELECT * INTO buyer_wallet
  FROM wallets
  WHERE user_id = order_record.user_id
  AND wallet_type = 'main';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Buyer wallet not found');
  END IF;

  -- Refund 90% to buyer's wallet
  UPDATE wallets
  SET balance = balance + refund_amount,
      updated_at = NOW()
  WHERE id = buyer_wallet.id;

  -- Insert forfeited 10% as platform fee
  INSERT INTO platform_fees (
    fee_type,
    amount,
    description,
    order_id,
    user_id,
    created_by,
    created_at
  ) VALUES (
    'forfeited_fee',
    forfeit_amount,
    'Forfeited commission from breach refund for order ' || order_record.order_number,
    order_id_param,
    order_record.user_id,
    admin_id_param,
    NOW()
  );

  -- Insert transaction record for refund
  INSERT INTO transactions (
    user_id,
    amount,
    transaction_type,
    description,
    reference_id,
    created_at
  ) VALUES (
    order_record.user_id,
    refund_amount,
    'refund',
    'Breach refund: 90% of commitment fee for order ' || order_record.order_number,
    order_id_param,
    NOW()
  );

  -- Update order status and notes
  UPDATE marketplace_orders
  SET order_status = 'refunded',
      updated_at = NOW(),
      notes = COALESCE(notes, '') || '; Breach refund processed by admin ' || admin_id_param || ' at ' || NOW()
  WHERE id = order_id_param;

  RETURN json_build_object(
    'success', true,
    'message', 'Breach refund processed successfully',
    'refund_amount', refund_amount,
    'forfeit_amount', forfeit_amount,
    'order_number', order_record.order_number
  );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;