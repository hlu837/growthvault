-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "sellers_can_insert_products" ON public.marketplace_products;
DROP POLICY IF EXISTS "sellers_can_update_products" ON public.marketplace_products;
DROP POLICY IF EXISTS "Users can create products" ON public.marketplace_products;

-- Create the insert policy
CREATE POLICY "sellers_can_insert_products" ON public.marketplace_products
    FOR INSERT WITH CHECK (
        auth.uid() = created_by
    );

-- Create the update policy
CREATE POLICY "sellers_can_update_products" ON public.marketplace_products
    FOR UPDATE USING (
        auth.uid() = created_by
    );
