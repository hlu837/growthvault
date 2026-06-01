-- Create account status enum
CREATE TYPE public.account_status AS ENUM ('active', 'suspended', 'blacklisted', 'under_review');

-- Add account_status column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS account_status public.account_status NOT NULL DEFAULT 'active';

-- Create index for faster status filtering
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles(account_status);