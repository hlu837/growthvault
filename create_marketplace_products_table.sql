-- Create marketplace_products table for listings
CREATE TABLE IF NOT EXISTS public.marketplace_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('real_estate', 'automobile', 'electronic', 'general')),
    price DECIMAL(15,2) NOT NULL,
    currency TEXT DEFAULT 'USD' CHECK (currency IN ('USD', 'EUR', 'GBP')),
    images TEXT[] DEFAULT '{}',
    thumbnail_url TEXT,
    status TEXT DEFAULT 'pending_verification' CHECK (status IN ('pending_verification', 'draft', 'active', 'rejected', 'suspended')),
    stock_quantity INTEGER DEFAULT 1,
    specifications JSONB DEFAULT '{}'::jsonb,
    location TEXT,
    featured BOOLEAN DEFAULT FALSE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    legal_accepted_at TIMESTAMPTZ,
    listing_fee_paid BOOLEAN DEFAULT FALSE,
    vin_number TEXT,
    serial_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE marketplace_products ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own listings"
    ON marketplace_products FOR SELECT
    TO authenticated
    USING (created_by = auth.uid());

CREATE POLICY "Admins can view all listings"
    ON marketplace_products FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'staff')
        )
    );

CREATE POLICY "Users can insert their own listings"
    ON marketplace_products FOR INSERT
    TO authenticated
    WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admins can update all listings"
    ON marketplace_products FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'staff')
        )
    );

CREATE POLICY "Users can update their own listings"
    ON marketplace_products FOR UPDATE
    TO authenticated
    WITH CHECK (created_by = auth.uid());

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_marketplace_products_status ON marketplace_products(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_products_created_by ON marketplace_products(created_by);
CREATE INDEX IF NOT EXISTS idx_marketplace_products_category ON marketplace_products(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_products_created_at ON marketplace_products(created_at);
