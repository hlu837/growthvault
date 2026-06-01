-- Enable veteran sellers with flawless track records to skip manual listing review.
-- New listings by sellers with risk_score = 0 and more than 3 confirmed sales are auto-approved.

CREATE OR REPLACE FUNCTION public.fn_marketplace_seller_confirmed_sales(p_seller_id UUID)
  RETURNS INTEGER
  LANGUAGE SQL
  STABLE
AS $$
  SELECT COUNT(*)
  FROM public.marketplace_orders mo
  JOIN public.marketplace_products mp ON mo.product_id = mp.id
  WHERE mp.created_by = p_seller_id
    AND mo.order_status = 'confirmed';
$$;

CREATE OR REPLACE FUNCTION public.fn_marketplace_veteran_auto_approve_listing()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
DECLARE
  seller_risk_score INTEGER;
  confirmed_sales_count INTEGER;
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid()::uuid;
  END IF;

  SELECT COALESCE(risk_score, 0)
  INTO seller_risk_score
  FROM public.profiles
  WHERE id = auth.uid()::uuid;

  IF seller_risk_score = 0 THEN
    confirmed_sales_count := public.fn_marketplace_seller_confirmed_sales(auth.uid()::uuid);

    IF confirmed_sales_count > 3 THEN
      NEW.status := 'active';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketplace_veteran_auto_approve_listing_trigger ON public.marketplace_products;
CREATE TRIGGER marketplace_veteran_auto_approve_listing_trigger
  BEFORE INSERT ON public.marketplace_products
  FOR EACH ROW EXECUTE FUNCTION public.fn_marketplace_veteran_auto_approve_listing();

DROP POLICY IF EXISTS "Active users can insert marketplace products" ON public.marketplace_products;
CREATE POLICY "Active users can insert marketplace products"
  ON public.marketplace_products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT account_status FROM public.profiles WHERE id = auth.uid()) = 'active'
    AND created_by = auth.uid()::uuid
  );
