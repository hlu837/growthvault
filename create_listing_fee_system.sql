-- Create listing_fees table for tracking listing fee payments
CREATE TABLE IF NOT EXISTS public.listing_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('real_estate', 'automobile')),
    fee_amount DECIMAL(10,2) NOT NULL,
    fee_status TEXT DEFAULT 'pending' CHECK (fee_status IN ('pending', 'paid', 'refunded', 'forfeited')),
    payment_method TEXT,
    transaction_id UUID REFERENCES public.transactions(id),
    paid_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    refund_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(product_id)
);

-- Create listing_fee_settings table for configurable fees
CREATE TABLE IF NOT EXISTS public.listing_fee_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL CHECK (category IN ('real_estate', 'automobile')),
    min_fee DECIMAL(10,2) NOT NULL,
    max_fee DECIMAL(10,2) NOT NULL,
    fee_type TEXT DEFAULT 'fixed' CHECK (fee_type IN ('fixed', 'percentage')),
    percentage_rate DECIMAL(5,2), -- Only used if fee_type is 'percentage'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(category)
);

-- Enable RLS
ALTER TABLE public.listing_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_fee_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for listing_fees
CREATE POLICY "Sellers can view own listing fees"
    ON public.listing_fees FOR SELECT
    TO authenticated
    USING (seller_id = auth.uid());

CREATE POLICY "Admins and staff can manage all listing fees"
    ON public.listing_fees FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.profiles p ON p.id = ur.user_id
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'staff')
        )
    );

-- RLS Policies for listing_fee_settings
CREATE POLICY "Anyone can view listing fee settings"
    ON public.listing_fee_settings FOR SELECT
    TO authenticated
    USING (is_active = TRUE);

CREATE POLICY "Admins and staff can manage listing fee settings"
    ON public.listing_fee_settings FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.profiles p ON p.id = ur.user_id
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'staff')
        )
    );

-- Functions for listing fee management
CREATE OR REPLACE FUNCTION public.get_listing_fee(p_category TEXT)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_fee DECIMAL;
BEGIN
    -- Get fee settings for category
    SELECT min_fee INTO v_fee
    FROM listing_fee_settings
    WHERE category = p_category AND is_active = TRUE;
    
    -- Return default fees if no settings found
    IF v_fee IS NULL THEN
        CASE p_category
            WHEN 'real_estate' THEN v_fee := 100.00;
            WHEN 'automobile' THEN v_fee := 20.00;
            ELSE v_fee := 0.00;
        END CASE;
    END IF;
    
    RETURN v_fee;
END;
$$;

CREATE OR REPLACE FUNCTION public.pay_listing_fee(p_product_id UUID, p_payment_method TEXT DEFAULT 'wallet')
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_product RECORD;
    v_fee_amount DECIMAL;
    v_fee_id UUID;
    v_transaction_id UUID;
    v_seller_wallet_id UUID;
    v_platform_wallet_id UUID;
