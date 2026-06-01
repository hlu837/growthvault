
-- 1. Add is_system_account flag to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_system_account BOOLEAN DEFAULT FALSE;

-- 2. Update handle_new_user() to auto-assign orphan users to the system referral account
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referrer_user_id UUID;
  referral_code_input TEXT;
  system_account_id UUID;
BEGIN
  -- Get referral code from metadata
  referral_code_input := NEW.raw_user_meta_data ->> 'referral_code';
  
  -- Find referrer if referral code provided
  IF referral_code_input IS NOT NULL AND referral_code_input != '' THEN
    SELECT id INTO referrer_user_id 
    FROM public.profiles 
    WHERE referral_code = referral_code_input 
      AND is_system_account = FALSE;
  END IF;
  
  -- If no valid referrer found, assign to system referral account
  IF referrer_user_id IS NULL THEN
    SELECT id INTO system_account_id
    FROM public.profiles
    WHERE is_system_account = TRUE
    LIMIT 1;
    
    referrer_user_id := system_account_id;
  END IF;
  
  -- Create profile (referrer may be NULL if no system account exists yet)
  INSERT INTO public.profiles (id, full_name, email, referred_by)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email,
    referrer_user_id
  );
  
  -- Assign default member role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member');
  
  -- Create all wallet types for user
  INSERT INTO public.wallets (user_id, wallet_type) VALUES
    (NEW.id, 'savings'),
    (NEW.id, 'mlm_capital'),
    (NEW.id, 'trading_principal'),
    (NEW.id, 'mlm_bonus'),
    (NEW.id, 'loan');
  
  -- Create referral record if we have a referrer
  IF referrer_user_id IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_id, referred_id, level, earnings)
    VALUES (referrer_user_id, NEW.id, 1, 0);
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Prevent system accounts from creating withdrawals
CREATE OR REPLACE FUNCTION public.prevent_system_account_withdrawal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = NEW.user_id AND is_system_account = TRUE
  ) THEN
    RAISE EXCEPTION 'System accounts cannot create withdrawals';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_system_account_withdrawal
  BEFORE INSERT ON public.withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_system_account_withdrawal();

-- 4. Prevent system accounts from earning MLM commissions
CREATE OR REPLACE FUNCTION public.prevent_system_account_earnings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = NEW.referrer_id AND is_system_account = TRUE
  ) THEN
    NEW.earnings := 0;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_system_account_earnings
  BEFORE INSERT OR UPDATE ON public.referrals
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_system_account_earnings();
