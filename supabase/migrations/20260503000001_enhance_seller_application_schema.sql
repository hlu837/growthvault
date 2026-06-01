-- Add comprehensive fields to seller_applications table
ALTER TABLE public.seller_applications 
ADD COLUMN IF NOT EXISTS account_type TEXT CHECK (account_type IN ('individual', 'business')),
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS username TEXT,
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS nationality TEXT,
ADD COLUMN IF NOT EXISTS residential_address TEXT,
ADD COLUMN IF NOT EXISTS bank_account_name TEXT,
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
ADD COLUMN IF NOT EXISTS payout_method TEXT CHECK (payout_method IN ('bank_transfer', 'mobile_money')),
ADD COLUMN IF NOT EXISTS password TEXT,
ADD COLUMN IF NOT EXISTS security_question TEXT,
ADD COLUMN IF NOT EXISTS security_answer TEXT,
ADD COLUMN IF NOT EXISTS commitment_agreement BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS escrow_agreement BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dispute_agreement BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS terms_agreement BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS final_declaration_signature TEXT,
ADD COLUMN IF NOT EXISTS final_declaration_date DATE,
-- Category-specific fields
ADD COLUMN IF NOT EXISTS real_estate_seller_type TEXT CHECK (real_estate_seller_type IN ('owner', 'agent', 'developer')),
ADD COLUMN IF NOT EXISTS has_legal_authority BOOLEAN,
ADD COLUMN IF NOT EXISTS automobile_seller_type TEXT CHECK (automobile_seller_type IN ('private', 'dealer')),
ADD COLUMN IF NOT EXISTS estimated_inventory_size INTEGER,
ADD COLUMN IF NOT EXISTS electronics_product_type TEXT CHECK (electronics_product_type IN ('new', 'refurbished', 'used')),
ADD COLUMN IF NOT EXISTS offers_warranty BOOLEAN,
-- Multi-select categories (JSON array)
ADD COLUMN IF NOT EXISTS applied_categories JSONB DEFAULT '[]'::jsonb;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_seller_applications_account_type ON public.seller_applications(account_type);
CREATE INDEX IF NOT EXISTS idx_seller_applications_username ON public.seller_applications(username);
CREATE INDEX IF NOT EXISTS idx_seller_applications_status ON public.seller_applications(status);

-- Add unique constraint for username
ALTER TABLE public.seller_applications 
ADD CONSTRAINT seller_applications_username_unique 
UNIQUE (username) 
WHERE username IS NOT NULL;
