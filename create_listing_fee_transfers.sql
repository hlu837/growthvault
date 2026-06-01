-- Create listing_fee_payments table
CREATE TABLE IF NOT EXISTS public.listing_fee_payments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    product_id UUID REFERENCES marketplace_products(id) NOT NULL,
    amount NUMERIC NOT NULL,
    bank_reference TEXT NOT NULL,
    proof_url TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    verified_at TIMESTAMP WITH TIME ZONE
);

-- RLS Policies
ALTER TABLE public.listing_fee_payments ENABLE ROW LEVEL SECURITY;

-- Users can view their own payments
CREATE POLICY "Users can view own listing fee payments" 
    ON public.listing_fee_payments FOR SELECT 
    USING (auth.uid() = user_id);

-- Users can insert their own payments
CREATE POLICY "Users can insert own listing fee payments" 
    ON public.listing_fee_payments FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Admins can view all payments
CREATE POLICY "Admins can view all listing fee payments" 
    ON public.listing_fee_payments FOR ALL 
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Function for Admin to approve and activate listing
CREATE OR REPLACE FUNCTION public.approve_listing_fee_transfer(p_payment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_payment RECORD;
    v_admin_id UUID;
    v_admin_wallet_id UUID;
BEGIN
    -- Check if admin
    SELECT id INTO v_admin_id FROM profiles WHERE id = auth.uid() AND role = 'admin';
    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Only admins can approve listing fees';
    END IF;

    -- Get payment
    SELECT * INTO v_payment FROM listing_fee_payments WHERE id = p_payment_id AND status = 'pending' FOR UPDATE;
    IF v_payment IS NULL THEN
        RAISE EXCEPTION 'Payment not found or not pending';
    END IF;

    -- Get platform/admin wallet
    SELECT id INTO v_admin_wallet_id
    FROM wallets
    WHERE user_id = v_admin_id AND wallet_type = 'commission' LIMIT 1;
    
    IF v_admin_wallet_id IS NULL THEN
        -- Fallback to savings if commission wallet doesn't exist
        SELECT id INTO v_admin_wallet_id
        FROM wallets
        WHERE user_id = v_admin_id AND wallet_type = 'savings' LIMIT 1;
    END IF;

    -- Credit the platform wallet
    IF v_admin_wallet_id IS NOT NULL THEN
        UPDATE wallets SET balance = balance + v_payment.amount WHERE id = v_admin_wallet_id;
        
        -- Create transaction record
        INSERT INTO transaction_history (
            wallet_id, user_id, transaction_type, amount, status, description
        ) VALUES (
            v_admin_wallet_id, v_admin_id, 'listing_fee_received', v_payment.amount, 'completed',
            'Listing fee received via Bank Transfer for product ' || v_payment.product_id
        );
    END IF;

    -- Mark payment as approved
    UPDATE listing_fee_payments 
    SET status = 'approved', verified_at = NOW() 
    WHERE id = p_payment_id;

    -- Update product status to active or pending_verification depending on platform rules
    -- (We will set it to active directly since the fee is paid and verified)
    UPDATE marketplace_products 
    SET status = 'active' 
    WHERE id = v_payment.product_id;

    RETURN json_build_object('success', true, 'message', 'Listing fee approved and product activated');
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_listing_fee_transfer TO authenticated;
