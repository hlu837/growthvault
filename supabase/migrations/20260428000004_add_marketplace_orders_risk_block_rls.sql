-- Block orders for high-risk marketplace products at the database level.
-- This prevents bots or direct API calls from purchasing products marked as high risk.

CREATE OR REPLACE FUNCTION public.fn_marketplace_product_risk_score(p_product_id UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE((specifications ->> 'risk_score')::INT, 0)
  FROM public.marketplace_products
  WHERE id = p_product_id;
$$;

DROP POLICY IF EXISTS "Users can create orders" ON public.marketplace_orders;
CREATE POLICY "Users can create orders"
  ON public.marketplace_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (SELECT account_status FROM public.profiles WHERE id = auth.uid()) = 'active'
    AND public.fn_marketplace_product_risk_score(product_id) <= 60
  );

DROP POLICY IF EXISTS "Admins can manage all orders" ON public.marketplace_orders;
CREATE POLICY "Admins can manage all orders"
  ON public.marketplace_orders FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND (SELECT account_status FROM public.profiles WHERE id = auth.uid()) = 'active'
    AND public.fn_marketplace_product_risk_score(product_id) <= 60
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND (SELECT account_status FROM public.profiles WHERE id = auth.uid()) = 'active'
    AND public.fn_marketplace_product_risk_score(product_id) <= 60
  );
