-- ============================================================
-- MARKETPLACE & ADMINISTRATIVE UPDATES
-- ============================================================

-- Add bank_accounts table for multiple bank account support
CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('checking', 'savings', 'business')),
    account_holder_name TEXT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, account_number)
);

-- Add EUR exchange rate if not exists
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES 
    ('eur_rate', 0.92, 'EUR to USD exchange rate'),
    ('gbp_rate', 0.79, 'GBP to USD exchange rate'),
    ('cad_rate', 1.36, 'CAD to USD exchange rate'),
    ('ngn_rate', 1600.00, 'NGN to USD exchange rate'),
    ('ghs_rate', 15.50, 'GHS to USD exchange rate'),
    ('kes_rate', 153.00, 'KES to USD exchange rate'),
    ('zar_rate', 18.50, 'ZAR to USD exchange rate')
ON CONFLICT (setting_key) DO NOTHING;

-- Update exchange_rates table with new currencies
INSERT INTO public.exchange_rates (base_currency, target_currency, rate, updated_at)
VALUES 
    ('USD', 'EUR', 0.92, NOW()),
    ('USD', 'GBP', 0.79, NOW()),
    ('USD', 'CAD', 1.36, NOW()),
    ('USD', 'NGN', 1600.00, NOW()),
    ('USD', 'GHS', 15.50, NOW()),
    ('USD', 'KES', 153.00, NOW()),
    ('USD', 'ZAR', 18.50, NOW())
ON CONFLICT (base_currency, target_currency) DO UPDATE SET 
    rate = EXCLUDED.rate,
    updated_at = NOW();

-- Add 2FA settings to system_settings
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES 
    ('2fa_required', 1, 'Require two-factor authentication for admin/staff'),
    ('2fa_secret_expiry', 300, '2FA secret expiry time in seconds'),
    ('max_login_attempts', 5, 'Maximum login attempts before lockout'),
    ('session_timeout', 3600, 'Session timeout in seconds')
ON CONFLICT (setting_key) DO NOTHING;

