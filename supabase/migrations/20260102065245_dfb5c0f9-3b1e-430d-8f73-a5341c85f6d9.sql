-- Create enum for roles
CREATE TYPE IF NOT EXISTS public.app_role AS ENUM ('admin', 'staff', 'member');

-- Create enum for investment tiers
CREATE TYPE IF NOT EXISTS public.investment_tier AS ENUM ('starter', 'golden', 'premium', 'business', 'platinum', 'achiever');

-- Create enum for wallet types
CREATE TYPE IF NOT EXISTS public.wallet_type AS ENUM ('savings', 'mlm_capital', 'trading_principal', 'mlm_bonus', 'loan');

-- Create enum for transaction types
CREATE TYPE IF NOT EXISTS public.transaction_type AS ENUM ('investment', 'withdrawal', 'bonus', 'loan', 'transfer');

-- Function to generate unique 6-digit alphanumeric referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
  code_exists BOOLEAN := TRUE;
BEGIN
  WHILE code_exists LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = result) INTO code_exists;
  END LOOP;
  RETURN result;
END;
$$;

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  referral_code TEXT UNIQUE DEFAULT public.generate_referral_code(),
  referred_by UUID REFERENCES public.profiles(id),
  investment_tier public.investment_tier DEFAULT 'starter',
  is_frozen BOOLEAN DEFAULT FALSE,
  kyc_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- Create wallets table
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  wallet_type public.wallet_type NOT NULL,
  balance DECIMAL(15, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, wallet_type)
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  transaction_type public.transaction_type NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  amount_mlm DECIMAL(15, 2) DEFAULT 0.00,
  amount_trading DECIMAL(15, 2) DEFAULT 0.00,
  description TEXT,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create referrals table to track downline
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  referred_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  level INTEGER DEFAULT 1,
  earnings DECIMAL(15, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (referrer_id, referred_id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user is admin or staff
CREATE OR REPLACE FUNCTION public.is_admin_or_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'staff')
  )
$$;

-- Profiles RLS policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin_or_staff(auth.uid()));

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_staff(auth.uid()));

-- User roles RLS policies
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Wallets RLS policies
CREATE POLICY "Users can view own wallets"
  ON public.wallets FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all wallets"
  ON public.wallets FOR SELECT
  TO authenticated
  USING (public.is_admin_or_staff(auth.uid()));

-- Transactions RLS policies
CREATE POLICY "Users can view own transactions"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own transactions"
  ON public.transactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all transactions"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (public.is_admin_or_staff(auth.uid()));

-- Referrals RLS policies
CREATE POLICY "Users can view referrals they made"
  ON public.referrals FOR SELECT
  TO authenticated
  USING (referrer_id = auth.uid());

CREATE POLICY "Admins can view all referrals"
  ON public.referrals FOR SELECT
  TO authenticated
  USING (public.is_admin_or_staff(auth.uid()));

-- Trigger to create profile and wallets on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referrer_user_id UUID;
  referral_code_input TEXT;
BEGIN
  -- Get referral code from metadata
  referral_code_input := NEW.raw_user_meta_data ->> 'referral_code';
  
  -- Find referrer if referral code provided
  IF referral_code_input IS NOT NULL AND referral_code_input != '' THEN
    SELECT id INTO referrer_user_id FROM public.profiles WHERE referral_code = referral_code_input;
  END IF;
  
  -- Create profile
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
  
  -- Create referral record if referred
  IF referrer_user_id IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_id, referred_id, level)
    VALUES (referrer_user_id, NEW.id, 1);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to process investment with 50/50 split
CREATE OR REPLACE FUNCTION public.process_investment(
  p_user_id UUID,
  p_amount DECIMAL,
  p_tier public.investment_tier
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mlm_amount DECIMAL;
  trading_amount DECIMAL;
  transaction_id UUID;
BEGIN
  -- Calculate 50/50 split
  mlm_amount := p_amount / 2;
  trading_amount := p_amount / 2;
  
  -- Create transaction record
  INSERT INTO public.transactions (user_id, transaction_type, amount, amount_mlm, amount_trading, description)
  VALUES (p_user_id, 'investment'::transaction_type, p_amount, mlm_amount, trading_amount, 'Investment in ' || p_tier || ' tier')
  RETURNING id INTO transaction_id;
  
  -- Update MLM Capital wallet
  UPDATE public.wallets
  SET balance = balance + mlm_amount, updated_at = NOW()
  WHERE user_id = p_user_id AND wallet_type = 'mlm_capital';
  
  -- Update Trading Principal wallet
  UPDATE public.wallets
  SET balance = balance + trading_amount, updated_at = NOW()
  WHERE user_id = p_user_id AND wallet_type = 'trading_principal';
  
  -- Update user's investment tier
  UPDATE public.profiles
  SET investment_tier = p_tier, updated_at = NOW()
  WHERE id = p_user_id;
  
  RETURN transaction_id;
END;
$$;

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create update triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();