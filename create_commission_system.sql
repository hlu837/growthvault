-- Create commission_settings table for configurable commission rates
CREATE TABLE IF NOT EXISTS public.commission_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL CHECK (category IN ('real_estate', 'automobile', 'electronic')),
    min_commission_rate DECIMAL(5,2) NOT NULL CHECK (min_commission_rate >= 0 AND min_commission_rate <= 100),
    max_commission_rate DECIMAL(5,2) NOT NULL CHECK (max_commission_rate >= 0 AND max_commission_rate <= 100),
    default_commission_rate DECIMAL(5,2) NOT NULL CHECK (default_commission_rate >= 0 AND default_commission_rate <= 100),
    commission_type TEXT DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'fixed')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(category)
);

-- Create seller_commission_rates table for individual seller commission rates
CREATE TABLE IF NOT EXISTS public.seller_commission_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('real_estate', 'automobile', 'electronic')),
    commission_rate DECIMAL(5,2) NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 100),
    effective_from TIMESTAMPTZ DEFAULT NOW(),
    effective_until TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(seller_id, category, effective_from)
);

-- Create commission_transactions table to track commission payments
CREATE TABLE IF NOT EXISTS public.commission_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    original_amount DECIMAL(15,2) NOT NULL,
    commission_rate DECIMAL(5,2) NOT NULL,
    commission_amount DECIMAL(15,2) NOT NULL,
    net_amount DECIMAL(15,2) NOT NULL,
    commission_status TEXT DEFAULT 'pending' CHECK (commission_status IN ('pending', 'paid', 'refunded', 'forfeited')),
    transaction_id UUID REFERENCES public.transactions(id),
    paid_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    refund_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.commission_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_commission_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for commission_settings
CREATE POLICY "Anyone can view active commission settings"
    ON public.commission_settings FOR SELECT
    TO authenticated
    USING (is_active = TRUE);

CREATE POLICY "Admins and staff can manage commission settings"
    ON public.commission_settings FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.profiles p ON p.id = ur.user_id
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'staff')
        )
    );

-- RLS Policies for seller_commission_rates
CREATE POLICY "Sellers can view own commission rates"
    ON public.seller_commission_rates FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.seller_profiles sp
            WHERE sp.user_id = auth.uid() AND sp.id = seller_commission_rates.seller_id
        )
    );

CREATE POLICY "Admins and staff can manage seller commission rates"
    ON public.seller_commission_rates FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.profiles p ON p.id = ur.user_id
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'staff')
        )
    );

-- RLS Policies for commission_transactions
CREATE POLICY "Sellers can view own commission transactions"
    ON public.commission_transactions FOR SELECT
    TO authenticated
    USING (seller_id = auth.uid());

CREATE POLICY "Admins and staff can manage all commission transactions"
    ON public.commission_transactions FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.profiles p ON p.id = ur.user_id
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'staff')
        )
    );

-- Functions for commission management
CREATE OR REPLACE FUNCTION public.get_commission_rate(p_seller_id UUID, p_category TEXT)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_seller_rate DECIMAL;
    v_default_rate DECIMAL;