-- Create user_sessions table for session management
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create 2fa_tokens table for two-factor authentication
CREATE TABLE IF NOT EXISTS public.two_factor_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    secret TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to manage user bank accounts
CREATE OR REPLACE FUNCTION public.manage_bank_account(
    p_action TEXT, -- 'add', 'update', 'delete', 'set_default'
    p_account_id UUID DEFAULT NULL,
    p_bank_name TEXT DEFAULT NULL,
    p_account_number TEXT DEFAULT NULL,
    p_account_type TEXT DEFAULT NULL,
    p_account_holder_name TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Authorization: Only account owner or admin can manage accounts
    IF p_action = 'add' AND p_account_id IS NOT NULL THEN
        RAISE EXCEPTION 'Account ID not allowed for add action';
    END IF;

    IF p_action IN ('update', 'delete', 'set_default') AND p_account_id IS NULL THEN
        RAISE EXCEPTION 'Account ID required for update/delete/set_default actions';
    END IF;

    IF p_action = 'add' THEN
        -- Add new bank account
        INSERT INTO public.bank_accounts (
            user_id, bank_name, account_number, account_type, 
            account_holder_name, is_default
        ) VALUES (
            auth.uid(), p_bank_name, p_account_number, p_account_type,
            p_account_holder_name, COALESCE((SELECT COUNT(*) FROM bank_accounts WHERE user_id = auth.uid()), 0) = 0
        );
    ELSIF p_action = 'update' THEN
        -- Update existing account
        UPDATE public.bank_accounts
        SET 
            bank_name = COALESCE(p_bank_name, bank_name),
            account_number = COALESCE(p_account_number, account_number),
            account_type = COALESCE(p_account_type, account_type),
            account_holder_name = COALESCE(p_account_holder_name, account_holder_name),
            updated_at = NOW()
        WHERE id = p_account_id AND user_id = auth.uid();
    ELSIF p_action = 'delete' THEN
        -- Delete account
        DELETE FROM public.bank_accounts WHERE id = p_account_id AND user_id = auth.uid();
    ELSIF p_action = 'set_default' THEN
        -- Set as default account
        UPDATE public.bank_accounts
        SET is_default = FALSE, updated_at = NOW()
        WHERE user_id = auth.uid();
        
        UPDATE public.bank_accounts
        SET is_default = TRUE, updated_at = NOW()
        WHERE id = p_account_id AND user_id = auth.uid();
    END IF;

    RETURN TRUE;
END;
$$;

-- Function to get user bank accounts
CREATE OR REPLACE FUNCTION public.get_user_bank_accounts()
RETURNS TABLE (
    id UUID,
    bank_name TEXT,
    account_number TEXT,
    account_type TEXT,
    account_holder_name TEXT,
    is_default BOOLEAN,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        id, bank_name, account_number, account_type, account_holder_name,
        is_default, is_active, created_at
    FROM public.bank_accounts
    WHERE user_id = auth.uid() AND is_active = TRUE
    ORDER BY is_default DESC, created_at ASC;
END;
$$;

-- Function to generate 2FA token
CREATE OR REPLACE FUNCTION public.generate_2fa_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token TEXT;
    v_secret TEXT;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- Generate secure random token
    v_token := encode(gen_random_bytes(32), 'base64');
    v_secret := encode(gen_random_bytes(32), 'base64');
    v_expires_at := NOW() + INTERVAL '5 minutes';
    
    -- Store 2FA token
    INSERT INTO public.two_factor_tokens (
        user_id, token, secret, expires_at
    ) VALUES (
        auth.uid(), v_token, v_secret, v_expires_at
    );
    
    RETURN v_token;
END;
$$;

-- Function to verify 2FA token
CREATE OR REPLACE FUNCTION public.verify_2fa_token(
    p_token TEXT,
    p_code TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token_record RECORD;
    v_valid_code BOOLEAN;
BEGIN
    -- Get token record
    SELECT * INTO v_token_record
    FROM public.two_factor_tokens
    WHERE token = p_token 
        AND user_id = auth.uid() 
        AND is_used = FALSE 
        AND expires_at > NOW();
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Verify the code (simple TOTP simulation)
    v_valid_code := (p_code = SUBSTRING(MD5(v_token_record.secret), 1, 6));
    
    IF v_valid_code THEN
        -- Mark token as used
        UPDATE public.two_factor_tokens
        SET is_used = TRUE
        WHERE id = v_token_record.id;
    END IF;
    
    RETURN v_valid_code;
END;
$$;

-- Function to check if user has 2FA enabled
CREATE OR REPLACE FUNCTION public.user_has_2fa_enabled()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_2fa_required BOOLEAN;
BEGIN
    SELECT setting_value::BOOLEAN INTO v_2fa_required
    FROM system_settings
    WHERE setting_key = '2fa_required';
    
    RETURN COALESCE(v_2fa_required, FALSE);
END;
$$;

-- Enable RLS on new tables
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.two_factor_tokens ENABLE ROW LEVEL SECURITY;

-- RLS policies for bank_accounts
CREATE POLICY "Users can manage own bank accounts"
    ON public.bank_accounts FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Admin can view all bank accounts"
    ON public.bank_accounts FOR SELECT
    TO authenticated
    USING (is_admin_or_staff(auth.uid()));

-- RLS policies for user_sessions
CREATE POLICY "Users can manage own sessions"
    ON public.user_sessions FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Admin can view all sessions"
    ON public.user_sessions FOR SELECT
    TO authenticated
    USING (is_admin_or_staff(auth.uid()));

-- RLS policies for two_factor_tokens
CREATE POLICY "Users can manage own 2FA tokens"
    ON public.two_factor_tokens FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Admin can manage all 2FA tokens"
    ON public.two_factor_tokens FOR SELECT
    TO authenticated
    USING (is_admin_or_staff(auth.uid()));

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.manage_bank_account(TEXT, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_bank_accounts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_2fa_token() TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_2fa_token(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_2fa_enabled() TO authenticated;