BEGIN
    -- Get product details
    SELECT * INTO v_product
    FROM marketplace_products
    WHERE id = p_product_id AND created_by = auth.uid();
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found or unauthorized';
    END IF;
    
    -- Check if listing fee already paid
    IF EXISTS (SELECT 1 FROM listing_fees WHERE product_id = p_product_id AND fee_status = 'paid') THEN
        RAISE EXCEPTION 'Listing fee already paid for this product';
    END IF;
    
    -- Only require listing fees for real_estate and automobile
    IF v_product.category NOT IN ('real_estate', 'automobile') THEN
        RAISE EXCEPTION 'Listing fee not required for this category';
    END IF;
    
    -- Calculate fee amount
    v_fee_amount := get_listing_fee(v_product.category);
    
    -- Get seller wallet
    SELECT id INTO v_seller_wallet_id
    FROM wallets
    WHERE user_id = auth.uid() AND wallet_type = 'commission';
    
    IF v_seller_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Seller commission wallet not found';
    END IF;
    
    -- Get platform wallet
    SELECT id INTO v_platform_wallet_id
    FROM wallets
    WHERE user_id = (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1) AND wallet_type = 'commission';
    
    IF v_platform_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Platform wallet not found';
    END IF;
    
    -- Check sufficient balance
    IF (SELECT balance FROM wallets WHERE id = v_seller_wallet_id) < v_fee_amount THEN
        RAISE EXCEPTION 'Insufficient balance for listing fee';
    END IF;
    
    -- Create transaction for listing fee
    INSERT INTO transactions (
        from_wallet_id, to_wallet_id, amount, transaction_type, 
        description, status, metadata
    ) VALUES (
        v_seller_wallet_id, v_platform_wallet_id, v_fee_amount,
        'listing_fee', 'Listing fee payment for ' || v_product.category,
        'completed', json_build_object('product_id', p_product_id)
    ) RETURNING id INTO v_transaction_id;
    
    -- Update wallet balances
    UPDATE wallets SET balance = balance - v_fee_amount WHERE id = v_seller_wallet_id;
    UPDATE wallets SET balance = balance + v_fee_amount WHERE id = v_platform_wallet_id;
    
    -- Create listing fee record
    INSERT INTO listing_fees (
        product_id, seller_id, category, fee_amount, fee_status,
        payment_method, transaction_id, paid_at
    ) VALUES (
        p_product_id, auth.uid(), v_product.category, v_fee_amount,
        'paid', p_payment_method, v_transaction_id, NOW()
    ) RETURNING id INTO v_fee_id;
    
    -- Update product status to pending_verification
    UPDATE marketplace_products
    SET status = 'pending_verification', updated_at = NOW()
    WHERE id = p_product_id;
    
    RETURN v_fee_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_listing_fee(p_product_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_listing_fee RECORD;
    v_seller_wallet_id UUID;
    v_platform_wallet_id UUID;
    v_refund_transaction_id UUID;
BEGIN
    -- Check if caller is admin or staff
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.profiles p ON p.id = ur.user_id
        WHERE ur.user_id = auth.uid() 
        AND ur.role IN ('admin', 'staff')
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only admins and staff can refund listing fees';
    END IF;
    
    -- Get listing fee record
    SELECT * INTO v_listing_fee
    FROM listing_fees
    WHERE product_id = p_product_id AND fee_status = 'paid';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No paid listing fee found for this product';
    END IF;
    
    -- Get wallets
    SELECT id INTO v_seller_wallet_id
    FROM wallets
    WHERE user_id = v_listing_fee.seller_id AND wallet_type = 'commission';
    
    SELECT id INTO v_platform_wallet_id
    FROM wallets
    WHERE user_id = (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1) AND wallet_type = 'commission';
    
    -- Create refund transaction
    INSERT INTO transactions (
        from_wallet_id, to_wallet_id, amount, transaction_type,
        description, status, metadata
    ) VALUES (
        v_platform_wallet_id, v_seller_wallet_id, v_listing_fee.fee_amount,
        'listing_fee_refund', 'Listing fee refund: ' || COALESCE(p_reason, 'Admin refund'),
        'completed', json_build_object('product_id', p_product_id, 'original_fee_id', v_listing_fee.id)
    ) RETURNING id INTO v_refund_transaction_id;
    
    -- Update wallet balances
    UPDATE wallets SET balance = balance - v_listing_fee.fee_amount WHERE id = v_platform_wallet_id;
    UPDATE wallets SET balance = balance + v_listing_fee.fee_amount WHERE id = v_seller_wallet_id;
    
    -- Update listing fee status
    UPDATE listing_fees
    SET fee_status = 'refunded', refunded_at = NOW(), refund_reason = p_reason,
        transaction_id = v_refund_transaction_id, updated_at = NOW()
    WHERE id = v_listing_fee.id;
    
    RETURN TRUE;
END;
$$;

-- Update product creation trigger to require listing fee
CREATE OR REPLACE FUNCTION public.check_listing_fee_before_active()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only check for real_estate and automobile categories
    IF NEW.category IN ('real_estate', 'automobile') AND NEW.status = 'pending_verification' THEN
        -- Check if listing fee is paid
        IF NOT EXISTS (
            SELECT 1 FROM listing_fees 
            WHERE product_id = NEW.id AND fee_status = 'paid'
        ) THEN
            RAISE EXCEPTION 'Listing fee must be paid before product can be set to pending_verification';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create triggers
CREATE OR REPLACE TRIGGER update_listing_fees_updated_at
BEFORE UPDATE ON public.listing_fees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_listing_fee_settings_updated_at
BEFORE UPDATE ON public.listing_fee_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER check_listing_fee_before_active_trigger
BEFORE UPDATE ON public.marketplace_products
FOR EACH ROW
EXECUTE FUNCTION public.check_listing_fee_before_active();

-- Insert default listing fee settings
INSERT INTO public.listing_fee_settings (category, min_fee, max_fee, fee_type) VALUES
    ('real_estate', 100.00, 500.00, 'fixed'),
    ('automobile', 20.00, 100.00, 'fixed')
ON CONFLICT (category) DO NOTHING;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_listing_fee TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_listing_fee TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_listing_fee TO authenticated;
