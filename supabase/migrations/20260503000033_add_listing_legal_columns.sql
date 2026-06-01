-- Add missing columns for legal compliance and fee tracking
ALTER TABLE public.marketplace_products 
ADD COLUMN IF NOT EXISTS legal_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS listing_fee_paid BOOLEAN DEFAULT false;
