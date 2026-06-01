-- Add IP fingerprinting support for signup/login checks

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ip_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_ip_hash ON public.profiles(ip_hash);

CREATE OR REPLACE FUNCTION public.hash_ip_address(p_ip TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT encode(digest(p_ip, 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.is_ip_blacklisted(p_ip_hash TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE account_status = 'blacklisted'
      AND ip_hash = p_ip_hash
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_ip_blacklisted(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referrer_user_id UUID;
  referral_code_input TEXT;
  ip_hash TEXT;
BEGIN
  referral_code_input := NEW.raw_user_meta_data ->> 'referral_code';
  ip_hash := NEW.raw_user_meta_data ->> 'ip_hash';

  IF ip_hash IS NOT NULL AND ip_hash <> '' AND public.is_ip_blacklisted(ip_hash) THEN
    RAISE EXCEPTION 'Signup blocked: IP address is associated with a blacklisted account';
  END IF;

  IF referral_code_input IS NOT NULL AND referral_code_input != '' THEN
    SELECT id INTO referrer_user_id FROM public.profiles WHERE referral_code = referral_code_input;
  END IF;

  INSERT INTO public.profiles (id, full_name, email, referred_by, ip_hash)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email,
    referrer_user_id,
    NULLIF(ip_hash, '')
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member');

  INSERT INTO public.wallets (user_id, wallet_type) VALUES
    (NEW.id, 'savings'),
    (NEW.id, 'mlm_capital'),
    (NEW.id, 'trading_principal'),
    (NEW.id, 'mlm_bonus'),
    (NEW.id, 'loan');

  IF referrer_user_id IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_id, referred_id, level)
    VALUES (referrer_user_id, NEW.id, 1);
  END IF;

  RETURN NEW;
END;
$$;
