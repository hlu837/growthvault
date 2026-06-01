-- Enforce that only active users can insert or update marketplace product listings.
-- This prevents suspended or restricted users from bypassing UI checks and creating scam listings.

ALTER TABLE public.marketplace_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active users can insert marketplace products"
  ON public.marketplace_products
  FOR INSERT
  WITH CHECK (
    (SELECT account_status FROM public.profiles WHERE id = auth.uid()) = 'active'
  );

CREATE POLICY "Active users can update marketplace products"
  ON public.marketplace_products
  FOR UPDATE
  USING (
    (SELECT account_status FROM public.profiles WHERE id = auth.uid()) = 'active'
  )
  WITH CHECK (
    (SELECT account_status FROM public.profiles WHERE id = auth.uid()) = 'active'
  );

CREATE POLICY "Active users can insert marketplace orders"
  ON public.marketplace_orders
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (SELECT account_status FROM public.profiles WHERE id = auth.uid()) = 'active'
  );

CREATE POLICY "Active users can update marketplace orders"
  ON public.marketplace_orders
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND (SELECT account_status FROM public.profiles WHERE id = auth.uid()) = 'active'
  )
  WITH CHECK (
    user_id = auth.uid()
    AND (SELECT account_status FROM public.profiles WHERE id = auth.uid()) = 'active'
  );

CREATE OR REPLACE FUNCTION public.fn_prevent_self_buying_marketplace_orders()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  IF (SELECT created_by FROM public.marketplace_products WHERE id = NEW.product_id) = NEW.user_id THEN
    RAISE EXCEPTION 'Self-buying is strictly prohibited';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_self_buying_marketplace_orders_trigger ON public.marketplace_orders;
CREATE TRIGGER prevent_self_buying_marketplace_orders_trigger
  BEFORE INSERT OR UPDATE ON public.marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_self_buying_marketplace_orders();