BEGIN
    -- First check for seller-specific rate
    SELECT commission_rate INTO v_seller_rate
    FROM seller_commission_rates
    WHERE seller_id = p_seller_id 
      AND category = p_category 
      AND is_active = TRUE
      AND (effective_until IS NULL OR effective_until > NOW())
    ORDER BY effective_from DESC
    LIMIT 1;
    
    IF v_seller_rate IS NOT NULL THEN
        RETURN v_seller_rate;
    END IF;
    
    -- Fall back to default commission rate
    SELECT default_commission_rate INTO v_default_rate
    FROM commission_settings
    WHERE category = p_category AND is_active = TRUE;
    
    -- Return default rates if no settings found
    IF v_default_rate IS NULL THEN
        CASE p_category
            WHEN 'real_estate' THEN v_default_rate := 8.00;
            WHEN 'automobile' THEN v_default_rate := 10.00;
            WHEN 'electronic' THEN v_default_rate := 15.00;
            ELSE v_default_rate := 10.00;
        END CASE;
    END IF;
    
    RETURN v_default_rate;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_and_deduct_commission(p_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_seller_id UUID;
    v_commission_rate DECIMAL;
    v_commission_amount DECIMAL;
    v_net_amount DECIMAL;
    v_seller_wallet_id UUID;
    v_platform_wallet_id UUID;
    v_commission_transaction_id UUID;
    v_escrow_transaction_id UUID;
BEGIN
    -- Get order details
    SELECT o.*, p.category, p.created_by as seller_id
    INTO v_order
    FROM marketplace_orders o
    JOIN marketplace_products p ON o.product_id = p.id
    WHERE o.id = p_order_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;
    
    -- Only calculate commission for completed orders
    IF v_order.order_status != 'completed' THEN
        RAISE EXCEPTION 'Commission can only be calculated for completed orders';
    END IF;
    
    -- Check if commission already calculated
    IF EXISTS (SELECT 1 FROM commission_transactions WHERE order_id = p_order_id AND commission_status = 'paid') THEN
        RAISE EXCEPTION 'Commission already calculated and paid for this order';
    END IF;
    
    v_seller_id := v_order.seller_id;
    
    -- Get commission rate for this seller and category
    v_commission_rate := get_commission_rate(v_seller_id, v_order.category);
    
    -- Calculate commission amounts
    v_commission_amount := v_order.total_amount * (v_commission_rate / 100);
    v_net_amount := v_order.total_amount - v_commission_amount;
    
    -- Get wallets
    SELECT id INTO v_seller_wallet_id
    FROM wallets
    WHERE user_id = v_seller_id AND wallet_type = 'commission';
    
    SELECT id INTO v_platform_wallet_id
    FROM wallets
    WHERE user_id = (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1) AND wallet_type = 'commission';
    
    IF v_seller_wallet_id IS NULL OR v_platform_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Required wallets not found';
    END IF;
    
    -- Get the escrow transaction for this order
    SELECT id INTO v_escrow_transaction_id
    FROM transactions
    WHERE metadata->>'order_id' = p_order_id::TEXT
      AND transaction_type = 'escrow_hold'
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Create commission transaction record
    INSERT INTO commission_transactions (
        order_id, seller_id, category, original_amount, commission_rate,
        commission_amount, net_amount, commission_status
    ) VALUES (
        p_order_id, v_seller_id, v_order.category, v_order.total_amount,
        v_commission_rate, v_commission_amount, v_net_amount, 'pending'
    ) RETURNING id INTO v_commission_transaction_id;
    
    -- Create transaction for commission payment
    INSERT INTO transactions (
        from_wallet_id, to_wallet_id, amount, transaction_type,
        description, status, metadata
    ) VALUES (
        v_seller_wallet_id, v_platform_wallet_id, v_commission_amount,
        'commission_payment', 'Commission for order ' || v_order.id,
        'completed', json_build_object(
            'order_id', p_order_id,
            'commission_transaction_id', v_commission_transaction_id,
            'commission_rate', v_commission_rate
        )
    ) RETURNING id INTO v_commission_transaction_id;
    
    -- Update wallet balances
    UPDATE wallets SET balance = balance - v_commission_amount WHERE id = v_seller_wallet_id;
    UPDATE wallets SET balance = balance + v_commission_amount WHERE id = v_platform_wallet_id;
    
    -- Update commission transaction status
    UPDATE commission_transactions
    SET commission_status = 'paid', 
        transaction_id = v_commission_transaction_id,
        paid_at = NOW(),
        updated_at = NOW()
    WHERE id = v_commission_transaction_id;
    
    -- Update seller profile stats
    UPDATE seller_profiles
    SET total_sales = total_sales + v_order.total_amount,
        total_orders = total_orders + 1,
        successful_orders = successful_orders + 1,
        updated_at = NOW()
    WHERE user_id = v_seller_id;
    
    RETURN v_commission_transaction_id;
END;
$$;

-- Update escrow release function to include commission calculation
CREATE OR REPLACE FUNCTION public.release_escrow(p_order_id UUID, p_release_reason TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_seller_wallet_id UUID;
    v_buyer_wallet_id UUID;
    v_escrow_transaction_id UUID;
    v_release_amount DECIMAL;
BEGIN
    -- Get order details
    SELECT * INTO v_order
    FROM marketplace_orders
    WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;
    
    -- Check if caller is admin, staff, or the seller
    IF NOT (
        -- Admin or staff
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.profiles p ON p.id = ur.user_id
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'staff')
        )
        -- Or the seller of this order
        OR v_order.user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only admins, staff, or the seller can release escrow';
    END IF;
    
    -- Check if order is in correct status
    IF v_order.order_status != 'pending_delivery' THEN
        RAISE EXCEPTION 'Order must be in pending_delivery status to release escrow';
    END IF;
    
    -- Get wallets
    SELECT id INTO v_seller_wallet_id
    FROM wallets
    WHERE user_id = (SELECT created_by FROM marketplace_products WHERE id = v_order.product_id) 
      AND wallet_type = 'commission';
    
    SELECT id INTO v_buyer_wallet_id
    FROM wallets
    WHERE user_id = v_order.user_id AND wallet_type = 'commission';
    
    IF v_seller_wallet_id IS NULL OR v_buyer_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Required wallets not found';
    END IF;
    
    -- Get the escrow transaction
    SELECT id, amount INTO v_escrow_transaction_id, v_release_amount
    FROM transactions
    WHERE metadata->>'order_id' = p_order_id::TEXT
      AND transaction_type = 'escrow_hold'
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_escrow_transaction_id IS NULL THEN
        RAISE EXCEPTION 'Escrow transaction not found';
    END IF;
    
    -- Calculate and deduct commission BEFORE releasing to seller
    PERFORM calculate_and_deduct_commission(p_order_id);
    
    -- Get the net amount after commission
    SELECT net_amount INTO v_release_amount
    FROM commission_transactions
    WHERE order_id = p_order_id AND commission_status = 'paid'
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Create release transaction
    INSERT INTO transactions (
        from_wallet_id, to_wallet_id, amount, transaction_type,
        description, status, metadata
    ) VALUES (
        v_buyer_wallet_id, v_seller_wallet_id, v_release_amount,
        'escrow_release', 'Escrow release for order ' || p_order_id,
        'completed', json_build_object('order_id', p_order_id, 'release_reason', p_release_reason)
    );
    
    -- Update wallet balances
    UPDATE wallets SET balance = balance - v_release_amount WHERE id = v_buyer_wallet_id;
    UPDATE wallets SET balance = balance + v_release_amount WHERE id = v_seller_wallet_id;
    
    -- Update order status
    UPDATE marketplace_orders
    SET order_status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;
    
    RETURN TRUE;
END;
$$;

-- Create triggers for updated_at
CREATE OR REPLACE TRIGGER update_commission_settings_updated_at
BEFORE UPDATE ON public.commission_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_seller_commission_rates_updated_at
BEFORE UPDATE ON public.seller_commission_rates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_commission_transactions_updated_at
BEFORE UPDATE ON public.commission_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default commission settings
INSERT INTO public.commission_settings (category, min_commission_rate, max_commission_rate, default_commission_rate) VALUES
    ('real_estate', 8.00, 15.00, 8.00),
    ('automobile', 8.00, 15.00, 10.00),
    ('electronic', 8.00, 15.00, 15.00)
ON CONFLICT (category) DO NOTHING;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_commission_rate TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_and_deduct_commission TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_escrow TO authenticated;
