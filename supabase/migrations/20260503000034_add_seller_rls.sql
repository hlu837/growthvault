-- Allow sellers to insert their own products
CREATE POLICY "sellers_can_insert_products" ON public.marketplace_products
    FOR INSERT WITH CHECK (
        auth.uid() = created_by 
        AND EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role IN ('seller', 'admin', 'super_admin')
        )
    );

-- Allow sellers to update their own products
CREATE POLICY "sellers_can_update_products" ON public.marketplace_products
    FOR UPDATE USING (
        auth.uid() = created_by
    );
