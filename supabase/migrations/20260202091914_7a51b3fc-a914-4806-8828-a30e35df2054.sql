-- Add new KYC document fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS passport_url text,
ADD COLUMN IF NOT EXISTS selfie_url text,
ADD COLUMN IF NOT EXISTS bvn_number text;