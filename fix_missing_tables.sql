-- ============================================================
-- FIX 1: Create missing seller_application_notifications table
-- ============================================================
-- The frontend queries this table but it was never created.

CREATE TABLE IF NOT EXISTS public.seller_application_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'application_status',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    related_id UUID, -- links to the seller_application id
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.seller_application_notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
    ON public.seller_application_notifications FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Users can mark their own as read
CREATE POLICY "Users can update own notifications"
    ON public.seller_application_notifications FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

-- Admins and system (SECURITY DEFINER functions) can insert
CREATE POLICY "Admins can insert notifications"
    ON public.seller_application_notifications FOR INSERT
    TO authenticated
    WITH CHECK (TRUE);

-- Admins can manage all
CREATE POLICY "Admins can manage all notifications"
    ON public.seller_application_notifications FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role IN ('admin', 'staff')
        )
    );

-- Grant select to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.seller_application_notifications TO authenticated;

-- ============================================================
-- FIX 2: Safer pay_listing_fee function
-- ============================================================
-- The original function raises an exception if the platform wallet
-- is missing, which causes the 400 error. This version creates the
-- platform wallet record if it's absent, and also handles the case
-- where the seller's commission wallet doesn't exist yet.

CREATE OR REPLACE FUNCTION public.pay_listing_fee(
    p_product_id UUID,
    p_payment_method TEXT DEFAULT 'wallet'
)
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
    v_admin_user_id UUID;
    v_seller_balance DECIMAL;
BEGIN
    -- Get product details (must be owned by calling user)
    SELECT * INTO v_product
    FROM marketplace_products
    WHERE id = p_product_id AND created_by = auth.uid();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found or unauthorized';
    END IF;

    -- Only require listing fees for real_estate and automobile
    IF v_product.category NOT IN ('real_estate', 'automobile') THEN
        RAISE EXCEPTION 'Listing fee not required for this category';
    END IF;

    -- Check if listing fee already paid
    IF EXISTS (
        SELECT 1 FROM listing_fees
        WHERE product_id = p_product_id AND fee_status = 'paid'
    ) THEN
        RAISE EXCEPTION 'Listing fee already paid for this product';
    END IF;

    -- Calculate fee amount
    v_fee_amount := get_listing_fee(v_product.category);

    -- ---- Seller commission wallet ----
    SELECT id INTO v_seller_wallet_id
    FROM wallets
    WHERE user_id = auth.uid() AND wallet_type = 'commission';

    -- Auto-create seller commission wallet if missing
    IF v_seller_wallet_id IS NULL THEN
        INSERT INTO wallets (user_id, wallet_type, balance, currency)
        VALUES (auth.uid(), 'commission', 0, 'USD')
        RETURNING id INTO v_seller_wallet_id;
    END IF;

    -- Check sufficient balance
    SELECT balance INTO v_seller_balance
    FROM wallets WHERE id = v_seller_wallet_id;

    IF v_seller_balance < v_fee_amount THEN
        RAISE EXCEPTION 'Insufficient balance. Required: %, Available: %', v_fee_amount, v_seller_balance;
    END IF;

    -- ---- Platform wallet ----
    -- Try profiles.role = 'admin' first
    SELECT id INTO v_admin_user_id
    FROM profiles
    WHERE role = 'admin'
    LIMIT 1;

    IF v_admin_user_id IS NOT NULL THEN
        SELECT id INTO v_platform_wallet_id
        FROM wallets
        WHERE user_id = v_admin_user_id AND wallet_type = 'commission';
    END IF;

    -- If platform wallet not found, try user_roles table
    IF v_platform_wallet_id IS NULL THEN
        SELECT w.id INTO v_platform_wallet_id
        FROM wallets w
        JOIN user_roles ur ON ur.user_id = w.user_id
        WHERE ur.role = 'admin' AND w.wallet_type = 'commission'
        LIMIT 1;
    END IF;

    -- If still not found, create one for the admin user
    IF v_platform_wallet_id IS NULL AND v_admin_user_id IS NOT NULL THEN
        INSERT INTO wallets (user_id, wallet_type, balance, currency)
        VALUES (v_admin_user_id, 'commission', 0, 'USD')
        RETURNING id INTO v_platform_wallet_id;
    END IF;

    -- If absolutely no admin exists, raise a clear error
    IF v_platform_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Platform wallet not configured. Please contact support.';
    END IF;

    -- ---- Create transaction ----
    INSERT INTO transactions (
        from_wallet_id, to_wallet_id, amount, transaction_type,
        description, status, metadata
    ) VALUES (
        v_seller_wallet_id, v_platform_wallet_id, v_fee_amount,
        'listing_fee', 'Listing fee payment for ' || v_product.category,
        'completed', json_build_object('product_id', p_product_id)
    ) RETURNING id INTO v_transaction_id;

    -- ---- Update wallet balances ----
    UPDATE wallets SET balance = balance - v_fee_amount WHERE id = v_seller_wallet_id;
    UPDATE wallets SET balance = balance + v_fee_amount WHERE id = v_platform_wallet_id;

    -- ---- Create listing fee record ----
    INSERT INTO listing_fees (
        product_id, seller_id, category, fee_amount, fee_status,
        payment_method, transaction_id, paid_at
    ) VALUES (
        p_product_id, auth.uid(), v_product.category, v_fee_amount,
        'paid', p_payment_method, v_transaction_id, NOW()
    ) RETURNING id INTO v_fee_id;

    -- ---- Update product status ----
    UPDATE marketplace_products
    SET status = 'pending_verification', updated_at = NOW()
    WHERE id = p_product_id;

    -- ---- Notify seller ----
    INSERT INTO seller_application_notifications (
        user_id, type, title, message, related_id
    ) VALUES (
        auth.uid(),
        'listing_fee_paid',
        'Listing Fee Paid',
        'Your listing fee of $' || v_fee_amount || ' has been received. Your product is now pending verification.',
        p_product_id
    );

    RETURN v_fee_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pay_listing_fee TO authenticated;
